import Docker from 'dockerode';

export const docker = new Docker({ socketPath: process.platform === 'win32' ? '//./pipe/docker_engine' : '/var/run/docker.sock' });

export const initProxyService = async () => {
    try {
        console.log('[ProxyService] Checking for existing Traefik proxy...');
        const containers = await docker.listContainers({ all: true });
        const traefikExists = containers.find(c => c.Names.includes('/dockermanager-proxy'));

        if (traefikExists) {
            if (traefikExists.State !== 'running') {
                console.log('[ProxyService] Found proxy but it is stopped. Starting...');
                const container = docker.getContainer(traefikExists.Id);
                await container.start();
            } else {
                console.log('[ProxyService] Traefik proxy is already running.');
            }
            return;
        }

        console.log('[ProxyService] Traefik proxy not found. Pulling image and creating...');
        await new Promise((resolve, reject) => {
            docker.pull('traefik:v2.10', (err, stream) => {
                if (err) return reject(err);
                docker.modem.followProgress(stream, (onFinishedErr, output) => {
                    if (onFinishedErr) return reject(onFinishedErr);
                    resolve(output);
                });
            });
        });

        // For Docker Desktop on Windows, the Linux VM actually provides /var/run/docker.sock 
        // to the containers seamlessly. Mounting the Windows named pipe directly into the Linux container fails.
        const socketBind = '/var/run/docker.sock:/var/run/docker.sock';
        const acmeVolume = 'dockermanager_letsencrypt:/letsencrypt';

        const proxyConfig = {
            Image: 'traefik:v2.10',
            name: 'dockermanager-proxy',
            Cmd: [
                '--api.insecure=true',
                '--providers.docker=true',
                '--providers.docker.exposedbydefault=false',
                '--entrypoints.web.address=:80',
                '--entrypoints.websecure.address=:443',
                // Let's Encrypt ACME resolver config
                '--certificatesresolvers.myresolver.acme.httpchallenge=true',
                '--certificatesresolvers.myresolver.acme.httpchallenge.entrypoint=web',
                `--certificatesresolvers.myresolver.acme.email=${process.env.ACME_EMAIL || 'admin@example.com'}`,
                '--certificatesresolvers.myresolver.acme.storage=/letsencrypt/acme.json'
            ],
            HostConfig: {
                PortBindings: {
                    '80/tcp': [{ HostPort: '80' }],
                    '443/tcp': [{ HostPort: '443' }],
                    '8080/tcp': [{ HostPort: '8080' }] // Traefik Dashboard (optional)
                },
                Binds: [socketBind, acmeVolume],
                RestartPolicy: { Name: 'always' },
                NetworkMode: 'bridge'
            }
        };

        const container = await docker.createContainer(proxyConfig);
        await container.start();
        console.log('[ProxyService] Traefik proxy created and started successfully!');

    } catch (error) {
        console.error('[ProxyService] Failed to initialize Traefik proxy:', error);
    }
};
