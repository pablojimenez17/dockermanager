import { Server } from 'socket.io';
import Docker from 'dockerode';

const docker = new Docker({ socketPath: process.platform === 'win32' ? '//./pipe/docker_engine' : '/var/run/docker.sock' });

export const setupSockets = (server) => {
    const io = new Server(server, {
        cors: {
            origin: '*', // Adjust in production
            methods: ['GET', 'POST']
        }
    });

    // --- Global Docker Event Listener ---
    docker.getEvents({
        filters: { type: ['container'] }
    }, (err, stream) => {
        if (err) {
            console.error('[Socket] Failed to attach to Docker events:', err.message);
            return;
        }

        stream.on('data', (chunk) => {
            try {
                // Docker events can sometimes arrive chunked together
                const lines = chunk.toString('utf8').trim().split('\n');

                lines.forEach(line => {
                    if (!line) return;
                    const event = JSON.parse(line);

                    const actionableEvents = ['start', 'die', 'stop', 'pause', 'unpause'];

                    if (event.Type === 'container' && actionableEvents.includes(event.Action)) {
                        const newStatus = event.Action === 'die' || event.Action === 'stop' ? 'stopped' :
                            event.Action === 'start' || event.Action === 'unpause' ? 'running' :
                                event.Action;

                        console.log(`[Socket] Broadcasting state change: ${event.id.substring(0, 12)} -> ${newStatus}`);

                        // Broadcast globally to all connected React clients
                        io.emit('container:status_change', {
                            dockerId: event.id,
                            status: newStatus
                        });
                    }
                });
            } catch (e) {
                console.error('[Socket] Error parsing Docker event chunk:', e.message);
            }
        });

        stream.on('end', () => console.log('[Socket] Docker event stream ended'));
    });
    // ------------------------------------

    io.on('connection', (socket) => {
        console.log(`[Socket] Client connected: ${socket.id}`);

        let execStream = null;

        // Listen for requests to start a terminal
        socket.on('exec:start', async ({ containerId }) => {
            console.log(`[Socket] Client requested terminal for container: ${containerId}`);
            try {
                const container = docker.getContainer(containerId);

                // Create an exec instance
                const exec = await container.exec({
                    Cmd: ['/bin/sh', '-c', 'if command -v bash >/dev/null 2>&1; then exec bash; else exec sh; fi'],
                    AttachStdin: true,
                    AttachStdout: true,
                    AttachStderr: true,
                    Tty: true
                });

                // Start the exec instance
                execStream = await exec.start({
                    hijack: true,
                    stdin: true
                });

                // When Docker sends data, send it to the client
                execStream.on('data', (chunk) => {
                    socket.emit('exec:output', chunk.toString('utf-8'));
                });

                execStream.on('end', () => {
                    console.log(`[Socket] Exec stream ended for ${containerId}`);
                    socket.emit('exec:output', '\r\n[Disconnected from terminal]\r\n');
                });

                // Set up resize handler if the frontend sends resizing events
                socket.on('exec:resize', async ({ cols, rows }) => {
                    try {
                        await exec.resize({ h: rows, w: cols });
                    } catch (e) {
                        console.log('Resize error:', e.message);
                    }
                });

                socket.emit('exec:ready');
                console.log(`[Socket] Terminal attached for ${containerId}`);

            } catch (error) {
                console.error(`[Socket] Error attaching terminal:`, error);
                socket.emit('exec:output', `\r\n[Error starting terminal: ${error.message}]\r\n`);
            }
        });

        // Listen for user typing in the frontend terminal
        socket.on('exec:input', (data) => {
            if (execStream) {
                execStream.write(data);
            }
        });

        socket.on('disconnect', () => {
            console.log(`[Socket] Client disconnected: ${socket.id}`);
            if (execStream) {
                execStream.end();
            }
        });
    });
};
