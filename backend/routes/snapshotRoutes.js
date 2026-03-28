import express from 'express';
import Docker from 'dockerode';
import Snapshot from '../models/Snapshot.js';
import User from '../models/User.js';
import authMiddleware from '../middleware/auth.js';
import { checkPermission } from '../middleware/rbac.js';

const router = express.Router();
const docker = new Docker(process.env.DOCKER_HOST ? { host: process.env.DOCKER_HOST.split(':')[1].replace('//', ''), port: process.env.DOCKER_HOST.split(':').pop() } : { socketPath: process.platform === 'win32' ? '//./pipe/docker_engine' : '/var/run/docker.sock' });

router.use(authMiddleware);

// GET /api/snapshots
// Return all snapshots belonging to the authenticated user/organization
router.get('/', async (req, res) => {
    try {
        const query = req.organization
            ? { organizationId: req.organization._id }
            : { userId: req.user.userId, organizationId: { $exists: false } };

        const snapshots = await Snapshot.find(query).sort({ createdAt: -1 });

        // Optionally, we could enrich this with real Docker image sizes, 
        // but for speed we'll just return the DB records.
        res.json(snapshots);
    } catch (error) {
        console.error('Error fetching snapshots:', error);
        res.status(500).json({ message: 'Failed to fetch snapshots', error: error.message });
    }
});

// DELETE /api/snapshots/:id
// Delete a snapshot from the database and remove the image from Docker
router.delete('/:id', checkPermission('manageContainers'), async (req, res) => {
    try {
        const { id } = req.params;

        const query = req.organization
            ? { _id: id, organizationId: req.organization._id }
            : { _id: id, userId: req.user.userId, organizationId: { $exists: false } };

        const snapshot = await Snapshot.findOne(query);
        if (!snapshot) {
            return res.status(404).json({ message: 'Snapshot not found or you do not have permission to delete it.' });
        }

        // Attempt to remove the Docker Image
        try {
            const image = docker.getImage(snapshot.imageId);
            await image.remove({ force: true });
        } catch (dockerErr) {
            console.warn(`Could not remove docker image ${snapshot.imageId}. It may be in use or already deleted manually. Ignoring.`, dockerErr.message);
        }

        // Delete DB record
        await Snapshot.deleteOne({ _id: id });

        res.json({ message: 'Snapshot deleted successfully.' });
    } catch (error) {
        console.error('Error deleting snapshot:', error);
        res.status(500).json({ message: 'Failed to delete snapshot', error: error.message });
    }
});

export default router;
