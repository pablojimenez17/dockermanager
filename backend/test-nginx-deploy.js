// Get a token to bypass auth or assume it's disabled for local script
// Instead of auth, since we are on the server, we will import the model directly.
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Docker from 'dockerode';

dotenv.config();

const docker = new Docker(process.env.DOCKER_HOST ? { host: process.env.DOCKER_HOST.split(':')[1].replace('//', ''), port: process.env.DOCKER_HOST.split(':').pop() } : { socketPath: process.platform === 'win32' ? '//./pipe/docker_engine' : '/var/run/docker.sock' });

async function run() {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/dockermanager');
    console.log('Connected to DB');

    const domain = 'api.orbit.dev';
    const domainPort = '80';
    const name = 'testnginx';
    const image = 'nginx:alpine';

    try {
        await docker.pull(image);
        const containerConfig = {
            Image: image,
            name: name,
            ExposedPorts: { [`${domainPort}/tcp`]: {} },
            HostConfig: {
                NetworkMode: 'bridge',
                PortBindings: {
                    [`${domainPort}/tcp`]: [{ HostPort: "8081" }] // Map to 8081 so it doesn't collide with Traefik
                }
            },
            Labels: {
                'traefik.enable': 'true',
                [`traefik.http.routers.${name}.rule`]: `Host(\`${domain}\`)`,
                [`traefik.http.services.${name}.loadbalancer.server.port`]: `${domainPort}`,
                'traefik.docker.network': 'bridge'
            }
        };

        const container = await docker.createContainer(containerConfig);
        await container.start();
        console.log('Started container', container.id);

    } catch (e) {
        console.error(e);
    }
    process.exit(0);
}

run();
