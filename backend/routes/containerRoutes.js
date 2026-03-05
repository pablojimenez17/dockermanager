import express from 'express';
import Docker from 'dockerode';
import Container from '../models/Container.js';
import authMiddleware from '../middleware/auth.js';

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
                    ports: info.NetworkSettings.Ports
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

        // Create a custom bridge network for this stack deployment 
        // if there's more than one container, so they can talk to each other
        let networkName = null;
        if (stack.length > 1) {
            networkName = `stack_net_${Math.random().toString(36).substring(7)}`;
            await docker.createNetwork({
                Name: networkName,
                Driver: 'bridge'
            });
        }

        const createdRecords = [];

        console.log(`[DEBUG] Attempting to create stack of length ${stack.length}`);

        // Deploy sequentially to respect implicit dependencies 
        for (const config of stack) {
            console.log(`[DEBUG] Processing config for image: ${config.image}`);
            const { name, image, env, ports, memory, cpu, restartPolicy, networkMode, ipv4Address } = config;

            // Ensure image exists or pull it
            try {
                await docker.pull(image);
            } catch (err) {
                console.log(`Pull error or image exists for ${image}, trying to create anyway`, err.message);
            }

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

            // Apply network settings
            let safeNetworkMode = networkMode || 'bridge';

            // If it's a multi-container stack and they left it as bridge, use the custom stack bridge
            if (networkName && safeNetworkMode === 'bridge') {
                safeNetworkMode = networkName;
            }

            // Build Advanced Host Configuration
            const baseHostConfig = {
                PortBindings,
                ...(memory && { Memory: parseInt(memory) * 1024 * 1024 }),
                ...(cpu && { NanoCPUs: parseInt(parseFloat(cpu) * 1e9) }),
                ...(restartPolicy && restartPolicy !== 'no' && { RestartPolicy: { Name: restartPolicy } }),
                NetworkMode: safeNetworkMode
            };

            const containerConfig = {
                Image: image,
                name: name,
                Env: env || [],
                ExposedPorts,
                HostConfig: baseHostConfig
            };

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
                    name,
                    image,
                    dockerId: container.id,
                    userId: req.user.userId,
                    status: 'running'
                });

                await dbContainer.save();
                createdRecords.push(dbContainer);
                console.log(`[DEBUG] Record saved to DB for ${name}`);
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
        }

        console.log(`[DEBUG] Stack creation completed successfully with ${createdRecords.length} records`);
        res.status(201).json(createdRecords);
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

        res.json({ message: 'Container started successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error starting container', error: error.message });
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

        res.json({ message: 'Container removed successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error removing container', error: error.message });
    }
});

export default router;
