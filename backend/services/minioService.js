import Docker from 'dockerode';
import * as Minio from 'minio';
import fs from 'fs';

const docker = new Docker({ socketPath: process.platform === 'win32' ? '//./pipe/docker_engine' : '/var/run/docker.sock' });

const MINIO_CONTAINER_NAME = 'dockermanager-minio';
const MINIO_ROOT_USER = process.env.MINIO_ROOT_USER || 'admin';
const MINIO_ROOT_PASSWORD = process.env.MINIO_ROOT_PASSWORD || 'password123';
const MINIO_PORT = 9000;
const MINIO_CONSOLE_PORT = 9001;

let minioClient = null;

export const initMinio = async () => {
    try {
        console.log('[MinIO Service] Checking for existing MinIO container...');

        let containerInfo = null;
        try {
            const container = docker.getContainer(MINIO_CONTAINER_NAME);
            containerInfo = await container.inspect();
        } catch (e) {
            // Container doesn't exist (404)
        }

        if (!containerInfo) {
            console.log('[MinIO Service] Container not found. Deploying new MinIO instance...');

            // Pull the image first, tracking progress isn't strictly necessary but we need to wait for it.
            console.log('[MinIO Service] Pulling minio/minio:latest...');
            await new Promise((resolve, reject) => {
                docker.pull('minio/minio:latest', (err, stream) => {
                    if (err) return reject(err);
                    docker.modem.followProgress(stream, (onFinishedErr, output) => {
                        if (onFinishedErr) return reject(onFinishedErr);
                        resolve(output);
                    });
                });
            });

            // Generate a secure data volume
            const volumeName = 'dockermanager-minio-data';

            await docker.createContainer({
                Image: 'minio/minio:latest',
                name: MINIO_CONTAINER_NAME,
                Env: [
                    `MINIO_ROOT_USER=${MINIO_ROOT_USER}`,
                    `MINIO_ROOT_PASSWORD=${MINIO_ROOT_PASSWORD}`
                ],
                Cmd: ['server', '/data', '--console-address', `:${MINIO_CONSOLE_PORT}`],
                HostConfig: {
                    PortBindings: {
                        '9000/tcp': [{ HostPort: '9000' }],
                        '9001/tcp': [{ HostPort: '9001' }]
                    },
                    Binds: [`${volumeName}:/data`],
                    RestartPolicy: { Name: 'unless-stopped' }
                }
            }).then(container => container.start());

            console.log('[MinIO Service] Container deployed and started via port 9000 and 9001');

            // Wait a few seconds for MinIO to boot up
            await new Promise(resolve => setTimeout(resolve, 5000));
        } else if (!containerInfo.State.Running) {
            console.log('[MinIO Service] Found stopped MinIO container. Restarting...');
            const container = docker.getContainer(MINIO_CONTAINER_NAME);
            await container.start();
            await new Promise(resolve => setTimeout(resolve, 3000));
        }

        // Initialize JavaScript SDK Client
        minioClient = new Minio.Client({
            endPoint: 'localhost',
            port: MINIO_PORT,
            useSSL: false,
            accessKey: MINIO_ROOT_USER,
            secretKey: MINIO_ROOT_PASSWORD
        });

        console.log('[MinIO Service] Client successfully initialized and connected.');
        return minioClient;

    } catch (err) {
        console.error('[MinIO Service] Initialization failed:', err.message);
        throw err;
    }
};

export const getMinioClient = () => {
    if (!minioClient) {
        throw new Error('MinIO Client has not been initialized yet.');
    }
    return minioClient;
};
