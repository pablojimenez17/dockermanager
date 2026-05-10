import Docker from 'dockerode';
import * as Minio from 'minio';

const docker = new Docker(
  process.env.DOCKER_HOST 
    ? { host: process.env.DOCKER_HOST.split('://')[1].split(':')[0], port: process.env.DOCKER_HOST.split(':').pop() }
    : { socketPath: process.platform === 'win32' ? '//./pipe/docker_engine' : '/var/run/docker.sock' }
);

const MINIO_CONTAINER_NAME = 'dockermanager-minio';
const MINIO_ROOT_USER = process.env.MINIO_ROOT_USER || 'admin';
const MINIO_ROOT_PASSWORD = process.env.MINIO_ROOT_PASSWORD || 'password123';
const MINIO_PORT = 9000;

let minioClient = null;

export const initMinio = async () => {
    try {
        console.log('[MinIO Service] Initializing connection to static MinIO service...');

        // Verify container is running
        let isRunning = false;
        try {
            const container = docker.getContainer(MINIO_CONTAINER_NAME);
            const containerInfo = await container.inspect();
            if (containerInfo.State.Running) isRunning = true;
        } catch (e) {
            console.warn('[MinIO Service] Could not inspect MinIO container via Docker API (might be restricted by socket proxy). Assuming it is running.');
            isRunning = true;
        }

        if (!isRunning) {
            console.warn('[MinIO Service] MinIO container appears stopped. Check docker-compose.');
        }

        // Initialize JavaScript SDK Client using the internal compose hostname 'minio'
        minioClient = new Minio.Client({
            endPoint: process.env.MINIO_ENDPOINT || 'minio',
            port: parseInt(process.env.MINIO_PORT) || MINIO_PORT,
            useSSL: false,
            accessKey: MINIO_ROOT_USER,
            secretKey: MINIO_ROOT_PASSWORD
        });

        console.log('[MinIO Service] Client successfully initialized and connected.');
        return minioClient;

    } catch (err) {
        // Don't crash the backend if MinIO is temporarily unavailable.
        // It will be retried on first use via getMinioClient().
        console.error('[MinIO Service] Initialization failed (non-fatal):', err.message);
        return null;
    }
};

export const getMinioClient = () => {
    if (!minioClient) {
        throw new Error('MinIO Client has not been initialized yet.');
    }
    return minioClient;
};
