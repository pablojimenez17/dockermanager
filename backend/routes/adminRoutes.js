import express from 'express';
import Docker from 'dockerode';
import User from '../models/User.js';
import Container from '../models/Container.js';
import authMiddleware from '../middleware/auth.js';

const router = express.Router();
const docker = new Docker({ socketPath: process.platform === 'win32' ? '//./pipe/docker_engine' : '/var/run/docker.sock' });

// Admin Middleware
const adminMiddleware = async (req, res, next) => {
    try {
        const user = await User.findById(req.user.userId);
        if (!user || user.role !== 'admin') {
            return res.status(403).json({ message: 'Access denied: Administrators only' });
        }
        next();
    } catch (error) {
        res.status(500).json({ message: 'Error verifying admin status' });
    }
};

router.use(authMiddleware, adminMiddleware);

// Get all users in the system
router.get('/users', async (req, res) => {
    try {
        const users = await User.find().select('-password');
        res.json(users);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching users', error: error.message });
    }
});

// Get all containers globally
router.get('/containers', async (req, res) => {
    try {
        // Find containers with populated user details
        const dbContainers = await Container.find().populate('userId', 'name email');

        // Enrich from Docker directly as well
        const enrichedContainers = await Promise.all(dbContainers.map(async (c) => {
            try {
                const dockerContainer = docker.getContainer(c.dockerId);
                const info = await dockerContainer.inspect();
                return {
                    ...c.toObject(),
                    state: info.State.Status,
                    systemPorts: info.NetworkSettings.Ports,
                    owner: c.userId?.name || 'Unknown'
                };
            } catch (err) {
                return { ...c.toObject(), state: 'error/not_found', owner: c.userId?.name || 'Unknown' };
            }
        }));

        res.json(enrichedContainers);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching global containers', error: error.message });
    }
});

// Admin forces container removal
router.delete('/containers/:id', async (req, res) => {
    try {
        const dbContainer = await Container.findById(req.params.id);
        if (!dbContainer) {
            return res.status(404).json({ message: 'Container not found' });
        }

        const container = docker.getContainer(dbContainer.dockerId);
        try {
            await container.stop();
        } catch (e) { }
        await container.remove();

        await Container.deleteOne({ _id: req.params.id });

        res.json({ message: 'Container forcibly removed by admin' });
    } catch (error) {
        res.status(500).json({ message: 'Error removing container', error: error.message });
    }
});

export default router;
