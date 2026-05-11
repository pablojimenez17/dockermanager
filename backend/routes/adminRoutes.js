import express from 'express';
import Docker from 'dockerode';
import fs from 'fs';
import path from 'path';
import User from '../models/User.js';
import Container from '../models/Container.js';
import AuditLog from '../models/AuditLog.js';
import BackupConfig from '../models/BackupConfig.js';
import IpReputation from '../models/IpReputation.js';
import authMiddleware from '../middleware/auth.js';
import { invalidateIpCache } from '../middleware/ipReputation.js';
import { runBackup, runDbBackup, runServerBackup, runWebBackup, reloadScheduler } from '../services/backupService.js';
import * as Minio from 'minio';

const router = express.Router();
const docker = new Docker(process.env.DOCKER_HOST ? { host: process.env.DOCKER_HOST.split(':')[1].replace('//', ''), port: process.env.DOCKER_HOST.split(':').pop() } : { socketPath: process.platform === 'win32' ? '//./pipe/docker_engine' : '/var/run/docker.sock' });

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

// Get all system infrastructure containers (directly from Docker)
router.get('/system-containers', async (req, res) => {
    try {
        const containers = await docker.listContainers({ all: true });
        res.json(containers);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching system containers', error: error.message });
    }
});

// Get all containers globally
router.get('/containers', async (req, res) => {
    try {
        const dbContainers = await Container.find().populate('userId', 'name email');
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
        try {
            const container = docker.getContainer(dbContainer.dockerId);
            try { await container.stop(); } catch (_) {}
            await container.remove();
        } catch (dockerErr) {
            console.warn(`[Admin] Container ${dbContainer.dockerId} not found in Docker, removing from DB only.`);
        }
        await Container.deleteOne({ _id: req.params.id });
        await AuditLog.create({
            userId: req.user.userId,
            action: 'FORCE_DELETE_CONTAINER',
            resourceName: dbContainer.name,
            details: `Admin forcefully removed container owned by ${dbContainer.userId}`
        });
        res.json({ message: 'Container forcibly removed by admin' });
    } catch (error) {
        res.status(500).json({ message: 'Error removing container', error: error.message });
    }
});

// Get audit logs
router.get('/audit', async (req, res) => {
    try {
        const logs = await AuditLog.find()
            .populate('userId', 'name email')
            .sort({ createdAt: -1 })
            .limit(100);
        res.json(logs);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching audit logs', error: error.message });
    }
});

// MinIO helper (shared instance)
const getMinioClient = () => new Minio.Client({
    endPoint:  process.env.MINIO_ENDPOINT || 'storage-fw',
    port:      9000,
    useSSL:    false,
    accessKey: process.env.MINIO_ROOT_USER || 'admin',
    secretKey: process.env.MINIO_ROOT_PASSWORD || 'password123'
});

// ── Backup endpoints (admin only) ──────────────────────────────────────────

// Trigger a full system backup (all 3 types)
router.post('/backup/run', async (req, res) => {
    try {
        const results = await runBackup();
        const failed = results.filter(r => !r.success);
        if (failed.length === 0) {
            res.json({ message: 'All backups completed successfully.', results });
        } else {
            res.status(207).json({ message: 'Some backups failed.', results });
        }
    } catch (err) {
        res.status(500).json({ message: 'Backup process crashed.', error: err.message });
    }
});

// Trigger only the database backup
router.post('/backup/run/db', async (req, res) => {
    try {
        const cfg = await BackupConfig.getSingleton();
        const result = await runDbBackup(cfg.retention);
        res.status(result.success ? 200 : 500).json(result);
    } catch (err) {
        res.status(500).json({ message: 'DB backup failed.', error: err.message });
    }
});

// Trigger only the backend (server) backup
router.post('/backup/run/server', async (req, res) => {
    try {
        const cfg = await BackupConfig.getSingleton();
        const result = await runServerBackup(cfg.retention);
        res.status(result.success ? 200 : 500).json(result);
    } catch (err) {
        res.status(500).json({ message: 'Server backup failed.', error: err.message });
    }
});

// Trigger only the frontend (web) backup
router.post('/backup/run/web', async (req, res) => {
    try {
        const cfg = await BackupConfig.getSingleton();
        const result = await runWebBackup(cfg.retention);
        res.status(result.success ? 200 : 500).json(result);
    } catch (err) {
        res.status(500).json({ message: 'Web backup failed.', error: err.message });
    }
});

// Get current backup scheduler configuration
router.get('/backup/config', async (req, res) => {
    try {
        const cfg = await BackupConfig.getSingleton();
        res.json(cfg);
    } catch (err) {
        res.status(500).json({ message: 'Could not fetch backup config.', error: err.message });
    }
});

// Update backup scheduler configuration and reload scheduler in-place
router.put('/backup/config', async (req, res) => {
    try {
        const { db, server, web, retention } = req.body;
        const cfg = await BackupConfig.getSingleton();

        if (db !== undefined) {
            if (typeof db.enabled === 'boolean') cfg.db.enabled = db.enabled;
            if (db.intervalMs && db.intervalMs >= 3600000) cfg.db.intervalMs = db.intervalMs; // min 1h
        }
        if (server !== undefined) {
            if (typeof server.enabled === 'boolean') cfg.server.enabled = server.enabled;
            if (server.intervalMs && server.intervalMs >= 3600000) cfg.server.intervalMs = server.intervalMs;
        }
        if (web !== undefined) {
            if (typeof web.enabled === 'boolean') cfg.web.enabled = web.enabled;
            if (web.intervalMs && web.intervalMs >= 3600000) cfg.web.intervalMs = web.intervalMs;
        }
        if (retention && retention >= 1) cfg.retention = retention;

        cfg.markModified('db');
        cfg.markModified('server');
        cfg.markModified('web');
        await cfg.save();

        await AuditLog.create({
            userId: req.user.userId,
            action: 'BACKUP_CONFIG_UPDATED',
            resourceName: 'backup-config',
            details: `Admin updated backup scheduler config.`
        });

        // Reload the live scheduler without restarting the server
        await reloadScheduler();

        res.json({ message: 'Backup configuration updated and scheduler reloaded.', config: cfg });
    } catch (err) {
        res.status(500).json({ message: 'Could not update backup config.', error: err.message });
    }
});

// List all available backup files across all MinIO buckets
router.get('/backup/list', async (req, res) => {
    const minioClient = getMinioClient();
    const BUCKETS = ['backups-mongodb', 'backups-server', 'backups-web'];

    try {
        const allObjects = [];
        for (const bucket of BUCKETS) {
            try {
                const exists = await minioClient.bucketExists(bucket);
                if (!exists) continue;
                const stream = minioClient.listObjects(bucket, '', true);
                for await (const obj of stream) {
                    allObjects.push({
                        filename: obj.name,
                        bucket,
                        sizeMb: (obj.size / (1024 * 1024)).toFixed(2),
                        createdAt: obj.lastModified
                    });
                }
            } catch (bucketErr) {
                console.warn(`[Backup List] Could not list bucket ${bucket}:`, bucketErr.message);
            }
        }
        res.json(allObjects.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
    } catch (err) {
        res.status(500).json({ message: 'Could not fetch remote backup list from MinIO', error: err.message });
    }
});

// Delete a specific backup file from MinIO
router.delete('/backup/:bucket/:filename', async (req, res) => {
    const { bucket, filename } = req.params;
    const ALLOWED_BUCKETS = ['backups-mongodb', 'backups-server', 'backups-web'];
    if (!ALLOWED_BUCKETS.includes(bucket)) {
        return res.status(400).json({ message: 'Invalid bucket name.' });
    }
    const minioClient = getMinioClient();
    try {
        await minioClient.removeObject(bucket, filename);
        await AuditLog.create({
            action: 'BACKUP_DELETED',
            resourceName: filename,
            details: `Admin deleted backup from bucket: ${bucket}`
        });
        res.json({ message: `Backup "${filename}" deleted from ${bucket}.` });
    } catch (err) {
        res.status(500).json({ message: 'Failed to delete backup.', error: err.message });
    }
});

// ── IP Reputation Management (Security Panel) ─────────────────────────────────

// GET /api/admin/security/ip-reputation — list worst IPs (score < 80, sorted by score asc)
router.get('/security/ip-reputation', async (req, res) => {
    try {
        const limit = Math.min(parseInt(req.query.limit) || 50, 200);
        const ips = await IpReputation.find({ score: { $lt: 80 } })
            .sort({ score: 1 })              // worst first
            .limit(limit)
            .lean();
        res.json(ips);
    } catch (err) {
        res.status(500).json({ message: 'Error fetching IP reputation data', error: err.message });
    }
});

// POST /api/admin/security/ip-block — manually blacklist an IP indefinitely
router.post('/security/ip-block', async (req, res) => {
    const { ip, reason } = req.body;
    if (!ip || typeof ip !== 'string' || ip.length > 45) {
        return res.status(400).json({ message: 'Valid IP address is required' });
    }
    try {
        await IpReputation.findOneAndUpdate(
            { ip },
            {
                $set: { score: 0, manualBlock: true, lastSeenAt: new Date() },
                $push: {
                    incidents: {
                        $each: [{ type: 'MANUAL_BLOCK', detail: reason || 'Manual block by admin', scoreDelta: -100 }],
                        $slice: -50,
                    },
                },
            },
            { upsert: true, new: true }
        );
        invalidateIpCache(ip);
        await AuditLog.create({
            userId: req.user.userId,
            action: 'SECURITY_IP_BLOCKED',
            resourceName: ip,
            details: reason || 'Manual block by admin',
        });
        res.json({ message: `IP ${ip} has been manually blocked.` });
    } catch (err) {
        res.status(500).json({ message: 'Error blocking IP', error: err.message });
    }
});

// DELETE /api/admin/security/ip-unblock/:ip — remove manual block and reset score
router.delete('/security/ip-unblock/:ip', async (req, res) => {
    const ip = decodeURIComponent(req.params.ip);
    try {
        await IpReputation.findOneAndUpdate(
            { ip },
            { $set: { score: 60, manualBlock: false, blockedUntil: null } }
        );
        invalidateIpCache(ip);
        await AuditLog.create({
            userId: req.user.userId,
            action: 'SECURITY_IP_UNBLOCKED',
            resourceName: ip,
            details: 'Manual unblock by admin',
        });
        res.json({ message: `IP ${ip} has been unblocked. Score reset to 60.` });
    } catch (err) {
        res.status(500).json({ message: 'Error unblocking IP', error: err.message });
    }
});

// GET /api/admin/security/audit — security events only (last 200)
router.get('/security/audit', async (req, res) => {
    try {
        const logs = await AuditLog.find({
            action: { $in: [
                'FAILED_LOGIN_ATTEMPT',
                'SECURITY_INJECTION_ATTEMPT',
                'SECURITY_RATE_LIMIT_HIT',
                'SECURITY_BOT_DETECTED',
                'SECURITY_IP_BLOCKED',
                'SECURITY_IP_UNBLOCKED',
            ]}
        })
        .populate('userId', 'name email')
        .sort({ createdAt: -1 })
        .limit(200)
        .lean();
        res.json(logs);
    } catch (err) {
        res.status(500).json({ message: 'Error fetching security audit logs', error: err.message });
    }
});

export default router;
