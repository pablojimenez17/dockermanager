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
const SERVER_CONTAINER    = 'dockermanager-backend';
const WEB_CONTAINER       = 'dockermanager-frontend';

const BUCKETS = {
    DB: 'backups-mongodb',
    SERVER: 'backups-server',
    WEB: 'backups-web'
};

// MinIO Config (Directly from environment, routed via storage-fw)
const minioClient = new Minio.Client({
    endPoint:  process.env.MINIO_ENDPOINT || 'storage-fw',
    port:      parseInt(process.env.MINIO_PORT) || 9000,
    useSSL:    false,
    accessKey: process.env.MINIO_ROOT_USER || 'admin',
    secretKey: process.env.MINIO_ROOT_PASSWORD || 'password123'
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
 * Capture a container's filesystem snapshot as a stream
 */
const runContainerExport = async (containerId) => {
    const container = docker.getContainer(containerId);
    return await container.export(); // Returns a readable stream (tar)
};

/**
 * Handle rotation by listing objects and deleting the oldest in a specific bucket
 */
const rotateBucket = async (bucketName) => {
    try {
        const objects = [];
        const stream = minioClient.listObjects(bucketName, '', true);
        
        for await (const obj of stream) {
            objects.push(obj);
        }

        const sorted = objects.sort((a, b) => new Date(a.lastModified).getTime() - new Date(b.lastModified).getTime());
        const toDelete = sorted.slice(0, Math.max(0, sorted.length - BACKUP_RETENTION));

        if (toDelete.length > 0) {
            await minioClient.removeObjects(bucketName, toDelete.map(o => o.name));
            console.log(`[Backup] Rotated [${bucketName}]: deleted ${toDelete.length} old archives.`);
        }
    } catch (err) {
        console.warn(`[Backup] Rotation failed for ${bucketName}:`, err.message);
    }
};

// ──────────────────────────────────────────────────────────────────────────────
// Main Logic
// ──────────────────────────────────────────────────────────────────────────────

export const runBackup = async () => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    
    console.log(`[Backup] Starting System-Wide S3 Backup... (Timestamp: ${timestamp})`);

    const results = [];

    // --- 1. MONGODB BACKUP ---
    try {
        const bucket = BUCKETS.DB;
        const filename = `mongo-db-${timestamp}.archive.gz`;
        if (!(await minioClient.bucketExists(bucket))) await minioClient.makeBucket(bucket);
        
        const archiveBuffer = await runMongoDump();
        await minioClient.putObject(bucket, filename, archiveBuffer);
        await rotateBucket(bucket);
        
        await AuditLog.create({ action: 'BACKUP_DB_COMPLETED', resourceName: filename, details: 'Database dump successful.' });
        results.push({ type: 'DB', success: true, filename });
    } catch (e) {
        console.error('[Backup] DB FAILED:', e.message);
        results.push({ type: 'DB', success: false, error: e.message });
    }

    // --- 2. SERVER (BACKEND) BACKUP ---
    try {
        const bucket = BUCKETS.SERVER;
        const filename = `server-snapshot-${timestamp}.tar`;
        if (!(await minioClient.bucketExists(bucket))) await minioClient.makeBucket(bucket);
        
        const exportStream = await runContainerExport(SERVER_CONTAINER);
        // stream directly to minio
        await minioClient.putObject(bucket, filename, exportStream);
        await rotateBucket(bucket);

        await AuditLog.create({ action: 'BACKUP_SERVER_COMPLETED', resourceName: filename, details: 'Backend container filesystem export successful.' });
        results.push({ type: 'SERVER', success: true, filename });
    } catch (e) {
        console.error('[Backup] SERVER FAILED:', e.message);
        results.push({ type: 'SERVER', success: false, error: e.message });
    }

    // --- 3. WEB (FRONTEND) BACKUP ---
    try {
        const bucket = BUCKETS.WEB;
        const filename = `web-snapshot-${timestamp}.tar`;
        if (!(await minioClient.bucketExists(bucket))) await minioClient.makeBucket(bucket);
        
        const exportStream = await runContainerExport(WEB_CONTAINER);
        await minioClient.putObject(bucket, filename, exportStream);
        await rotateBucket(bucket);

        await AuditLog.create({ action: 'BACKUP_WEB_COMPLETED', resourceName: filename, details: 'Frontend container filesystem export successful.' });
        results.push({ type: 'WEB', success: true, filename });
    } catch (e) {
        console.error('[Backup] WEB FAILED:', e.message);
        results.push({ type: 'WEB', success: false, error: e.message });
    }

    return results;
};

export const startBackupScheduler = () => {
    console.log(`[Backup] System-Wide S3 Scheduler active. Endpoint: ${process.env.MINIO_ENDPOINT}:${process.env.MINIO_PORT}`);
    // Initial run after 30s, followed by interval
    setTimeout(() => runBackup(), 30_000);
    setInterval(() => runBackup(), BACKUP_INTERVAL_MS);
};
