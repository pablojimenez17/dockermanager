import express from 'express';
import Docker from 'dockerode';
import Volume from '../models/Volume.js';
import User from '../models/User.js';
import AuditLog from '../models/AuditLog.js';
import authMiddleware from '../middleware/auth.js';
import { checkPermission } from '../middleware/rbac.js';
import { exec } from 'child_process';
import util from 'util';

const execPromise = util.promisify(exec);
const router = express.Router();
const docker = new Docker(process.env.DOCKER_HOST ? { host: process.env.DOCKER_HOST.split(':')[1].replace('//', ''), port: process.env.DOCKER_HOST.split(':').pop() } : { socketPath: process.platform === 'win32' ? '//./pipe/docker_engine' : '/var/run/docker.sock' });

router.use(authMiddleware);

// ── Docker df() cache ─────────────────────────────────────────────────────
// docker.df() / `docker system df` is SLOW (inspects all resources).
// Cache the result for 30 seconds to avoid blocking every volumes request.
let _dfCache = null;
let _dfCacheTime = 0;
const DF_CACHE_TTL_MS = 30_000; // 30 seconds

const getDockerDfVolumes = async () => {
    const now = Date.now();
    if (_dfCache && (now - _dfCacheTime) < DF_CACHE_TTL_MS) {
        return _dfCache;
    }
    try {
        const dfData = await docker.df();
        _dfCache = dfData.Volumes || [];
        _dfCacheTime = now;
        return _dfCache;
    } catch (e) {
        console.error('Docker.df() failed:', e.message);
        return _dfCache || []; // return stale cache on error rather than crashing
    }
};

// GET Volumes for authenticated user or organization
router.get('/', async (req, res) => {
    try {
        let dbVolumes = {};
        if (req.user.role === 'admin' && !req.organization) {
            dbVolumes = await Volume.find();
        } else if (req.organization) {
            dbVolumes = await Volume.find({ organizationId: req.organization._id });
        } else {
            dbVolumes = await Volume.find({ userId: req.user.userId, organizationId: { $exists: false } });
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
router.post('/', checkPermission('manageVolumes'), async (req, res) => {
    try {
        const { name } = req.body;
        if (!name) return res.status(400).json({ message: 'Volume name required' });

        const ownerId = req.organization ? req.organization.ownerId : req.user.userId;
        const orgPrefix = req.organization ? `org-${req.organization._id}-` : '';
        const safeName = `vol-${orgPrefix}${req.user.userId}-${name.replace(/[^a-zA-Z0-9_-]/g, '')}`;

        // ==========================================
        // QUOTAS VALIDATION
        // ==========================================
        const user = await User.findById(ownerId);
        const limits = user.limits || { maxVolumes: 1, maxVolumeSizeMb: 1024 };

        const queryConstraint = req.organization ? { organizationId: req.organization._id } : { userId: ownerId, organizationId: { $exists: false } };
        const currentVolumesDb = await Volume.find(queryConstraint);

        if (currentVolumesDb.length >= limits.maxVolumes) {
            return res.status(403).json({
                message: `Quota Exceeded: Your plan limits you to ${limits.maxVolumes} Disk Volumes.`
            });
        }

        // Size quota: only check if limit is finite (skip for unlimited plans)
        // We use the cached df() result to avoid blocking this request.
        if (limits.maxVolumeSizeMb && limits.maxVolumeSizeMb < 999999) {
            const dockerVolumes = await getDockerDfVolumes();
            let currentTotalBytes = 0;
            currentVolumesDb.forEach(dbVol => {
                const sysVol = dockerVolumes.find(v => v.Name === dbVol.name);
                if (sysVol && sysVol.UsageData) currentTotalBytes += sysVol.UsageData.Size;
            });
            const maxBytes = limits.maxVolumeSizeMb * 1024 * 1024;
            if (currentTotalBytes >= maxBytes) {
                return res.status(403).json({
                    message: `Quota Exceeded: You are using ${Math.round(currentTotalBytes / 1024 / 1024)}MB of your ${limits.maxVolumeSizeMb}MB max volume storage.`
                });
            }
        }

        // ==========================================
        // CREATE VOLUME
        // ==========================================
        await docker.createVolume({ Name: safeName });

        const volumeData = {
            name: safeName,
            userId: req.user.userId
        };
        if (req.organization) {
            volumeData.organizationId = req.organization._id;
        }

        const newVolume = new Volume(volumeData);
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
router.delete('/:id', checkPermission('deleteVolumes'), async (req, res) => {
    try {
        const volumeDb = await Volume.findById(req.params.id);
        if (!volumeDb) return res.status(404).json({ message: 'Volume not found' });

        // Security check
        if (req.user.role !== 'admin') {
            if (req.organization) {
                if (volumeDb.organizationId?.toString() !== req.organization._id.toString()) {
                    return res.status(403).json({ message: 'Forbidden' });
                }
            } else {
                if (volumeDb.userId.toString() !== req.user.userId || volumeDb.organizationId) {
                    return res.status(403).json({ message: 'Forbidden' });
                }
            }
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
