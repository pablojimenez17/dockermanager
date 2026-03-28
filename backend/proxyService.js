import Docker from 'dockerode';

// Use the socket proxy defined in docker-compose.yml
export const docker = new Docker(
  process.env.DOCKER_HOST 
    ? { host: process.env.DOCKER_HOST.split('://')[1].split(':')[0], port: process.env.DOCKER_HOST.split(':').pop() }
    : { socketPath: process.platform === 'win32' ? '//./pipe/docker_engine' : '/var/run/docker.sock' }
);

export const initProxyService = async () => {
    // In the new architecture, Traefik is statically managed by docker-compose.
    // We only verify it is running.
    try {
        console.log('[ProxyService] Checking for existing Traefik proxy managed by compose...');
        const containers = await docker.listContainers({ all: true });
        const traefikExists = containers.find(c => c.Names.includes('/dockermanager-proxy'));

        if (traefikExists && traefikExists.State === 'running') {
            console.log('[ProxyService] Traefik proxy is running statically.');
        } else {
            console.warn('[ProxyService] Traefik proxy not found or stopped. Ensure docker-compose is running properly.');
        }
    } catch (error) {
        console.error('[ProxyService] Failed to initialize/verify Traefik proxy:', error.message);
    }
};
