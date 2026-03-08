import { Server } from 'socket.io';
import Docker from 'dockerode';
import User from './models/User.js';
import Container from './models/Container.js';
import jwt from 'jsonwebtoken';

const docker = new Docker({ socketPath: process.platform === 'win32' ? '//./pipe/docker_engine' : '/var/run/docker.sock' });

export const setupSockets = (server) => {
    const io = new Server(server, {
        cors: {
            origin: 'http://localhost:5173',
            methods: ['GET', 'POST'],
            credentials: true
        }
    });

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

                // 2. Cleanup previous streams if the user switches containers without disconnecting
                if (logStream) {
                    logStream.destroy();
                    logStream = null;
                }

                socket.emit('log_stdout', `\\033[36m[*] Connected to live logs for ${dbContainer.name}...\\033[0m\r\n\r\n`);

                // 3. Attach to Docker Stream
                const container = docker.getContainer(dbContainer.dockerId);

                logStream = await container.logs({
                    follow: true,     // Keep connection open
                    stdout: true,     // Get standard output
                    stderr: true,     // Get error output
                    tail: 100         // Get last 100 lines initially
                });

                // Dockerode streams multiplex stdout and stderr, we use docker.modem to demux it
                container.modem.demuxStream(logStream,
                    {
                        write: (chunk) => {
                            // Convert NodeJS buffer to text and emit to frontend
                            socket.emit('log_stdout', chunk.toString('utf8'));
                        }
                    },
                    {
                        write: (chunk) => {
                            // Convert standard error to text
                            socket.emit('log_stderr', chunk.toString('utf8'));
                        }
                    }
                );

                logStream.on('end', () => {
                    socket.emit('log_stdout', '\r\n\\033[31m[*] Container stream closed.\\033[0m\r\n');
                });

                logStream.on('error', (err) => {
                    socket.emit('log_error', `Stream Error: ${err.message}`);
                });

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
        });
    });
};
