import Docker from 'dockerode';
import * as Minio from 'minio';
import AuditLog from '../models/AuditLog.js';

const docker = new Docker(
    process.env.DOCKER_HOST
        ? { host: process.env.DOCKER_HOST.split('://')[1].split(':')[0], port: process.env.DOCKER_HOST.split(':').pop() }
        : { socketPath: process.platform === 'win32' ? '//./pipe/docker_engine' : '/var/run/docker.sock' }
);

// ──────────────────────────────────────────────────────────────────────────────
// Configuration
// ──────────────────────────────────────────────────────────────────────────────
const BACKUP_INTERVAL_MS  = parseInt(process.env.BACKUP_INTERVAL_MS  || String(24 * 60 * 60 * 1000));
const BACKUP_RETENTION    = parseInt(process.env.BACKUP_RETENTION     || '7');
const MONGO_CONTAINER     = process.env.MONGO_CONTAINER_NAME          || 'dockermanager-mongo';
const BUCKET_NAME         = 'backups-mongodb';

// MinIO Config (Directly from environment, routed via storage-fw)
const minioClient = new Minio.Client({
    endPoint:  process.env.MINIO_ENDPOINT || 'storage-fw',
    port:      parseInt(process.env.MINIO_PORT) || 9000,
    useSSL:    false,
    accessKey: process.env.NAS_USERNAME || 'admin',
    secretKey: process.env.NAS_PASSWORD || 'password123'
});

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Run mongodump inside container and return a Buffer
 */
const runMongoDump = async () => {
    const container = docker.getContainer(MONGO_CONTAINER);
    const exec = await container.exec({
        Cmd: ['mongodump', '--db', 'dockermanager', '--archive', '--gzip'],
        AttachStdout: true,
        AttachStderr: true,
    });

    return new Promise((resolve, reject) => {
        exec.start({ hijack: true, stdin: false }, (err, stream) => {
            if (err) return reject(err);
            const chunks = [];
            stream.on('data', chunk => chunks.push(chunk));
            stream.on('end', () => resolve(Buffer.concat(chunks)));
            stream.on('error', reject);
        });
    });
};

/**
 * Handle rotation by listing objects and deleting the oldest
 */
const rotateBackups = async () => {
    try {
        const objects = [];
        const stream = minioClient.listObjects(BUCKET_NAME, '', true);
        
        for await (const obj of stream) {
            objects.push(obj);
        }

        const sorted = objects.sort((a, b) => new Date(a.lastModified).getTime() - new Date(b.lastModified).getTime());
        const toDelete = sorted.slice(0, Math.max(0, sorted.length - BACKUP_RETENTION));

        if (toDelete.length > 0) {
            await minioClient.removeObjects(BUCKET_NAME, toDelete.map(o => o.name));
            console.log(`[Backup] Rotated: deleted ${toDelete.length} old archives.`);
        }
    } catch (err) {
        console.warn('[Backup] Rotation failed:', err.message);
    }
};

// ──────────────────────────────────────────────────────────────────────────────
// Main Logic
// ──────────────────────────────────────────────────────────────────────────────

export const runBackup = async () => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename  = `mongo-backup-${timestamp}.archive.gz`;

    console.log(`[Backup] Starting Network-based S3 Backup... (${filename})`);

    try {
        // 1. Ensure bucket exists
        const exists = await minioClient.bucketExists(BUCKET_NAME);
        if (!exists) {
            await minioClient.makeBucket(BUCKET_NAME);
            console.log(`[Backup] Created bucket: ${BUCKET_NAME}`);
        }

        // 2. Capture Dump
        const archiveBuffer = await runMongoDump();
        const sizeMb = (archiveBuffer.length / (1024 * 1024)).toFixed(2);

        // 3. Upload to MinIO (routed via storage-fw)
        await minioClient.putObject(BUCKET_NAME, filename, archiveBuffer);
        console.log(`[Backup] Success! Sent ${sizeMb} MB to MinIO via Storage Firewall.`);

        // 4. Rotate
        await rotateBackups();

        // 5. Audit
        await AuditLog.create({
            action: 'BACKUP_COMPLETED',
            resourceName: filename,
            details: `S3-compatible backup via Storage Firewall. Size: ${sizeMb} MB. Retention: ${BACKUP_RETENTION}.`
        });

        return { success: true, filename, sizeMb };
    } catch (err) {
        console.error('[Backup] S3 Backup FAILED:', err.message);
        await AuditLog.create({
            action: 'BACKUP_FAILED',
            resourceName: filename,
            details: `S3 backup attempt failed. Error: ${err.message}`
        }).catch(() => {});
        return { success: false, error: err.message };
    }
};

export const startBackupScheduler = () => {
    console.log(`[Backup] S3 Scheduler active. Endpoint: ${process.env.MINIO_ENDPOINT}:${process.env.MINIO_PORT}`);
    setTimeout(() => runBackup(), 30_000);
    setInterval(() => runBackup(), BACKUP_INTERVAL_MS);
};
