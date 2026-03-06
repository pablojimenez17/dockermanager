import express from 'express';
import Docker from 'dockerode';
import Container from '../models/Container.js';
import User from '../models/User.js';
import Secret, { decrypt } from '../models/Secret.js';
import AuditLog from '../models/AuditLog.js';
import authMiddleware from '../middleware/auth.js';
import path from 'path';
import fs from 'fs';

const router = express.Router();
// Use Dockerode connected to local socket
const docker = new Docker({ socketPath: process.platform === 'win32' ? '//./pipe/docker_engine' : '/var/run/docker.sock' });

router.use(authMiddleware);

// Get all containers for the logged-in user
router.get('/', async (req, res) => {
    try {
        const userContainers = await Container.find({ userId: req.user.userId });

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
router.post('/', async (req, res) => {
    try {
        const { stack } = req.body;

        if (!stack || !Array.isArray(stack) || stack.length === 0) {
            return res.status(400).json({ message: 'A valid stack array is required' });
        }

        // ==========================================
        // QUOTA VALIDATION
        // ==========================================
        const user = await User.findById(req.user.userId);
        const limits = user.limits || { maxContainers: 2, maxRamMb: 1024, maxCpuCores: 1, maxDomains: 0, maxVolumes: 1, maxVolumeSizeMb: 1024 };

        // 1. Check Container Count Limits
        const currentContainersDb = await Container.find({ userId: req.user.userId });
        if (currentContainersDb.length + stack.length > limits.maxContainers) {
            return res.status(403).json({
                message: `Quota Exceeded: Your plan limits you to ${limits.maxContainers} containers. You currently have ${currentContainersDb.length} and are trying to add ${stack.length}.`
            });
        }

        // 2. Assess requested RAM vs Limit
        let requestedRamMb = 0;
        let requestedDomainsCount = 0;

        stack.forEach(c => {
            // If they don't specify, we assume 512MB default allocation per container for counting purposes
            requestedRamMb += c.memory ? parseInt(c.memory) : 512;
            if (c.domain) requestedDomainsCount++;
        });

        // 3. Domain limits
        const currentDomainsDb = currentContainersDb.filter(c => c.domain && c.domain.trim() !== '');
        if (currentDomainsDb.length + requestedDomainsCount > limits.maxDomains) {
            return res.status(403).json({
                message: `Quota Exceeded: Your plan limits you to ${limits.maxDomains} custom domains. You have ${currentDomainsDb.length} active and requested ${requestedDomainsCount} more.`
            });
        }

        // Sum current allocated RAM across running/existing containers
        let currentAllocatedRamBytes = 0;
        for (const c of currentContainersDb) {
            try {
                const info = await docker.getContainer(c.dockerId).inspect();
                currentAllocatedRamBytes += info.HostConfig.Memory || 0;
            } catch (e) {
                // container might be missing, ignore
            }
        }

        const currentAllocatedRamMb = currentAllocatedRamBytes / (1024 * 1024);
        if (currentAllocatedRamMb + requestedRamMb > limits.maxRamMb) {
            return res.status(403).json({
                message: `Quota Exceeded: Your plan limits you to ${limits.maxRamMb} MB of RAM. You have ${currentAllocatedRamMb} MB allocated, and this deployment requires ${requestedRamMb} MB.`
            });
        }
        // ==========================================

        // Create a custom bridge network for this stack deployment
        let networkName = null;
        if (stack.length > 1) {
            networkName = `stack_net_${Math.random().toString(36).substring(7)} `;
            await docker.createNetwork({
                Name: networkName,
                Driver: 'bridge'
            });
        }

        const createdRecords = [];

        console.log(`[DEBUG] Attempting to create stack of length ${stack.length} `);

        // Deploy sequentially to respect implicit dependencies
        for (const config of stack) {
            console.log(`[DEBUG] Processing config for image: ${config.image} `);
            const { name, image, env, ports, memory, cpu, restartPolicy, networkMode, ipv4Address, domain, domainPort, volumeName, volumeMountPath } = config;

            // Ensure image exists or pull it
            try {
                await docker.pull(image);
            } catch (err) {
                console.log(`Pull error or image exists for ${image}, trying to create anyway`, err.message);
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
                            const secretDoc = await Secret.findOne({ userId: req.user.userId, name: secretName });
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

            // Apply network settings
            let safeNetworkMode = networkMode || 'bridge';

            // If it's a multi-container stack and they left it as bridge, use the custom stack bridge
            if (networkName && safeNetworkMode === 'bridge') {
                safeNetworkMode = networkName;
            }

            // Expose domain port if not otherwise exposed
            if (domain && domain.trim() !== '' && domainPort) {
                if (!PortBindings[`${domainPort}/tcp`]) {
                    ExposedPorts[`${domainPort}/tcp`] = {};
                }
            }

            // Build Advanced Host Configuration
            const baseHostConfig = {
                PortBindings,
                ...(memory && { Memory: parseInt(memory) * 1024 * 1024 }),
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
                    [`traefik.http.routers.${appId}.rule`]: `Host(\`${domain.trim()}\`)`,
                    [`traefik.http.services.${appId}.loadbalancer.server.port`]: `${domainPort}`,
                    'traefik.docker.network': safeNetworkMode
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
            const keepsAlive = ['ubuntu', 'node', 'alpine', 'debian', 'centos'];
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

                // Save to database
                const dbContainer = new Container({
                    name: instanceName,
                    image,
                    dockerId: container.id,
                    userId: req.user.userId,
                    status: 'running',
                    domain: domain && domainPort ? domain.trim() : undefined
                });

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
router.post('/:id/stop', async (req, res) => {
    try {
        const dbContainer = await Container.findOne({ _id: req.params.id, userId: req.user.userId });
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
router.post('/:id/start', async (req, res) => {
    try {
        const dbContainer = await Container.findOne({ _id: req.params.id, userId: req.user.userId });
        if (!dbContainer) return res.status(404).json({ message: 'Container not found' });

        const container = docker.getContainer(dbContainer.dockerId);
        await container.start();

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

        // Pull the latest version of the image before downtime
        console.log(`[Zero-Downtime] Pulling latest image for ${dbContainer.image}`);
        try {
            await docker.pull(dbContainer.image);
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

// PUT: Edit container configuration (e.g. Expose to internet)
router.put('/:id/edit', async (req, res) => {
    try {
        const { domain, domainPort } = req.body;
        const dbContainer = await Container.findOne({ _id: req.params.id, userId: req.user.userId });
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
                [`traefik.http.routers.${appId}.rule`]: `Host(\`${domain.trim()}\`)`,
                [`traefik.http.services.${appId}.loadbalancer.server.port`]: `${domainPort}`,
                'traefik.docker.network': 'bridge' // default assumption unless they specified another
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
router.delete('/:id', async (req, res) => {
    try {
        const dbContainer = await Container.findOne({ _id: req.params.id, userId: req.user.userId });
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
            await docker.pull(dbContainer.image);
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

export default router;

