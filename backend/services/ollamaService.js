import Docker from 'dockerode';
import fs from 'fs';

const docker = new Docker(process.env.DOCKER_HOST ? { host: process.env.DOCKER_HOST.split(':')[1].replace('//', ''), port: process.env.DOCKER_HOST.split(':').pop() } : { socketPath: process.platform === 'win32' ? '//./pipe/docker_engine' : '/var/run/docker.sock' });

const OLLAMA_CONTAINER_NAME = 'dockermanager-ollama';
const OLLAMA_PORT = 11434;
const DEFAULT_MODEL = 'qwen2.5:0.5b';

export const initOllama = async () => {
    try {
        console.log('[Ollama Service] Checking for existing Ollama container...');

        let containerInfo = null;
        try {
            const container = docker.getContainer(OLLAMA_CONTAINER_NAME);
            containerInfo = await container.inspect();
        } catch (e) {
            // Container doesn't exist (404)
        }

        if (!containerInfo) {
            console.log('[Ollama Service] Container not found. Deploying new Ollama instance...');

            // Pull the image first
            console.log('[Ollama Service] Pulling ollama/ollama:latest...');
            await new Promise((resolve, reject) => {
                docker.pull('ollama/ollama:latest', (err, stream) => {
                    if (err) return reject(err);
                    docker.modem.followProgress(stream, (onFinishedErr) => {
                        if (onFinishedErr) return reject(onFinishedErr);
                        resolve();
                    });
                });
            });

            // Generate a secure data volume
            const volumeName = 'dockermanager-ollama-data';

            await docker.createContainer({
                Image: 'ollama/ollama:latest',
                name: OLLAMA_CONTAINER_NAME,
                HostConfig: {
                    PortBindings: {
                        '11434/tcp': [{ HostPort: '11434' }]
                    },
                    Binds: [`${volumeName}:/root/.ollama`],
                    RestartPolicy: { Name: 'unless-stopped' },
                    // Extra configuration could be added here for GPUs (e.g., DeviceRequests for NVIDIA)
                }
            }).then(container => container.start());

            console.log(`[Ollama Service] Container deployed and started via port ${OLLAMA_PORT}`);

            // Wait a few seconds for the Ollama API to boot up inside the container
            await new Promise(resolve => setTimeout(resolve, 5000));
        } else if (!containerInfo.State.Running) {
            console.log('[Ollama Service] Found stopped Ollama container. Restarting...');
            const container = docker.getContainer(OLLAMA_CONTAINER_NAME);
            await container.start();
            await new Promise(resolve => setTimeout(resolve, 3000));
        }

        // Trigger Model Pull (Ollama natively handles ensuring it doesn't re-download if it exists)
        console.log(`[Ollama Service] Pulling default LLM model: ${DEFAULT_MODEL}. This may take a few minutes if not already downloaded.`);

        try {
            // We execute the `ollama run` or `ollama pull` command inside the container 
            const container = docker.getContainer(OLLAMA_CONTAINER_NAME);
            const exec = await container.exec({
                Cmd: ['ollama', 'pull', DEFAULT_MODEL],
                AttachStdout: true,
                AttachStderr: true
            });

            await new Promise((resolve, reject) => {
                exec.start({ hijack: true, stdin: false }, (err, stream) => {
                    if (err) return reject(err);
                    stream.on('end', resolve);
                });
            });
            console.log(`[Ollama Service] Model ${DEFAULT_MODEL} is ready for use.`);
        } catch (e) {
            console.error('[Ollama Service] Warning: Failed to pull the default model automatically. You may need to run `docker exec dockermanager-ollama ollama pull llama3.2:1b` manually.', e.message);
        }

    } catch (err) {
        console.error('[Ollama Service] Initialization failed:', err.message);
        // We do not throw to avoid crashing the whole Docker Manager if Ollama fails or the user's PC can't handle it
    }
};
