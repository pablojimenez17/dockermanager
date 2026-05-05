import express from 'express';
import Docker from 'dockerode';
import Container from '../models/Container.js';
import User from '../models/User.js';
import Secret, { decrypt } from '../models/Secret.js';
import Registry, { decrypt as decryptRegistry } from '../models/Registry.js';
import AuditLog from '../models/AuditLog.js';
import Snapshot from '../models/Snapshot.js'; // Added this line
import authMiddleware from '../middleware/auth.js';
import { checkPermission } from '../middleware/rbac.js';
import path from 'path';
import fs from 'fs';

const router = express.Router();
// Use Dockerode connected to local socket
const docker = new Docker(process.env.DOCKER_HOST ? { host: process.env.DOCKER_HOST.split(':')[1].replace('//', ''), port: process.env.DOCKER_HOST.split(':').pop() } : { socketPath: process.platform === 'win32' ? '//./pipe/docker_engine' : '/var/run/docker.sock' });

router.use(authMiddleware);

// ============================================================
// VPC ISOLATION HELPERS
// ============================================================

/**
 * Ensures a user's isolated VPC network exists.
 * Docker does NOT allow changing the Internal flag of an existing network.
 * To avoid bugs, we maintain TWO permanent sibling networks per user:
 *   - {userId}_default_vlan        → Internal:true  (no internet egress, private)
 *   - {userId}_default_vlan_open   → Internal:false (internet allowed)
 * The correct one is chosen at deploy time based on enableInternet.
 * Returns the Docker network name.
 */
const ensureUserVpc = async (userId, suffix = 'default_vlan', enableInternet = false) => {
    const networkName = `${userId}_${suffix}`;
    try {
        const nets = await docker.listNetworks({ filters: { name: [networkName] } });
        const exactMatch = nets.find(n => n.Name === networkName);
        if (!exactMatch) {
            console.log(`[VPC] Creating VPC network: ${networkName} (internal=${!enableInternet})`);
            await docker.createNetwork({
                Name: networkName,
                Driver: 'bridge',
                Internal: !enableInternet, // true = no internet egress
                Labels: {
                    'dockermanager.vpc': 'true',
                    'dockermanager.owner': userId.toString(),
                    'dockermanager.internet': enableInternet ? 'true' : 'false',
                }
            });
        } else {
            // Verify the network's Internal flag matches what we expect.
            // If there's a mismatch (e.g. network was created with wrong flag),
            // log a warning — we cannot fix it without recreating the network.
            const expectedInternal = !enableInternet;
            if (exactMatch.Internal !== expectedInternal) {
                console.warn(`[VPC] Network ${networkName} exists with Internal=${exactMatch.Internal} but expected Internal=${expectedInternal}. ` +
                    `This may cause internet access issues. Consider deleting the network and recreating it.`);
            }
        }
    } catch (err) {
        console.error(`[VPC] Failed to ensure VPC network ${networkName}:`, err.message);
        throw err;
    }
    return networkName;
};

/**
 * Lazily attaches the lan-proxy container to a user VPC network so
 * Traefik can reach the user's container. Safe to call multiple times.
 */
const attachProxyToVpc = async (networkName) => {
    try {
        const containers = await docker.listContainers({
            filters: { name: ['dockermanager-lan-proxy'] }
        });
        if (containers.length === 0) {
            console.warn('[VPC] lan-proxy not found, skipping proxy attach.');
            return;
        }
        const proxyId = containers[0].Id;
        const network = docker.getNetwork(networkName);
        const netInfo = await network.inspect();
        const alreadyConnected = Object.keys(netInfo.Containers || {}).includes(proxyId);
        if (!alreadyConnected) {
            console.log(`[VPC] Attaching lan-proxy to ${networkName} for domain routing`);
            await network.connect({ Container: proxyId });
        }
    } catch (err) {
        console.warn(`[VPC] Could not attach lan-proxy to ${networkName}:`, err.message);
    }
};
// ============================================================

/**
 * Prunes orphaned VPC networks belonging to a user.
 * A VPC network is prunable when:
 *   - It was created by DockerManager (has dockermanager.vpc label)
 *   - It belongs to this user (dockermanager.owner matches)
 *   - It has NO containers connected (besides possibly the lan-proxy)
 */
const pruneOrphanedVpcNetworks = async (userId) => {
    try {
        const nets = await docker.listNetworks({
            filters: { label: [`dockermanager.vpc=true`, `dockermanager.owner=${userId}`] }
        });

        for (const netInfo of nets) {
            try {
                const network = docker.getNetwork(netInfo.Id);
                const details = await network.inspect();

                // Count non-proxy containers on this network
                const containers = Object.values(details.Containers || {});
                const userContainers = containers.filter(
                    c => !c.Name.includes('lan-proxy')
                );

                if (userContainers.length === 0) {
                    // Detach lan-proxy first if it's the only remaining member
                    for (const c of containers) {
                        if (c.Name.includes('lan-proxy')) {
                            try {
                                await network.disconnect({ Container: c.Name, Force: true });
                            } catch (_) { /* ignore */ }
                        }
                    }
                    await network.remove();
                    console.log(`[VPC Reaper] Removed orphaned network: ${netInfo.Name}`);
                }
            } catch (e) {
                if (e.statusCode !== 404) {
                    console.warn(`[VPC Reaper] Could not prune network ${netInfo.Name}:`, e.message);
                }
            }
        }
    } catch (err) {
        console.warn('[VPC Reaper] Error during network prune:', err.message);
    }
};
// ============================================================

// Helper to wait for image download fully before creating containers
const pullImageSync = (image, authconfig = null) => {
    return new Promise((resolve, reject) => {
        const onStream = (err, stream) => {
            if (err) return reject(err);
            docker.modem.followProgress(
                stream,
                (err2, output) => {
                    if (err2) return reject(err2);
                    // dockerode followProgress may resolve cleanly even if an error occurred in the stream
                    // We must check the last output objects for an 'error' property
                    if (output && output.length > 0) {
                        const lastEvent = output[output.length - 1];
                        if (lastEvent.error) {
                            return reject(new Error(`Docker pull failed: ${lastEvent.error}`));
                        }
                    }
                    resolve(output);
                },
                () => { } // onProgress (required, avoid crash)
            );
        };
        // IMPORTANT: do NOT pass empty {} opts — dockerode on Windows breaks silently
        if (authconfig) {
            docker.pull(image, { authconfig }, onStream);
        } else {
            docker.pull(image, onStream);
        }
    });
};

// Docker Desktop on Windows has a race condition: image may not be immediately
// available after pull completes. This helper retries inspect until confirmed.
const waitForImage = async (imageName, maxRetries = 10, delayMs = 2000) => {
    for (let i = 0; i < maxRetries; i++) {
        try {
            await docker.getImage(imageName).inspect();
            return true;
        } catch (_) {
            console.log(`[TEMPLATE] Waiting for image ${imageName} to become available... (${i + 1}/${maxRetries})`);
            await new Promise(r => setTimeout(r, delayMs));
        }
    }
    throw new Error(`Image ${imageName} not available after pull. Docker may need more time.`);
};

// Helper to dynamically resolve registry authentication for private pulls
const resolveRegistryAuth = async (image, userId) => {
    let authconfig = null;
    const imageParts = image.split('/');
    if (imageParts.length > 1) {
        let potentialRegistryUrl = imageParts[0]; // e.g., ghcr.io

        // Handle DockerHub edge cases where user inputs `myusername/myrepo:latest` instead of `docker.io/myusername/myrepo`
        if (!potentialRegistryUrl.includes('.')) {
            potentialRegistryUrl = 'index.docker.io/v1/'; // standard docker hub api
        }

        try {
            // Find a registry entry matching the URL (case insensitive)
            const registryDoc = await Registry.findOne({
                userId,
                url: { $regex: new RegExp(potentialRegistryUrl, 'i') }
            });

            if (registryDoc) {
                authconfig = {
                    username: registryDoc.username,
                    password: decryptRegistry(registryDoc.encryptedPassword, registryDoc.iv),
                    serveraddress: registryDoc.url
                };
                console.log(`[DEBUG] Found encrypted private registry credentials for ${registryDoc.url}`);
            }
        } catch (e) {
            console.error("[ERROR] Failed to fetch private registry config:", e);
        }
    }
    return authconfig;
};

// Get all containers for the logged-in user or organization
router.get('/', async (req, res) => {
    try {
        const query = req.organization
            ? { organizationId: req.organization._id }
            : { userId: req.user.userId, organizationId: { $exists: false } };

        const userContainers = await Container.find(query);

        // Enrich with actual docker status
        const enrichedContainers = await Promise.all(userContainers.map(async (c) => {
            try {
                const dockerContainer = docker.getContainer(c.dockerId);
                const info = await dockerContainer.inspect();
                return {
                    ...c.toObject(),
                    state: info.State.Status,
                    ports: info.NetworkSettings.Ports,
                    hostConfig: {
                        Memory: info.HostConfig.Memory || 0,
                        NanoCPUs: info.HostConfig.NanoCPUs || 0
                    }
                };
            } catch (err) {
                if (err.statusCode === 404) {
                    // Container was removed outside the app, silently clean up DB
                    await Container.deleteOne({ _id: c._id });
                    return null;
                }
                return { ...c.toObject(), state: 'error/not_found' };
            }
        }));

        res.json(enrichedContainers.filter(c => c !== null));
    } catch (error) {
        res.status(500).json({ message: 'Error retrieving containers', error: error.message });
    }
});

// Create a new container stack
router.post('/', checkPermission('manageContainers'), async (req, res) => {
    try {
        const { stack } = req.body;

        if (!stack || !Array.isArray(stack) || stack.length === 0) {
            return res.status(400).json({ message: 'A valid stack array is required' });
        }

        const ownerId = req.organization ? req.organization.ownerId : req.user.userId;

        // ==========================================
        // QUOTA VALIDATION
        // ==========================================
        const user = await User.findById(ownerId);
        const limits = user.limits || { maxContainers: 2, maxRamMb: 1024, maxCpuCores: 1, maxDomains: 0, maxVolumes: 1, maxVolumeSizeMb: 1024 };

        const queryConstraint = req.organization
            ? { organizationId: req.organization._id }
            : { userId: ownerId, organizationId: { $exists: false } };

        // 1. Check Container Count Limits
        const currentContainersDb = await Container.find(queryConstraint);
        if (currentContainersDb.length + stack.length > limits.maxContainers) {
            return res.status(403).json({
                message: `Quota Exceeded: Your plan limits you to ${limits.maxContainers} containers. You currently have ${currentContainersDb.length} and are trying to add ${stack.length}.`
            });
        }

        // 2. Assess requested RAM vs Limit
        // We use thin-provisioning: Memory is just a ceiling, MemoryReservation (10%) is what's truly reserved.
        // Quota is tracked against the soft reservation so users can set high ceilings without hitting plan limits.
        let requestedRamMb = 0;
        let requestedDomainsCount = 0;

        stack.forEach(c => {
            // Count the soft reservation (10% of declared limit) for quota purposes.
            // If no memory is declared, assume a 512 MB ceiling → 51 MB soft reservation.
            const declaredMb = c.memory ? parseInt(c.memory) : 512;
            requestedRamMb += Math.ceil(declaredMb * 0.1);
            if (c.domain) requestedDomainsCount++;
        });

        // 3. Domain limits
        const currentDomainsDb = currentContainersDb.filter(c => c.domain && c.domain.trim() !== '');
        if (currentDomainsDb.length + requestedDomainsCount > limits.maxDomains) {
            return res.status(403).json({
                message: `Quota Exceeded: Your plan limits you to ${limits.maxDomains} custom domains. You have ${currentDomainsDb.length} active and requested ${requestedDomainsCount} more.`
            });
        }

        // Sum current SOFT-RESERVED RAM (MemoryReservation) across existing containers.
        // This reflects actual pre-allocated memory, not the hard ceiling.
        let currentAllocatedRamBytes = 0;
        for (const c of currentContainersDb) {
            try {
                const info = await docker.getContainer(c.dockerId).inspect();
                // Prefer MemoryReservation (soft limit); fall back to 10% of Memory hard limit; then 0
                const reservation = info.HostConfig.MemoryReservation || Math.floor((info.HostConfig.Memory || 0) * 0.1);
                currentAllocatedRamBytes += reservation;
            } catch (e) {
                // container might be missing, ignore
            }
        }

        const currentAllocatedRamMb = currentAllocatedRamBytes / (1024 * 1024);
        if (currentAllocatedRamMb + requestedRamMb > limits.maxRamMb) {
            return res.status(403).json({
                message: `Quota Exceeded: Your plan limits you to ${limits.maxRamMb} MB of RAM (soft reservation). You have ${Math.round(currentAllocatedRamMb)} MB reserved, and this deployment requires ${requestedRamMb} MB more.`
            });
        }
        // ==========================================

        // ── VPC: Ensure the user's default isolated network exists ──────────
        const userVpcName = await ensureUserVpc(ownerId);

        // For multi-container stacks create a dedicated internal stack bridge
        // so all nodes in the same template see each other by name, but still
        // cannot escape to the internet.
        let networkName = null;
        if (stack.length > 1) {
            const stackSuffix = `stack_${Math.random().toString(36).substring(7)}_net`;
            networkName = await ensureUserVpc(ownerId, stackSuffix);
        }

        const createdRecords = [];

        console.log(`[DEBUG] Attempting to create stack of length ${stack.length} `);

        // Deploy sequentially to respect implicit dependencies
        for (const config of stack) {
            console.log(`[DEBUG] Processing config for image: ${config.image} `);
            const { name, image, env, ports, memory, cpu, restartPolicy, networkMode, ipv4Address, domain, domainPort, volumeName, volumeMountPath } = config;

            // Ensure image exists or pull it using private registry if available
            try {
                let imageExists = false;
                try {
                    await docker.getImage(image).inspect();
                    imageExists = true;
                } catch (_) { }

                if (!imageExists) {
                    const authconfig = await resolveRegistryAuth(image, ownerId);
                    console.log(`[DEBUG] Pulling ${image}...`);
                    await pullImageSync(image, authconfig);
                }

                // Crucial for Docker Desktop on Windows: Wait for image to be indexed
                await waitForImage(image);
            } catch (err) {
                console.warn(`[DEBUG] Pull failed for ${image}: ${err.message}`);
                // Throw so the API aborts and returns a 400/500 to the frontend with the real reason
                throw new Error(`Failed to pull image ${image}: ${err.message}`);
            }

            const instanceName = name;
            console.log(`[DEBUG] Spawning ${name} -> ${instanceName}`);

            // Prepare port bindings
            const PortBindings = {};
            const ExposedPorts = {};
            if (ports && ports.length > 0) {
                ports.forEach(p => {
                    const [hostPort, containerPort] = p.split(':');
                    if (hostPort && containerPort) {
                        PortBindings[`${containerPort}/tcp`] = [{ HostPort: hostPort }];
                        ExposedPorts[`${containerPort}/tcp`] = {};
                    }
                });
            }

            // --- Secret Manager Interception ---
            const finalEnv = [];
            if (env && env.length > 0) {
                for (let envStr of env) {
                    const secretMatch = envStr.match(/^(.*?)=\{\{SECRET:(.*?)\}\}$/);
                    if (secretMatch) {
                        const envKey = secretMatch[1];
                        const secretName = secretMatch[2];
                        try {
                            const secretQuery = req.organization
                                ? { organizationId: req.organization._id, name: secretName }
                                : { userId: ownerId, organizationId: { $exists: false }, name: secretName };
                            const secretDoc = await Secret.findOne(secretQuery);
                            if (secretDoc) {
                                const decryptedValue = decrypt(secretDoc.encryptedValue, secretDoc.iv);
                                finalEnv.push(`${envKey}=${decryptedValue}`);
                            } else {
                                console.warn(`Secret ${secretName} not found for user. Skipping injection.`);
                            }
                        } catch (err) {
                            console.error(`Error decrypting secret ${secretName}:`, err);
                        }
                    } else {
                        finalEnv.push(envStr); // raw env value
                    }
                }
            }
            // -----------------------------------

            // ── VPC Network Resolution ────────────────────────────────────────
            // 'none' is preserved as-is (air-gapped container)
            // Everything else is redirected to the user's private VPC
            let safeNetworkMode;
            const enableInternet = config.enableInternet === true;

            if (networkMode === 'none') {
                // Air-gapped: no network at all
                safeNetworkMode = 'none';

            } else if (networkName) {
                // Multi-container stack: use dedicated internal stack network
                safeNetworkMode = networkName;

            } else if (networkMode && networkMode !== 'bridge' && networkMode !== 'lan_net' && networkMode !== 'dockermanager_lan_net') {
                // User explicitly picked one of their own custom networks.
                // Docker does NOT allow changing the Internal flag of an existing network.
                // Strategy: if internet is requested, use/create a '_open' sibling of that network.
                //           if private, use the network as-is.
                if (enableInternet) {
                    const baseName = networkMode.endsWith('_open')
                        ? networkMode.slice(0, -5) // strip existing _open to get base
                        : networkMode;
                    const openSuffix = `${baseName}_open`.replace(`${ownerId}_`, '');
                    safeNetworkMode = await ensureUserVpc(ownerId, openSuffix, true);
                } else {
                    safeNetworkMode = networkMode;
                }

            } else {
                // Default / bridge / lan_net → redirect to user's private VPC.
                // IMPORTANT: We use two separate permanent networks to avoid the Docker
                // limitation of not being able to change Internal flag on existing networks:
                //   - default_vlan      → Internal:true  (isolated, no internet)
                //   - default_vlan_open → Internal:false (internet allowed)
                if (enableInternet) {
                    safeNetworkMode = await ensureUserVpc(ownerId, 'default_vlan_open', true);
                } else {
                    safeNetworkMode = userVpcName; // always Internal:true
                }
            }
            console.log(`[VPC] Container '${name}' will use network: ${safeNetworkMode} (internet=${enableInternet})`);

            // Expose domain port if not otherwise exposed
            if (domain && domain.trim() !== '' && domainPort) {
                if (!PortBindings[`${domainPort}/tcp`]) {
                    ExposedPorts[`${domainPort}/tcp`] = {};
                }
            }

            // Build Advanced Host Configuration
            // Memory works like a VM dynamic disk — no pre-allocation:
            //   - Memory: hard ceiling enforced by cgroup only when actually reached (no upfront reservation)
            //   - MemorySwap: -1 disables Docker's default swap limit (Memory*2) which fails if limit > physical RAM
            const memoryBytes = memory ? parseInt(memory) * 1024 * 1024 : 0;
            const baseHostConfig = {
                PortBindings,
                ...(memoryBytes > 0 && {
                    Memory: memoryBytes,
                    MemorySwap: -1, // CRITICAL: prevents Docker from failing when Memory > physical RAM
                }),
                ...(cpu && { NanoCPUs: parseInt(parseFloat(cpu) * 1e9) }),
                ...(restartPolicy && restartPolicy !== 'no' && { RestartPolicy: { Name: restartPolicy } }),
                NetworkMode: safeNetworkMode,
                ...(volumeName && volumeMountPath && { Binds: [`${volumeName}:${volumeMountPath}`] })
            };

            const containerConfig = {
                Image: image,
                name: instanceName,
                Env: finalEnv,
                ExposedPorts,
                HostConfig: baseHostConfig,
                Labels: {}
            };

            // Inject Custom Domain (Traefik Reverse Proxy labels)
            if (domain && domain.trim() !== '' && domainPort) {
                const appId = name.replace(/[^a-zA-Z0-9]/g, ''); // Ensure safe router name
                containerConfig.Labels = {
                    'traefik.enable': 'true',
                    'traefik.constraint-label': 'lan-proxy',
                    [`traefik.http.routers.${appId}.rule`]: `Host(\`${domain.trim()}\`)`,
                    [`traefik.http.services.${appId}.loadbalancer.server.port`]: `${domainPort}`,
                    'traefik.docker.network': safeNetworkMode,
                    [`traefik.http.routers.${appId}.tls.certresolver`]: 'myresolver'
                };
            }

            // Inject custom IP if user provided one and we are on a custom network (not default bridge/host/none)
            if (ipv4Address && safeNetworkMode !== 'bridge' && safeNetworkMode !== 'host' && safeNetworkMode !== 'none') {
                containerConfig.NetworkingConfig = {
                    EndpointsConfig: {
                        [safeNetworkMode]: {
                            IPAMConfig: {
                                IPv4Address: ipv4Address
                            }
                        }
                    }
                };
            }
            // WordPress Template specific environment injection (if they used the preset)
            // If the user deployed WordPress and MySQL together via the preset:
            if (image.includes('wordpress')) {
                // Find DB in stack
                const dbConfig = stack.find(c => c.image.includes('mysql') || c.image.includes('mariadb'));
                if (dbConfig) {
                    containerConfig.Env = [
                        ...containerConfig.Env,
                        `WORDPRESS_DB_HOST=${dbConfig.name}:3306`,
                        `WORDPRESS_DB_USER=wordpress`,
                        `WORDPRESS_DB_PASSWORD=somewordpress`,
                        `WORDPRESS_DB_NAME=wordpress`
                    ];
                }
            }

            if (image.includes('mysql') && stack.some(c => c.image.includes('wordpress'))) {
                containerConfig.Env = [
                    ...containerConfig.Env,
                    `MYSQL_ROOT_PASSWORD=somewordpress`,
                    `MYSQL_DATABASE=wordpress`,
                    `MYSQL_USER=wordpress`,
                    `MYSQL_PASSWORD=somewordpress`
                ];
            }

            // Keep OS base images alive so they don't appear as "exited" instantly
            const keepsAlive = ['ubuntu', 'node', 'alpine', 'debian', 'centos', 'kalilinux/kali-rolling', 'kali'];
            if (keepsAlive.some(img => image.includes(img))) {
                containerConfig.Cmd = ['tail', '-f', '/dev/null'];
            }

            console.log(`[DEBUG] Pulling ${image}...`);
            // Create and start container
            let container;
            try {
                container = await docker.createContainer(containerConfig);
                console.log(`[DEBUG] Container created ID: ${container.id}`);

                await container.start();
                console.log(`[DEBUG] Container ${container.id} started successfully`);

                // ── VPC Proxy Attach ────────────────────────────────────────────
                // Only attach the lan-proxy if the user intends to expose a domain.
                // This is the single controlled ingress point into the user's VPC.
                if (domain && domain.trim() !== '' && domainPort && safeNetworkMode !== 'none') {
                    await attachProxyToVpc(safeNetworkMode);
                }

                // ── Extra Networks ──────────────────────────────────────────────
                // If the user selected additional networks, connect the running
                // container to each one after creation.
                // This is the Docker Compose-equivalent of multi-network membership:
                // a container can be on the private VPC (Internal:true) AND
                const extraNetworks = config.extraNetworks || [];
                for (const extraNet of extraNetworks) {
                    try {
                        // Skip if this is the same as the primary network
                        if (extraNet === safeNetworkMode) continue;

                        // Ensure the network exists. If it's 'bridge' use Docker's default.
                        let resolvedExtra = extraNet;
                        if (extraNet !== 'bridge') {
                            // Treat as a user-named network - ensure it exists (do NOT change Internal flag)
                            const existingNets = await docker.listNetworks({ filters: { name: [extraNet] } });
                            const exactMatch = existingNets.find(n => n.Name === extraNet);
                            if (!exactMatch) {
                                console.warn(`[VPC] Extra network '${extraNet}' not found, skipping.`);
                                continue;
                            }
                        }

                        console.log(`[VPC] Connecting container '${instanceName}' to extra network: ${resolvedExtra}`);
                        await docker.getNetwork(resolvedExtra).connect({ Container: container.id });
                    } catch (netErr) {
                        // Non-fatal: log and continue - don't fail the whole deployment
                        console.error(`[VPC] Failed to connect '${instanceName}' to extra network '${extraNet}':`, netErr.message);
                    }
                }

                // Save to database
                const containerData = {
                    name: instanceName,
                    image,
                    dockerId: container.id,
                    userId: req.user.userId,
                    status: 'running',
                    domain: domain && domainPort ? domain.trim() : undefined
                };
                if (req.organization) {
                    containerData.organizationId = req.organization._id;
                }

                const dbContainer = new Container(containerData);

                await dbContainer.save();
                createdRecords.push(dbContainer);
                console.log(`[DEBUG] Record saved to DB for ${instanceName}`);
            } catch (err) {
                if (container) {
                    try {
                        console.log(`[DEBUG] Cleaning up orphaned container ${container.id} after failure...`);
                        await container.remove({ force: true });
                    } catch (cleanupErr) {
                        console.error(`[ERROR] Failed to clean up orphaned container:`, cleanupErr.message);
                    }
                }
                throw err;
            }
        } // End of stack loop

        console.log(`[DEBUG] Stack creation completed successfully with ${createdRecords.length} records`);
        res.status(201).json(createdRecords);

        // Audit log
        await AuditLog.create({
            userId: req.user.userId,
            action: 'CREATE_CONTAINER',
            resourceName: req.body.stackName || 'Custom Stack',
            details: `Created ${createdRecords.length} containers`
        });

    } catch (error) {
        console.error(`[ERROR] API Exception during stack creation:`, error);
        res.status(500).json({ message: 'Error creating stack', error: error.message, stack: error.stack });
    }
});

// Stop a container
router.post('/:id/stop', checkPermission('manageContainers'), async (req, res) => {
    try {
        const query = req.organization
            ? { _id: req.params.id, organizationId: req.organization._id }
            : { _id: req.params.id, userId: req.user.userId, organizationId: { $exists: false } };

        const dbContainer = await Container.findOne(query);
        if (!dbContainer) return res.status(404).json({ message: 'Container not found' });

        const container = docker.getContainer(dbContainer.dockerId);
        await container.stop();

        dbContainer.status = 'stopped';
        await dbContainer.save();

        // Audit Log
        await AuditLog.create({
            userId: req.user.userId,
            action: 'STOP_CONTAINER',
            resourceName: dbContainer.name
        });

        res.json({ message: 'Container stopped successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error stopping container', error: error.message });
    }
});

// Start a mapped container
router.post('/:id/start', checkPermission('manageContainers'), async (req, res) => {
    try {
        const query = req.organization
            ? { _id: req.params.id, organizationId: req.organization._id }
            : { _id: req.params.id, userId: req.user.userId, organizationId: { $exists: false } };

        const dbContainer = await Container.findOne(query);
        if (!dbContainer) return res.status(404).json({ message: 'Container not found' });

        const container = docker.getContainer(dbContainer.dockerId);

        // Inspect real Docker state before acting — avoids cryptic "container already started" errors
        let info;
        try {
            info = await container.inspect();
        } catch (inspectErr) {
            if (inspectErr.statusCode === 404) {
                // Container was deleted outside the app — clean up DB record
                await Container.deleteOne({ _id: dbContainer._id });
                return res.status(404).json({ message: 'Underlying Docker container no longer exists. Record removed.' });
            }
            throw inspectErr;
        }

        const currentState = info.State.Status; // 'running' | 'exited' | 'paused' | 'created' | 'restarting' | 'dead'

        if (currentState === 'running') {
            // Already running — update DB and return success without calling start()
            dbContainer.status = 'running';
            await dbContainer.save();
            return res.json({ message: 'Container is already running' });
        }

        if (currentState === 'restarting') {
            // Docker restart loop is already active; calling start() here returns HTTP 304.
            dbContainer.status = 'restarting';
            await dbContainer.save();
            return res.json({ message: 'Container is currently restarting' });
        }

        if (currentState === 'paused') {
            await container.unpause();
        } else {
            // 'exited', 'created', 'dead' — normal start
            await container.start();
        }

        dbContainer.status = 'running';
        await dbContainer.save();

        // Audit Log
        await AuditLog.create({
            userId: req.user.userId,
            action: 'START_CONTAINER',
            resourceName: dbContainer.name
        });

        res.json({ message: 'Container started successfully' });
    } catch (error) {
        console.error('[Start Container Error]', error);
        res.status(500).json({ message: 'Error starting container', error: error.message });
    }
});

// PUT: Redeploy container (Zero-Downtime Blue/Green)
router.put('/:id/redeploy', async (req, res) => {
    try {
        const dbContainer = await Container.findOne({ _id: req.params.id, userId: req.user.userId });
        if (!dbContainer) {
            return res.status(404).json({ message: 'Container not found or you do not have permission' });
        }

        const oldDockerContainer = docker.getContainer(dbContainer.dockerId);
        let oldConfig;
        try {
            oldConfig = await oldDockerContainer.inspect();
        } catch (err) {
            return res.status(404).json({ message: 'Underlying Docker container is missing. Cannot redeploy gracefully.' });
        }

        // Pull the latest version of the image before downtime, utilizing private credentials if available
        console.log(`[Zero-Downtime] Pulling latest image for ${dbContainer.image}`);
        try {
            const ownerId = req.organization ? req.organization.ownerId : req.user.userId;
            const authconfig = await resolveRegistryAuth(dbContainer.image, ownerId);
            await pullImageSync(dbContainer.image, authconfig);
        } catch (pullErr) {
            console.warn(`[Zero-Downtime] Failed to pull latest image (might be local or private without credentials): ${pullErr.message}`);
        }

        // Prepare Green Container Config based on Blue's specs
        const greenName = `${dbContainer.name}-redeploy-${Date.now()}`;
        console.log(`[Zero-Downtime] Spawning Green Container: ${greenName}`);

        const greenConfig = {
            Image: dbContainer.image,
            name: greenName,
            Env: oldConfig.Config.Env,
            Cmd: oldConfig.Config.Cmd,
            ExposedPorts: oldConfig.Config.ExposedPorts,
            HostConfig: oldConfig.HostConfig,
            Labels: oldConfig.Config.Labels,
            NetworkingConfig: {}
        };

        // Reconnect to exact same networks
        if (oldConfig.NetworkSettings && oldConfig.NetworkSettings.Networks) {
            greenConfig.NetworkingConfig.EndpointsConfig = oldConfig.NetworkSettings.Networks;
        }

        const greenContainer = await docker.createContainer(greenConfig);
        await greenContainer.start();

        console.log(`[Zero-Downtime] Green Container ${greenContainer.id} started. Waiting 3 seconds for Traefik routing to apply & Healthchecks...`);

        // Give time for the container to boot up and Traefik to register the dynamic labels
        await new Promise(resolve => setTimeout(resolve, 3000));

        console.log(`[Zero-Downtime] Stopping and removing Blue Container ${oldDockerContainer.id}`);
        // Terminate Blue Container
        try {
            await oldDockerContainer.stop();
        } catch (e) { } // ignore already stopped
        await oldDockerContainer.remove();

        // Update DB Record to point to Green
        dbContainer.dockerId = greenContainer.id;
        dbContainer.name = greenName; // Optional: Update the name, or keep it logical. If we update, next redeploy uses the new name.
        await dbContainer.save();

        await AuditLog.create({
            userId: req.user.userId,
            action: 'CREATE_CONTAINER', // Logged as creation/update
            resourceName: dbContainer.name,
            details: `Zero-Downtime Redeploy successful for ${dbContainer.image}`
        });

        res.json({ message: 'Zero-Downtime Redeployment successful', container: dbContainer });

    } catch (error) {
        console.error('[Zero-Downtime Error]', error);
        res.status(500).json({ message: 'Error attempting zero-downtime redeploy', error: error.message });
    }
});

// PUT: Edit container configuration (e.g. Expose to internet)
router.put('/:id/edit', checkPermission('manageContainers'), async (req, res) => {
    try {
        const { domain, domainPort } = req.body;

        const query = req.organization
            ? { _id: req.params.id, organizationId: req.organization._id }
            : { _id: req.params.id, userId: req.user.userId, organizationId: { $exists: false } };

        const dbContainer = await Container.findOne(query);
        if (!dbContainer) {
            return res.status(404).json({ message: 'Container not found or you do not have permission' });
        }

        const oldDockerContainer = docker.getContainer(dbContainer.dockerId);
        let oldConfig;
        try {
            oldConfig = await oldDockerContainer.inspect();
        } catch (err) {
            return res.status(404).json({ message: 'Underlying Docker container is missing. Cannot edit.' });
        }

        console.log(`[Edit Container] Recreating ${dbContainer.name} to apply new settings`);

        // Prepare New Container Config based on old specs
        const newName = `${dbContainer.name}-edited-${Date.now()}`;

        let newLabels = oldConfig.Config.Labels || {};
        const appId = dbContainer.name.replace(/[^a-zA-Z0-9]/g, '');

        if (domain && domainPort) {
            newLabels = {
                ...newLabels,
                'traefik.enable': 'true',
                'traefik.constraint-label': 'lan-proxy',
                [`traefik.http.routers.${appId}.rule`]: `Host(\`${domain.trim()}\`)`,
                [`traefik.http.services.${appId}.loadbalancer.server.port`]: `${domainPort}`,
                'traefik.docker.network': 'lan_net' // default assumption for new architecture
            };

            // If it had a custom network in oldConfig, use it
            if (oldConfig.NetworkSettings && oldConfig.NetworkSettings.Networks) {
                const networkNames = Object.keys(oldConfig.NetworkSettings.Networks);
                if (networkNames.length > 0) {
                    newLabels['traefik.docker.network'] = networkNames[0];
                }
            }
        } else {
            // Remove traefik labels if user cleared the domain input (un-expose)
            delete newLabels['traefik.enable'];
            delete newLabels['traefik.constraint-label'];
            delete newLabels[`traefik.http.routers.${appId}.rule`];
            delete newLabels[`traefik.http.services.${appId}.loadbalancer.server.port`];
            delete newLabels['traefik.docker.network'];
        }

        const newConfig = {
            Image: dbContainer.image,
            name: newName,
            Env: oldConfig.Config.Env,
            Cmd: oldConfig.Config.Cmd,
            ExposedPorts: oldConfig.Config.ExposedPorts || {},
            HostConfig: oldConfig.HostConfig,
            Labels: newLabels,
            NetworkingConfig: {}
        };

        // If newly exposed port is not in ExposedPorts, add it
        if (domain && domainPort && !newConfig.ExposedPorts[`${domainPort}/tcp`]) {
            newConfig.ExposedPorts[`${domainPort}/tcp`] = {};
        }

        // Reconnect to exact same networks
        if (oldConfig.NetworkSettings && oldConfig.NetworkSettings.Networks) {
            newConfig.NetworkingConfig.EndpointsConfig = oldConfig.NetworkSettings.Networks;
        }

        const newContainer = await docker.createContainer(newConfig);
        await newContainer.start();

        console.log(`[Edit Container] New Container ${newContainer.id} started. Waiting for Traefik...`);
        await new Promise(resolve => setTimeout(resolve, 2000));

        console.log(`[Edit Container] Stopping and removing Old Container ${oldDockerContainer.id}`);
        try {
            await oldDockerContainer.stop();
        } catch (e) { } // ignore
        await oldDockerContainer.remove();

        // Update DB Record
        dbContainer.dockerId = newContainer.id;
        dbContainer.name = newName;
        dbContainer.domain = domain && domainPort ? domain.trim() : undefined;
        await dbContainer.save();

        await AuditLog.create({
            userId: req.user.userId,
            action: 'UPDATE_CONTAINER',
            resourceName: dbContainer.name,
            details: `Updated container network/exposure configurations`
        });

        res.json({ message: 'Container updated successfully', container: dbContainer });

    } catch (error) {
        console.error('[Edit Error]', error);
        res.status(500).json({ message: 'Error editing container', error: error.message });
    }
});

// Remove a container
router.delete('/:id', checkPermission('deleteContainers'), async (req, res) => {
    try {
        const query = req.organization
            ? { _id: req.params.id, organizationId: req.organization._id }
            : { _id: req.params.id, userId: req.user.userId, organizationId: { $exists: false } };

        const dbContainer = await Container.findOne(query);
        if (!dbContainer) return res.status(404).json({ message: 'Container not found' });

        const container = docker.getContainer(dbContainer.dockerId);

        try {
            await container.inspect(); // Check if exists first

            try {
                await container.stop();
            } catch (e) {
                // ignore if already stopped
            }
            await container.remove();
        } catch (err) {
            // If the container is already gone from Docker (404), that's fine, we still want to remove our DB record.
            if (err.statusCode !== 404) {
                throw err;
            }
        }

        await Container.deleteOne({ _id: req.params.id });

        // Prune any user VPC networks that are now empty
        pruneOrphanedVpcNetworks(req.user.userId).catch(() => {});

        // Audit Log
        await AuditLog.create({
            userId: req.user.userId,
            action: 'DELETE_CONTAINER',
            resourceName: dbContainer.name
        });

        res.json({ message: 'Container removed successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error removing container', error: error.message });
    }
});

// PUT: Redeploy container (Zero-Downtime Blue/Green)
router.put('/:id/redeploy', async (req, res) => {
    try {
        const dbContainer = await Container.findOne({ _id: req.params.id, userId: req.user.userId });
        if (!dbContainer) {
            return res.status(404).json({ message: 'Container not found or you do not have permission' });
        }

        const oldDockerContainer = docker.getContainer(dbContainer.dockerId);
        let oldConfig;
        try {
            oldConfig = await oldDockerContainer.inspect();
        } catch (err) {
            return res.status(404).json({ message: 'Underlying Docker container is missing. Cannot redeploy gracefully.' });
        }

        // Pull the latest version of the image before downtime
        console.log(`[Zero-Downtime] Pulling latest image for ${dbContainer.image}`);
        try {
            const authconfig = await resolveRegistryAuth(dbContainer.image, req.user.userId);
            await pullImageSync(dbContainer.image, authconfig);
        } catch (pullErr) {
            console.warn(`[Zero-Downtime] Failed to pull latest image (might be local or private): ${pullErr.message}`);
        }

        // Prepare Green Container Config based on Blue's specs
        const greenName = `${dbContainer.name}-redeploy-${Date.now()}`;
        console.log(`[Zero-Downtime] Spawning Green Container: ${greenName}`);

        const greenConfig = {
            Image: dbContainer.image,
            name: greenName,
            Env: oldConfig.Config.Env,
            Cmd: oldConfig.Config.Cmd,
            ExposedPorts: oldConfig.Config.ExposedPorts,
            HostConfig: oldConfig.HostConfig,
            Labels: oldConfig.Config.Labels,
            NetworkingConfig: {}
        };

        // Reconnect to exact same networks
        if (oldConfig.NetworkSettings && oldConfig.NetworkSettings.Networks) {
            greenConfig.NetworkingConfig.EndpointsConfig = oldConfig.NetworkSettings.Networks;
        }

        const greenContainer = await docker.createContainer(greenConfig);
        await greenContainer.start();

        console.log(`[Zero-Downtime] Green Container ${greenContainer.id} started. Waiting 3 seconds for Traefik routing to apply & Healthchecks...`);

        // Give time for the container to boot up and Traefik to register the dynamic labels
        await new Promise(resolve => setTimeout(resolve, 3000));

        console.log(`[Zero-Downtime] Stopping and removing Blue Container ${oldDockerContainer.id}`);
        // Terminate Blue Container
        try {
            await oldDockerContainer.stop();
        } catch (e) { } // ignore already stopped
        await oldDockerContainer.remove();

        // Update DB Record to point to Green
        dbContainer.dockerId = greenContainer.id;
        dbContainer.name = greenName; // Optional: Update the name, or keep it logical. If we update, next redeploy uses the new name.
        await dbContainer.save();

        await AuditLog.create({
            userId: req.user.userId,
            action: 'CREATE_CONTAINER', // Logged as creation/update
            resourceName: dbContainer.name,
            details: `Zero-Downtime Redeploy successful for ${dbContainer.image}`
        });

        res.json({ message: 'Zero-Downtime Redeployment successful', container: dbContainer });

    } catch (error) {
        console.error('[Zero-Downtime Error]', error);
        res.status(500).json({ message: 'Error attempting zero-downtime redeploy', error: error.message });
    }
});
// Deploy a 1-Click App Template
router.post('/template', async (req, res) => {
    try {
        const { templateId, domainBase, secrets, customAppName, envInputs } = req.body;

        // 1. Find the template
        let templatesPath = path.join(process.cwd(), 'data', 'templates.json');
        if (!fs.existsSync(templatesPath)) templatesPath = path.join(process.cwd(), 'backend', 'data', 'templates.json');

        const templatesRaw = fs.readFileSync(templatesPath, 'utf8');
        const templates = JSON.parse(templatesRaw);

        const template = templates.find(t => t.id === templateId);
        if (!template) {
            return res.status(404).json({ message: 'Template not found' });
        }

        // 2. Setup a unique isolated network
        const networkName = `stack_${templateId}_${Math.random().toString(36).substring(7)}`;
        await docker.createNetwork({
            Name: networkName,
            Driver: 'bridge'
        });

        const createdRecords = [];

        // 3. Process and deploy each container in the template sequentially
        for (const containerDef of template.containers) {
            console.log(`[TEMPLATE] Processing ${containerDef.name_prefix} (image: ${containerDef.image})`);

            // Pull image – try local check first, pull if missing, then verify
            let imageExists = false;
            try {
                await docker.getImage(containerDef.image).inspect();
                imageExists = true;
                console.log(`[TEMPLATE] Image ${containerDef.image} already cached locally.`);
            } catch (_) {
                imageExists = false;
            }

            if (!imageExists) {
                console.log(`[TEMPLATE] Pulling ${containerDef.image} from registry...`);
                let authconfig = null;
                try { authconfig = await resolveRegistryAuth(containerDef.image, req.user.userId); } catch (_) { }
                await pullImageSync(containerDef.image, authconfig); // throws on failure - no silent catch
                console.log(`[TEMPLATE] Pull complete for ${containerDef.image}`);
            }

            // Verify image is actually available (Docker Desktop Windows race condition)
            await waitForImage(containerDef.image);

            let instanceName = `${containerDef.name_prefix}-${Math.random().toString(36).substring(7)}`;
            if (customAppName && customAppName.trim() !== '') {
                // If template has multiple containers, append the prefix to distinguish them
                instanceName = template.containers.length > 1
                    ? `${customAppName.trim()}-${containerDef.name_prefix}`
                    : customAppName.trim();
            }

            // Build Env - decrypt secrets from vault
            const finalEnv = [];
            if (containerDef.env) {
                for (const e of containerDef.env) {
                    if (e.type === 'secret') {
                        const secretName = secrets && secrets[e.key];
                        if (secretName) {
                            // Resolve from the Secret Manager vault
                            const secretDoc = await Secret.findOne({ userId: req.user.userId, name: secretName });
                            if (secretDoc) {
                                const decryptedVal = decrypt(secretDoc.encryptedValue, secretDoc.iv);
                                finalEnv.push(`${e.key}=${decryptedVal}`);
                            }
                        }
                    } else if (e.type === 'input' && e.key === 'url' && domainBase) {
                        finalEnv.push(`${e.key}=https://${domainBase}`);
                    } else if (e.type === 'input' && envInputs && envInputs[e.key] !== undefined) {
                        finalEnv.push(`${e.key}=${envInputs[e.key]}`);
                    } else if (e.value) {
                        finalEnv.push(`${e.key}=${e.value}`);
                    }
                }
            }

            // Expose Ports natively (mostly for databases that shouldn't be publicly routed via Traefik but exposed locally if needed, usually we don't expose them to host in prod but keep simple for now)
            const PortBindings = {};
            const ExposedPorts = {};
            if (containerDef.ports) {
                containerDef.ports.forEach(p => {
                    // Map container port to a random open host port or specific if dictated
                    if (p.host && p.container) {
                        // Normally we shouldn't map host ports blindly in a PaaS, but for local 1-clicks it's ok unless we solely rely on Traefik
                        // For safety, let's only expose to Traefik, but we'll bind for dashboard visibility
                        PortBindings[`${p.container}/tcp`] = [{ HostPort: '' }]; // random host port
                        ExposedPorts[`${p.container}/tcp`] = {};
                    }
                });
            }

            // Traefik Labels (Inject routing if it's the primary app container and domain is provided)
            let Labels = {};
            // If the container has port 80 or 2368 (web app ports) and a domain is provided, configure Traefik
            const isWebAppContainer = containerDef.ports && containerDef.ports.some(p => p.container === 80 || p.container === 2368 || p.container === 8080);

            if (isWebAppContainer && domainBase) {
                const cleanDomain = domainBase.trim().toLowerCase();
                const targetPort = containerDef.ports[0].container.toString();

                Labels = {
                    "traefik.enable": "true",
                    [`traefik.http.routers.${instanceName}.rule`]: `Host(\`${cleanDomain}\`)`,
                    [`traefik.http.routers.${instanceName}.entrypoints`]: "web",
                    [`traefik.http.services.${instanceName}.loadbalancer.server.port`]: targetPort
                };
            }

            // Volumes
            const Binds = [];
            // For PaaS templates, we use true Docker Managed Volumes (Named Volumes)
            if (containerDef.volumes) {
                for (const v of containerDef.volumes) {
                    const uniqueVolumeName = `${instanceName}_${v.hostPath}`;

                    // Explicitly create the volume to avoid Windows/Linux path issues
                    try {
                        const existingVolume = await docker.getVolume(uniqueVolumeName).inspect().catch(() => null);
                        if (!existingVolume) {
                            await docker.createVolume({
                                Name: uniqueVolumeName,
                                Driver: 'local'
                            });
                        }
                    } catch (volErr) {
                        console.warn(`[TEMPLATE] Failed to pre-create volume, it might already exist: ${volErr.message}`);
                    }

                    Binds.push(`${uniqueVolumeName}:${v.containerPath}`);
                }
            }

            const baseHostConfig = {
                PortBindings,
                NetworkMode: networkName,
                Binds,
                RestartPolicy: { Name: 'unless-stopped' }
            };

            const dockerConfig = {
                Image: containerDef.image,
                name: instanceName,
                Env: finalEnv,
                ExposedPorts,
                HostConfig: baseHostConfig,
                Labels,
                ...(containerDef.command ? { Cmd: containerDef.command } : {})
            };

            const container = await docker.createContainer(dockerConfig);
            await container.start();

            // Store in our DB
            const dbContainer = await Container.create({
                userId: req.user.userId,
                dockerId: container.id,
                name: instanceName,
                image: containerDef.image,
                domain: (isWebAppContainer && domainBase) ? domainBase : null,
                domainPort: (isWebAppContainer && domainBase) ? containerDef.ports[0].container.toString() : null,
                status: 'running',
                stackId: networkName // Group them visually later
            });

            createdRecords.push(dbContainer);

            await AuditLog.create({
                userId: req.user.userId,
                action: 'CREATE_CONTAINER',
                resourceName: instanceName,
                details: `Deployed as part of ${template.name} stack`
            });
        }

        res.status(201).json({ message: 'Template Deployed Successfully', containers: createdRecords });

    } catch (error) {
        console.error('[Template Deploy Error]', error);
        res.status(500).json({ message: 'Error deploying template', error: error.message });
    }
});

// Snapshot (Commit) a container to an image
router.post('/:id/snapshot', checkPermission('manageContainers'), async (req, res) => {
    try {
        const { id } = req.params;
        const { snapshotName } = req.body; // e.g., 'myapp-backup:v1'

        if (!snapshotName) {
            return res.status(400).json({ message: 'snapshotName is required.' });
        }

        // 1. Verify Ownership & Get limits
        const ownerId = req.organization ? req.organization.ownerId : req.user.userId;
        const user = await User.findById(ownerId);
        const maxSnapshots = user.limits?.maxSnapshots || 0;

        if (maxSnapshots === 0) {
            return res.status(403).json({ message: 'Snapshots are only available on Professional and Enterprise plans.' });
        }

        const queryConstraint = req.organization
            ? { organizationId: req.organization._id }
            : { userId: ownerId, organizationId: { $exists: false } };

        // Check current snapshot count
        const currentSnapshots = await Snapshot.countDocuments(queryConstraint);
        if (currentSnapshots >= maxSnapshots) {
            return res.status(403).json({ message: `Quota Exceeded: Your plan limits you to ${maxSnapshots} snapshots.` });
        }

        const query = req.organization
            ? { dockerId: id, organizationId: req.organization._id }
            : { dockerId: id, userId: req.user.userId, organizationId: { $exists: false } };

        const dbContainer = await Container.findOne(query);
        if (!dbContainer) {
            return res.status(404).json({ message: 'Container not found or access denied.' });
        }

        // 2. Perform Docker Commit
        const container = docker.getContainer(id);
        const commitResult = await container.commit({
            repo: snapshotName,
            comment: `Snapshot created via Docker Manager by ${user.email}`
        });

        // 3. Save to database for tracking
        const snapshotData = {
            userId: req.user.userId,
            containerId: id,
            containerName: dbContainer.name,
            snapshotName: snapshotName,
            imageId: commitResult.Id
        };
        if (req.organization) {
            snapshotData.organizationId = req.organization._id;
        }

        const newSnapshot = new Snapshot(snapshotData);
        await newSnapshot.save();

        res.json({
            message: 'Snapshot created successfully.',
            imageId: commitResult.Id,
            snapshotName
        });
    } catch (error) {
        console.error('Snapshot Error:', error);
        // Handle MongoDB duplicate key error nicely
        if (error.code === 11000) {
            return res.status(400).json({ message: 'A snapshot with this exact name already exists.' });
        }
        res.status(500).json({ message: 'Failed to create snapshot', error: error.message });
    }
});

export default router;

