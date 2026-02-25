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
                return { ...c.toObject(), state: 'error/not_found' };
            }
        }));

        res.json(enrichedContainers);
    } catch (error) {
        res.status(500).json({ message: 'Error retrieving containers', error: error.message });
    }
});

// Create a new container
router.post('/', async (req, res) => {
    try {
        const { name, image, env, ports } = req.body;

        // Ensure image exists or pull it
        // Note: for simplicity in this example, we assume the frontend sends a request, we try to create. 
        // In production, you'd want to pull the image first if missing.
        try {
            await docker.pull(image);
        } catch (err) {
            console.log("Pull error or image exists, trying to create anyway", err.message);
        }

        // Prepare port bindings
        const PortBindings = {};
        const ExposedPorts = {};
        if (ports && ports.length > 0) {
            ports.forEach(p => {
                // p format: "80:80" (host:container)
                const [hostPort, containerPort] = p.split(':');
                if (hostPort && containerPort) {
                    PortBindings[`${containerPort}/tcp`] = [{ HostPort: hostPort }];
                    ExposedPorts[`${containerPort}/tcp`] = {};
                }
            });
        }

        // Handle Template: WordPress + MySQL
        if (image.includes('wordpress')) {
            const dbName = `${name}-db`;
            try {
                await docker.pull('mysql:5.7');
            } catch (e) { }

            const dbContainer = await docker.createContainer({
                Image: 'mysql:5.7',
                name: dbName,
                Env: [
                    'MYSQL_ROOT_PASSWORD=somewordpress',
                    'MYSQL_DATABASE=wordpress',
                    'MYSQL_USER=wordpress',
                    'MYSQL_PASSWORD=somewordpress'
                ]
            });
            await dbContainer.start();

            // Create a record for the DB container so the user sees it
            const dbRecord = new Container({
                name: dbName,
                image: 'mysql:5.7',
                dockerId: dbContainer.id,
                userId: req.user.userId,
                status: 'running'
            });
            await dbRecord.save();

            // Create the WP container linked to the DB
            const wpContainer = await docker.createContainer({
                Image: image,
                name: name,
                Env: [
                    'WORDPRESS_DB_HOST=db:3306',
                    'WORDPRESS_DB_USER=wordpress',
                    'WORDPRESS_DB_PASSWORD=somewordpress',
                    'WORDPRESS_DB_NAME=wordpress',
                    ...(env || [])
                ],
                ExposedPorts,
                HostConfig: {
                    PortBindings,
                    Links: [`${dbName}:db`]
                }
            });
            await wpContainer.start();

            const wpRecord = new Container({
                name,
                image,
                dockerId: wpContainer.id,
                userId: req.user.userId,
                status: 'running'
            });
            await wpRecord.save();

            return res.status(201).json(wpRecord);
        }

        // Standard containers
        const containerConfig = {
            Image: image,
            name: name,
            Env: env || [],
            ExposedPorts,
            HostConfig: {
                PortBindings
            }
        };

        // Keep OS base images alive so they don't appear as "exited" instantly
        const keepsAlive = ['ubuntu', 'node', 'alpine', 'debian', 'centos'];
        if (keepsAlive.some(img => image.includes(img))) {
            containerConfig.Cmd = ['tail', '-f', '/dev/null'];
        }

        const container = await docker.createContainer(containerConfig);

        await container.start();

        // Save to database
        const newDbContainer = new Container({
            name,
            image,
            dockerId: container.id,
            userId: req.user.userId,
            status: 'running'
        });

        await newDbContainer.save();

        res.status(201).json(newDbContainer);
    } catch (error) {
        res.status(500).json({ message: 'Error creating container', error: error.message });
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

// Remove a container
router.delete('/:id', async (req, res) => {
    try {
        const dbContainer = await Container.findOne({ _id: req.params.id, userId: req.user.userId });
        if (!dbContainer) return res.status(404).json({ message: 'Container not found' });

        const container = docker.getContainer(dbContainer.dockerId);

        try {
            await container.stop();
        } catch (e) {
            // ignore if already stopped
        }
        await container.remove();

        await Container.deleteOne({ _id: req.params.id });

        res.json({ message: 'Container removed successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error removing container', error: error.message });
    }
});

export default router;
