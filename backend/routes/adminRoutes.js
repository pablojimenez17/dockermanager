import express from 'express';
import Docker from 'dockerode';
import fs from 'fs';
import path from 'path';
import User from '../models/User.js';
import Container from '../models/Container.js';
import AuditLog from '../models/AuditLog.js';
import authMiddleware from '../middleware/auth.js';
import { runBackup } from '../services/backupService.js';

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

        // Audit Log
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

import * as Minio from 'minio';

// ... (existing code) ...

// ── Backup endpoints (admin only) ──────────────────────────────────────────

// Trigger an immediate manual backup
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

// List all available backup files on the NAS (fetching from MinIO Bucket)
router.get('/backup/list', async (req, res) => {
    const minioClient = new Minio.Client({
        endPoint:  process.env.MINIO_ENDPOINT || 'storage-fw',
        port:      9000,
        useSSL:    false,
        accessKey: process.env.MINIO_ROOT_USER || 'admin',
        secretKey: process.env.MINIO_ROOT_PASSWORD || 'password123'
    });

    const BUCKET_NAME = 'backups-mongodb';

    try {
        const objects = [];
        const stream = minioClient.listObjects(BUCKET_NAME, '', true);
        
        for await (const obj of stream) {
            objects.push({
                filename: obj.name,
                sizeMb: (obj.size / (1024 * 1024)).toFixed(2),
                createdAt: obj.lastModified
            });
        }

        res.json(objects.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
    } catch (err) {
        res.status(500).json({ message: 'Could not fetch remote backup list from MinIO', error: err.message });
    }
});

export default router;
