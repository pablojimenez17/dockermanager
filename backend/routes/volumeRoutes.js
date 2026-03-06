import express from 'express';
import Docker from 'dockerode';
import Volume from '../models/Volume.js';
import User from '../models/User.js';
import AuditLog from '../models/AuditLog.js';
import authMiddleware from '../middleware/auth.js';
import { exec } from 'child_process';
import util from 'util';

const execPromise = util.promisify(exec);
const router = express.Router();
const docker = new Docker({ socketPath: process.platform === 'win32' ? '//./pipe/docker_engine' : '/var/run/docker.sock' });

router.use(authMiddleware);

// Fetch total volumes usage via Docker system df -v
const getDockerDfVolumes = async () => {
    try {
        const { stdout } = await execPromise('docker system df -v --format="{{json .}}"');
        // Parse the json lines for Volumes space
        const lines = stdout.trim().split('\\n');
        for (const line of lines) {
            if (!line) continue;
            try {
                const data = JSON.parse(line);
                // Try to find volume-specific output if format returns it
            } catch (e) { }
        }
    } catch (e) {
        console.error('Exec docker df failed:', e);
    }

    // Fallback or preferred: Use docker ode df() which returns the /system/df endpoint output natively
    try {
        const dfData = await docker.df();
        // dfData.Volumes is an array of { Name: string, UsageData: { Size: number, RefCount: number } }
        return dfData.Volumes || [];
    } catch (e) {
        console.error('Docker.df() failed:', e);
        return [];
    }
};

// GET Volumes for authenticated user
router.get('/', async (req, res) => {
    try {
        let dbVolumes = {};
        if (req.user.role === 'admin') {
            dbVolumes = await Volume.find();
        } else {
            dbVolumes = await Volume.find({ userId: req.user.userId });
        }

        const dockerVolumes = await getDockerDfVolumes();

        // Map dbVolumes with their actual system sizes
        const finalVolumes = dbVolumes.map(dbVol => {
            const systemVol = dockerVolumes.find(dv => dv.Name === dbVol.name);
            return {
                _id: dbVol._id,
                name: dbVol.name,
                userId: dbVol.userId,
                createdAt: dbVol.createdAt,
                sizeBytes: systemVol && systemVol.UsageData ? systemVol.UsageData.Size : 0
            };
        });

        res.json(finalVolumes);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching volumes', error: error.message });
    }
});

// POST Create new Volume
router.post('/', async (req, res) => {
    try {
        const { name } = req.body;
        if (!name) return res.status(400).json({ message: 'Volume name required' });

        const safeName = `vol-${req.user.userId}-${name.replace(/[^a-zA-Z0-9_-]/g, '')}`;

        // ==========================================
        // QUOTAS VALIDATION
        // ==========================================
        const user = await User.findById(req.user.userId);
        const limits = user.limits || { maxVolumes: 1, maxVolumeSizeMb: 1024 };

        const currentVolumesDb = await Volume.find({ userId: req.user.userId });

        if (currentVolumesDb.length >= limits.maxVolumes) {
            return res.status(403).json({
                message: `Quota Exceeded: Your plan limits you to ${limits.maxVolumes} Disk Volumes.`
            });
        }

        // Sum current usage
        const dockerVolumes = await getDockerDfVolumes();
        let currentTotalBytes = 0;
        currentVolumesDb.forEach(dbVol => {
            const sysVol = dockerVolumes.find(v => v.Name === dbVol.name);
            if (sysVol && sysVol.UsageData) {
                currentTotalBytes += sysVol.UsageData.Size;
            }
        });

        const maxBytes = limits.maxVolumeSizeMb * 1024 * 1024;
        // Check if current usage ALREADY exceeds total limits. 
        // We cannot predict the new volume's final size, but we can block creation if the account is already full.
        if (currentTotalBytes >= maxBytes) {
            return res.status(403).json({
                message: `Quota Exceeded: You are using ${Math.round(currentTotalBytes / 1024 / 1024)}MB of your ${limits.maxVolumeSizeMb}MB max volume storage.`
            });
        }

        // ==========================================
        // CREATE VOLUME
        // ==========================================
        await docker.createVolume({ Name: safeName });

        const newVolume = new Volume({
            name: safeName,
            userId: req.user.userId
        });
        await newVolume.save();

        try {
            await AuditLog.create({
                userId: req.user.userId,
                action: 'CREATE_VOLUME',
                resourceName: safeName
            });
        } catch (auditErr) { console.error("Audit log failed silently: " + auditErr.message); }

        res.status(201).json(newVolume);
    } catch (error) {
        res.status(500).json({ message: 'Error creating volume', error: error.message });
    }
});

// DELETE a Volume
router.delete('/:id', async (req, res) => {
    try {
        const volumeDb = await Volume.findById(req.params.id);
        if (!volumeDb) return res.status(404).json({ message: 'Volume not found' });

        // Security check
        if (req.user.role !== 'admin' && volumeDb.userId.toString() !== req.user.userId) {
            return res.status(403).json({ message: 'Forbidden' });
        }

        const dockerVol = docker.getVolume(volumeDb.name);
        try {
            await dockerVol.remove();
        } catch (dfErr) {
            // Volume might be in use or already deleted, ignore or throw if 409
            if (dfErr.statusCode === 409) {
                return res.status(409).json({ message: 'Volume is currently in use by a container and cannot be removed.' });
            }
        }

        await Volume.findByIdAndDelete(req.params.id);

        try {
            await AuditLog.create({
                userId: req.user.userId,
                action: 'DELETE_VOLUME',
                resourceName: volumeDb.name
            });
        } catch (auditErr) { console.error("Audit log failed silently: " + auditErr.message); }

        res.json({ message: 'Volume deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error deleting volume', error: error.message });
    }
});

export default router;
