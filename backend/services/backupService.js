import Docker from 'dockerode';
import * as Minio from 'minio';
import AuditLog from '../models/AuditLog.js';
import BackupConfig from '../models/BackupConfig.js';

const docker = new Docker(
    process.env.DOCKER_HOST
        ? { host: process.env.DOCKER_HOST.split('://')[1].split(':')[0], port: process.env.DOCKER_HOST.split(':').pop() }
        : { socketPath: process.platform === 'win32' ? '//./pipe/docker_engine' : '/var/run/docker.sock' }
);

// ──────────────────────────────────────────────────────────────────────────────
// Static Config
// ──────────────────────────────────────────────────────────────────────────────
const MONGO_CONTAINER  = process.env.MONGO_CONTAINER_NAME || 'dockermanager-mongo';
const SERVER_CONTAINER = 'dockermanager-backend';
const WEB_CONTAINER    = 'dockermanager-frontend';

const BUCKETS = {
    DB:     'backups-mongodb',
    SERVER: 'backups-server',
    WEB:    'backups-web'
};

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

const runContainerExport = async (containerId) => {
    const container = docker.getContainer(containerId);
    return await container.export();
};

const rotateBucket = async (bucketName, retention) => {
    try {
        const objects = [];
        const stream = minioClient.listObjects(bucketName, '', true);
        for await (const obj of stream) objects.push(obj);
        const sorted = objects.sort((a, b) => new Date(a.lastModified).getTime() - new Date(b.lastModified).getTime());
        const toDelete = sorted.slice(0, Math.max(0, sorted.length - retention));
        if (toDelete.length > 0) {
            await minioClient.removeObjects(bucketName, toDelete.map(o => o.name));
            console.log(`[Backup] Rotated [${bucketName}]: deleted ${toDelete.length} old archives.`);
        }
    } catch (err) {
        console.warn(`[Backup] Rotation failed for ${bucketName}:`, err.message);
    }
};

// ──────────────────────────────────────────────────────────────────────────────
// Individual backup functions
// ──────────────────────────────────────────────────────────────────────────────

export const runDbBackup = async (retention = 7) => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const bucket    = BUCKETS.DB;
    const filename  = `mongo-db-${timestamp}.archive.gz`;
    try {
        if (!(await minioClient.bucketExists(bucket))) await minioClient.makeBucket(bucket);
        const archiveBuffer = await runMongoDump();
        await minioClient.putObject(bucket, filename, archiveBuffer);
        await rotateBucket(bucket, retention);
        await AuditLog.create({ action: 'BACKUP_DB_COMPLETED', resourceName: filename, details: 'Database dump successful.' });
        return { type: 'DB', success: true, filename };
    } catch (e) {
        console.error('[Backup] DB FAILED:', e.message);
        return { type: 'DB', success: false, error: e.message };
    }
};

export const runServerBackup = async (retention = 7) => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const bucket    = BUCKETS.SERVER;
    const filename  = `server-snapshot-${timestamp}.tar`;
    try {
        if (!(await minioClient.bucketExists(bucket))) await minioClient.makeBucket(bucket);
        const exportStream = await runContainerExport(SERVER_CONTAINER);
        await minioClient.putObject(bucket, filename, exportStream);
        await rotateBucket(bucket, retention);
        await AuditLog.create({ action: 'BACKUP_SERVER_COMPLETED', resourceName: filename, details: 'Backend container filesystem export successful.' });
        return { type: 'SERVER', success: true, filename };
    } catch (e) {
        console.error('[Backup] SERVER FAILED:', e.message);
        return { type: 'SERVER', success: false, error: e.message };
    }
};

export const runWebBackup = async (retention = 7) => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const bucket    = BUCKETS.WEB;
    const filename  = `web-snapshot-${timestamp}.tar`;
    try {
        if (!(await minioClient.bucketExists(bucket))) await minioClient.makeBucket(bucket);
        const exportStream = await runContainerExport(WEB_CONTAINER);
        await minioClient.putObject(bucket, filename, exportStream);
        await rotateBucket(bucket, retention);
        await AuditLog.create({ action: 'BACKUP_WEB_COMPLETED', resourceName: filename, details: 'Frontend container filesystem export successful.' });
        return { type: 'WEB', success: true, filename };
    } catch (e) {
        console.error('[Backup] WEB FAILED:', e.message);
        return { type: 'WEB', success: false, error: e.message };
    }
};

export const runBackup = async () => {
    console.log(`[Backup] Starting System-Wide S3 Backup...`);
    const cfg = await BackupConfig.getSingleton();
    const results = await Promise.all([
        runDbBackup(cfg.retention),
        runServerBackup(cfg.retention),
        runWebBackup(cfg.retention)
    ]);
    return results;
};

// ──────────────────────────────────────────────────────────────────────────────
// Scheduler — persistent due-time checks, reloadable at runtime
// ──────────────────────────────────────────────────────────────────────────────

let _schedulerTimer = null;
let _schedulerRunning = false;

const clearTimers = () => {
    if (_schedulerTimer) {
        clearInterval(_schedulerTimer);
        _schedulerTimer = null;
    }
};

const backupRunners = {
    db: runDbBackup,
    server: runServerBackup,
    web: runWebBackup
};

const backupLabels = {
    db: 'DB',
    server: 'Server',
    web: 'Web'
};

const ensureNextRunAt = (backupCfg, now) => {
    if (!backupCfg.nextRunAt) {
        backupCfg.nextRunAt = backupCfg.lastRunAt
            ? new Date(new Date(backupCfg.lastRunAt).getTime() + backupCfg.intervalMs)
            : new Date(0);
    }

    return new Date(backupCfg.nextRunAt);
};

const runScheduledBackup = async (cfg, key, now) => {
    const typeCfg = cfg[key];
    if (!typeCfg?.enabled) return;

    const nextRunAt = ensureNextRunAt(typeCfg, now);
    if (nextRunAt > now) return;

    console.log(`[Backup] ${backupLabels[key]} scheduled backup due. Running now...`);
    typeCfg.lastStatus = 'running';
    typeCfg.lastError = null;
    cfg.markModified(key);
    await cfg.save();

    const result = await backupRunners[key](cfg.retention);
    const finishedAt = new Date();

    typeCfg.lastRunAt = finishedAt;
    typeCfg.nextRunAt = new Date(finishedAt.getTime() + typeCfg.intervalMs);
    typeCfg.lastStatus = result.success ? 'success' : 'failed';
    typeCfg.lastError = result.success ? null : result.error || 'Backup failed';
    cfg.markModified(key);
    await cfg.save();

    console.log(`[Backup] ${backupLabels[key]} scheduled backup ${result.success ? 'completed' : 'failed'}. Next run: ${typeCfg.nextRunAt.toISOString()}`);
};

const runDueBackups = async () => {
    if (_schedulerRunning) return;
    _schedulerRunning = true;

    try {
        const cfg = await BackupConfig.getSingleton();
        const now = new Date();

        await runScheduledBackup(cfg, 'db', now);
        await runScheduledBackup(cfg, 'server', now);
        await runScheduledBackup(cfg, 'web', now);
    } catch (err) {
        console.error('[Backup] Scheduler check failed:', err.message);
    } finally {
        _schedulerRunning = false;
    }
};

export const reloadScheduler = async () => {
    clearTimers();
    const cfg = await BackupConfig.getSingleton();
    console.log('[Backup] Scheduler reloaded from DB config.');

    for (const key of ['db', 'server', 'web']) {
        const typeCfg = cfg[key];
        if (typeCfg.enabled) {
            ensureNextRunAt(typeCfg, new Date());
            console.log(`[Backup] ${backupLabels[key]} scheduler: every ${typeCfg.intervalMs / 3600000}h. Next run: ${new Date(typeCfg.nextRunAt).toISOString()}`);
        } else {
            console.log(`[Backup] ${backupLabels[key]} scheduler: disabled`);
        }
        cfg.markModified(key);
    }
    await cfg.save();

    _schedulerTimer = setInterval(runDueBackups, 60 * 1000);
    runDueBackups();
};

export const startBackupScheduler = () => {
    console.log(`[Backup] System-Wide S3 Scheduler starting. Endpoint: ${process.env.MINIO_ENDPOINT}:${process.env.MINIO_PORT}`);
    // Initial warm-up delay, then start scheduler from DB config
    setTimeout(() => reloadScheduler(), 30_000);
};
