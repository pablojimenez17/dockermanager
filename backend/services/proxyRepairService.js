import Docker from 'dockerode';
import Container from '../models/Container.js';

const docker = new Docker(
    process.env.DOCKER_HOST
        ? { host: process.env.DOCKER_HOST.split('://')[1].split(':')[0], port: process.env.DOCKER_HOST.split(':').pop() }
        : { socketPath: process.platform === 'win32' ? '//./pipe/docker_engine' : '/var/run/docker.sock' }
);

/**
 * On every backend startup, scan all public containers in the DB and ensure
 * the public Traefik proxy (dockermanager-proxy) is connected to their VPC network.
 *
 * This auto-repairs Bad Gateway issues for containers deployed before the exact-match
 * fix was applied, and for any container whose proxy attachment failed silently.
 */
export const repairProxyNetworks = async () => {
    try {
        console.log('[ProxyRepair] Scanning public containers for proxy connectivity...');

        // 1. Find the public proxy by exact name match
        const allContainers = await docker.listContainers({ all: false });
        const proxyContainer = allContainers.find(c => c.Names.includes('/dockermanager-proxy'));
        if (!proxyContainer) {
            console.warn('[ProxyRepair] dockermanager-proxy not found. Skipping repair.');
            return;
        }
        const proxyId = proxyContainer.Id;

        // 2. Get all containers that have a public domain assigned
        const publicContainers = await Container.find({
            domain: { $exists: true, $ne: null, $ne: '' },
            isPublic: true
        }).lean();

        if (publicContainers.length === 0) {
            console.log('[ProxyRepair] No public containers found. Nothing to repair.');
            return;
        }

        // 3. For each public container, find its Docker network and ensure proxy is on it
        const repairedNetworks = new Set();

        for (const dbContainer of publicContainers) {
            try {
                const dc = docker.getContainer(dbContainer.dockerId);
                const info = await dc.inspect();

                // Get all networks the container is connected to
                const containerNetworks = Object.keys(info.NetworkSettings.Networks || {});

                for (const netName of containerNetworks) {
                    // Skip system/default networks — only care about user VPC networks
                    if (['bridge', 'host', 'none', 'dmz_net', 'dockermanager_dmz_net'].includes(netName)) continue;
                    if (repairedNetworks.has(netName)) continue; // already fixed in this run

                    const network = docker.getNetwork(netName);
                    const netInfo = await network.inspect();
                    const alreadyConnected = Object.keys(netInfo.Containers || {}).includes(proxyId);

                    if (!alreadyConnected) {
                        console.log(`[ProxyRepair] Attaching proxy to ${netName} (container: ${dbContainer.name})`);
                        await network.connect({ Container: proxyId });
                        repairedNetworks.add(netName);
                    } else {
                        repairedNetworks.add(netName); // mark as verified
                    }
                }
            } catch (err) {
                if (err.statusCode === 404) {
                    // Container no longer exists in Docker — skip silently
                    continue;
                }
                console.warn(`[ProxyRepair] Error checking container ${dbContainer.name}:`, err.message);
            }
        }

        if (repairedNetworks.size > 0) {
            console.log(`[ProxyRepair] Done. Verified/repaired ${repairedNetworks.size} network(s): ${[...repairedNetworks].join(', ')}`);
        } else {
            console.log('[ProxyRepair] All proxy network connections are healthy.');
        }

    } catch (err) {
        // Non-fatal: if Docker is not reachable yet, skip silently
        console.warn('[ProxyRepair] Could not complete proxy network repair:', err.message);
    }
};
