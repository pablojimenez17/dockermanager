import { Server } from 'socket.io';
import Docker from 'dockerode';
import User from './models/User.js';
import Container from './models/Container.js';
import jwt from 'jsonwebtoken';

const docker = new Docker(process.env.DOCKER_HOST ? { host: process.env.DOCKER_HOST.split(':')[1].replace('//', ''), port: process.env.DOCKER_HOST.split(':').pop() } : { socketPath: process.platform === 'win32' ? '//./pipe/docker_engine' : '/var/run/docker.sock' });

let ioInstance;

export const setupSockets = (server) => {
    const io = new Server(server, {
        cors: {
            origin: [
                'http://localhost:5173', 
                'https://localhost:5173', 
                'http://localhost', 
                'https://localhost',
                'https://orbitcloud.app',
                'https://www.orbitcloud.app'
            ],
            methods: ['GET', 'POST'],
            credentials: true
        },
        pingInterval: 10000,
        pingTimeout: 5000,
        connectTimeout: 10000,
        transports: ['websocket']
    });

    ioInstance = io;

    // Basic authentication middleware for sockets
    io.use(async (socket, next) => {
        try {
            // First try to authenticate via a token sent in the handshake auth
            // This is easier for React clients to send explicitly
            let token = socket.handshake.auth.token;

            // Fallback: Check HTTP-Only cookies sent by the browser
            if (!token && socket.handshake.headers.cookie) {
                const cookieString = socket.handshake.headers.cookie;
                const match = cookieString.match(new RegExp('(^| )' + 'token' + '=([^;]+)'));
                if (match) token = match[2];
            }

            if (!token) {
                return next(new Error('Authentication token missing'));
            }

            const decoded = jwt.verify(token, process.env.JWT_SECRET || 'supersecretjwtkey');

            // Attach user info to the socket instance for later use
            socket.user = { userId: decoded.userId, role: decoded.role };
            next();
        } catch (err) {
            console.error('[Websocket Auth Error]', err.message);
            next(new Error('Authentication failed'));
        }
    });

    io.on('connection', (socket) => {
        console.log(`[WebSocket] Client connected: ${socket.id} (User: ${socket.user.userId})`);

        // Join a dedicated room for this user to receive direct notifications
        socket.join(socket.user.userId.toString());

        let logStream = null;

        socket.on('subscribe_logs', async (data) => {
            try {
                const { containerId } = data;

                // 1. Verify Ownership / Permissions
                const dbContainer = await Container.findOne({ _id: containerId });
                if (!dbContainer) {
                    socket.emit('log_error', 'Container not found in database');
                    return;
                }

                if (dbContainer.userId.toString() !== socket.user.userId && socket.user.role !== 'admin') {
                    socket.emit('log_error', 'Forbidden: You do not own this container');
                    return;
                }

                // 2. Cleanup previous streams
                if (logStream) {
                    try { logStream.destroy(); } catch (_) {}
                    logStream = null;
                }

                const container = docker.getContainer(dbContainer.dockerId);

                // 3. Check real Docker state
                let containerInfo;
                try {
                    containerInfo = await container.inspect();
                } catch (inspectErr) {
                    socket.emit('log_error', `Container not found in Docker: ${inspectErr.message}`);
                    return;
                }

                const isRunning = containerInfo.State.Status === 'running';
                const isTty = containerInfo.Config.Tty;

                socket.emit('log_stdout', `\x1b[36m[*] ${isRunning ? 'Live logs' : 'Historical logs (container stopped)'} for ${dbContainer.name}...\x1b[0m\r\n\r\n`);

                // 4. CRITICAL: use callback API, NOT await.
                // await container.logs({ follow: true }) hangs forever on running containers
                // because the Promise waits for the stream to END — which never happens.
                // The callback API returns the stream immediately without waiting for it to close.
                container.logs(
                    { follow: isRunning, stdout: true, stderr: true, tail: 200 },
                    (err, stream) => {
                        if (err) {
                            socket.emit('log_error', `Failed to get logs: ${err.message}`);
                            return;
                        }
                        if (!stream) {
                            socket.emit('log_error', 'No log stream returned by Docker');
                            return;
                        }

                        logStream = stream;

                        if (isTty) {
                            // TTY mode: raw text, no multiplexing header
                            stream.on('data', (chunk) => {
                                socket.emit('log_stdout', chunk.toString('utf8'));
                            });
                        } else {
                            // Normal mode: demux the Docker multiplexed stdout/stderr stream
                            docker.modem.demuxStream(
                                stream,
                                { write: (chunk) => socket.emit('log_stdout', chunk.toString('utf8')) },
                                { write: (chunk) => socket.emit('log_stderr', chunk.toString('utf8')) }
                            );
                        }

                        stream.on('end', () => {
                            socket.emit('log_stdout', '\r\n\x1b[33m[*] Log stream ended.\x1b[0m\r\n');
                            logStream = null;
                        });

                        stream.on('error', (streamErr) => {
                            socket.emit('log_error', `Stream error: ${streamErr.message}`);
                            logStream = null;
                        });
                    }
                );

            } catch (error) {
                console.error('[WebSocket Log Error]', error);
                socket.emit('log_error', `Failed to attach to logs: ${error.message}`);
            }
        });

        socket.on('unsubscribe_logs', () => {
            if (logStream) {
                logStream.destroy();
                logStream = null;
            }
        });

        // -------------------------------------------------------------
        // INTERACTIVE TERMINAL STREAM (xterm.js)
        // -------------------------------------------------------------
        let execStream = null;
        let execObj = null;

        socket.on('exec:start', async (data) => {
            try {
                // frontend sends container.dockerId under 'containerId' prop
                const { containerId: dockerId } = data;

                // 1. Verify Ownership / Permissions via Docker ID
                const dbContainer = await Container.findOne({ dockerId });
                if (!dbContainer || (dbContainer.userId.toString() !== socket.user.userId && socket.user.role !== 'admin')) {
                    socket.emit('exec:output', '\r\n\x1b[31mForbidden: You do not own this container or it does not exist.\x1b[0m\r\n');
                    return;
                }

                const container = docker.getContainer(dockerId);

                // 2. Create Exec Instance
                execObj = await container.exec({
                    Cmd: ['/bin/sh', '-c', '([ -x /bin/bash ] && /bin/bash) || /bin/sh'],
                    AttachStdin: true,
                    AttachStdout: true,
                    AttachStderr: true,
                    Tty: true
                });

                // 3. Start Stream
                execStream = await execObj.start({ hijack: true, stdin: true });

                socket.emit('exec:ready');

                // Multiplex the chunk directly back to xterm frontend
                execStream.on('data', (chunk) => {
                    socket.emit('exec:output', chunk.toString('utf8'));
                });

                execStream.on('end', () => {
                    socket.emit('exec:output', '\r\n\x1b[31m[Session ended]\x1b[0m\r\n');
                });

            } catch (e) {
                console.error('[Terminal Error]', e);
                socket.emit('exec:output', `\r\n\x1b[31mError starting terminal: ${e.message}\x1b[0m\r\n`);
            }
        });

        socket.on('exec:input', (data) => {
            if (execStream) {
                execStream.write(data);
            }
        });

        socket.on('exec:resize', async (data) => {
            if (execObj) {
                try {
                    await execObj.resize({ h: data.rows, w: data.cols });
                } catch (e) {
                    // Some old containers might panic on resize, ignore
                }
            }
        });

        // -------------------------------------------------------------
        // LIVE CONTAINER METRICS (Grafana style)
        // -------------------------------------------------------------
        let statsStream = null;

        socket.on('subscribe_stats', async (data) => {
            try {
                const { containerId: dockerId } = data;

                // 1. Verify Ownership
                const dbContainer = await Container.findOne({ dockerId });
                if (!dbContainer || (dbContainer.userId.toString() !== socket.user.userId && socket.user.role !== 'admin')) {
                    socket.emit('stats_error', 'Forbidden: You do not own this container');
                    return;
                }

                if (statsStream) {
                    statsStream.destroy();
                    statsStream = null;
                }

                const container = docker.getContainer(dockerId);

                // Get the continuous stats stream
                statsStream = await container.stats({ stream: true });

                statsStream.on('data', (chunk) => {
                    try {
                        const raw = chunk.toString('utf8');
                        // Docker can sometimes send multiple JSON objects tight together in a fast stream
                        const jsons = raw.split('\n').filter(Boolean);

                        for (const j of jsons) {
                            const stats = JSON.parse(j);

                            // CPU % calculation based on Docker CLI formula
                            let cpuPercent = 0;
                            const cpuDelta = stats.cpu_stats.cpu_usage.total_usage - (stats.precpu_stats.cpu_usage?.total_usage || 0);
                            const systemDelta = stats.cpu_stats.system_cpu_usage - (stats.precpu_stats?.system_cpu_usage || 0);

                            if (systemDelta > 0 && cpuDelta > 0) {
                                const cpus = stats.cpu_stats.online_cpus || 1;
                                cpuPercent = (cpuDelta / systemDelta) * cpus * 100.0;
                            }

                            // Memory Usage Calculation
                            let memUsage = 0;
                            let memLimit = 0;
                            let memPercent = 0;
                            if (stats.memory_stats && stats.memory_stats.usage) {
                                const cache = stats.memory_stats.stats?.cache || 0;
                                memUsage = stats.memory_stats.usage - cache;
                                memLimit = stats.memory_stats.limit;
                                memPercent = (memUsage / memLimit) * 100.0;
                            }

                            // Network I/O
                            let netRx = 0;
                            let netTx = 0;
                            if (stats.networks) {
                                Object.values(stats.networks).forEach(nw => {
                                    netRx += nw.rx_bytes;
                                    netTx += nw.tx_bytes;
                                });
                            }

                            socket.emit('stats_update', {
                                timestamp: new Date(stats.read).getTime(),
                                cpuPercent: parseFloat(cpuPercent.toFixed(2)),
                                memUsageBytes: memUsage,
                                memLimitBytes: memLimit,
                                memPercent: parseFloat(memPercent.toFixed(2)),
                                netRxBytes: netRx,
                                netTxBytes: netTx
                            });
                        }
                    } catch (err) {
                        // ignore malformed chunk parses, stream continues
                    }
                });

                statsStream.on('error', (err) => {
                    console.error('[Stats Stream Error]', err);
                });

            } catch (err) {
                console.error('[WebSocket Stats Error]', err);
                socket.emit('stats_error', `Failed to attach to stats: ${err.message}`);
            }
        });

        socket.on('unsubscribe_stats', () => {
            if (statsStream) {
                statsStream.destroy();
                statsStream = null;
            }
        });

        // -------------------------------------------------------------
        // GENERAL CLEANUP
        // -------------------------------------------------------------
        socket.on('disconnect', () => {
            console.log(`[WebSocket] Client disconnected: ${socket.id}`);
            if (logStream) {
                logStream.destroy();
                logStream = null;
            }
            if (execStream) {
                execStream.end();
                execStream = null;
            }
            if (statsStream) {
                statsStream.destroy();
                statsStream = null;
            }
        });
    });
};

export const getIo = () => {
    if (!ioInstance) {
        throw new Error("Socket.io not initialized!");
    }
    return ioInstance;
};
