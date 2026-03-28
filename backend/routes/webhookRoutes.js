import express from 'express';
import crypto from 'crypto';
import Container from '../models/Container.js';
import AuditLog from '../models/AuditLog.js';
import Docker from 'dockerode';

const router = express.Router();
const docker = new Docker(process.env.DOCKER_HOST ? { host: process.env.DOCKER_HOST.split(':')[1].replace('//', ''), port: process.env.DOCKER_HOST.split(':').pop() } : { socketPath: process.platform === 'win32' ? '//./pipe/docker_engine' : '/var/run/docker.sock' });

// Open endpoint for GitHub to hit. No authMiddleware here because GitHub doesn't have a user token.
router.post('/github', async (req, res) => {
    try {
        const signature = req.headers['x-hub-signature-256'];
        const event = req.headers['x-github-event'];

        // We only care about push events
        if (event !== 'push') {
            return res.status(200).json({ message: 'Event ignored. Only push events trigger redeploys.' });
        }

        const repositoryUrl = req.body.repository?.html_url || req.body.repository?.url;
        if (!repositoryUrl) {
            return res.status(400).json({ message: 'Invalid payload: missing repository URL' });
        }

        // Find standard containers that are mapped to this git URL
        // A single repository push might need to redeploy multiple containers if they share the repo
        const linkedContainers = await Container.find({
            gitRepositoryUrl: repositoryUrl,
            deployedViaGit: true
        });

        if (linkedContainers.length === 0) {
            return res.status(404).json({ message: 'No containers found linked to this repository.' });
        }

        let deployedCount = 0;

        for (const dbContainer of linkedContainers) {
            // Verify HMAC signature securely per container since secrets are unique per deployment
            const hmac = crypto.createHmac('sha256', dbContainer.gitWebhookSecret);
            const digest = 'sha256=' + hmac.update(JSON.stringify(req.body)).digest('hex');

            if (signature !== digest) {
                console.warn(`[Webhook Invalid] Signature mismatch for container ${dbContainer.name}`);
                continue; // Skip this one, maybe another container matches or it's an attack
            }

            console.log(`[Webhook Valid] Valid push to ${repositoryUrl}. Initiating CI/CD zero-downtime redeploy for ${dbContainer.name}`);

            // Trigger the redeploy logic internally
            // Since this isn't via an API call, we need to rebuild the blue/green logic here or call a service function
            await performZeroDowntimeRedeploy(dbContainer);
            deployedCount++;

            // Audit
            await AuditLog.create({
                userId: dbContainer.userId,
                action: 'WEBHOOK_REDEPLOY',
                resourceName: dbContainer.name,
                details: `GitHub Webhook triggered zero-downtime update from ${repositoryUrl}`
            });
        }

        if (deployedCount === 0) {
            return res.status(401).json({ message: 'Authentication failed: Signatures did not match any stored secret.' });
        }

        res.status(200).json({ message: `Successfully triggered ${deployedCount} redeployments.` });

    } catch (error) {
        console.error('[Webhook Error]', error);
        res.status(500).json({ message: 'Internal server error processing webhook' });
    }
});

// Extracted Blue/Green logic for internal calls
async function performZeroDowntimeRedeploy(dbContainer) {
    const oldDockerContainer = docker.getContainer(dbContainer.dockerId);
    let oldConfig;
    try {
        oldConfig = await oldDockerContainer.inspect();
    } catch (err) {
        throw new Error('Underlying Docker container is missing.');
    }

    // Pull the latest version of the image before downtime
    console.log(`[Zero-Downtime] Pulling latest image for ${dbContainer.image}`);
    try {
        await docker.pull(dbContainer.image);
    } catch (pullErr) {
        console.warn(`[Zero-Downtime] Failed to pull latest image: ${pullErr.message}`);
    }

    // Prepare Green Container Config
    const greenName = `${dbContainer.name}-gitredeploy-${Date.now()}`;
    const greenConfig = {
        Image: dbContainer.image,
        name: greenName,
        Env: oldConfig.Config.Env,
        Cmd: oldConfig.Config.Cmd,
        ExposedPorts: oldConfig.Config.ExposedPorts,
        HostConfig: oldConfig.HostConfig,
        Labels: oldConfig.Config.Labels,
        NetworkingConfig: {}
    };

    if (oldConfig.NetworkSettings && oldConfig.NetworkSettings.Networks) {
        greenConfig.NetworkingConfig.EndpointsConfig = oldConfig.NetworkSettings.Networks;
    }

    const greenContainer = await docker.createContainer(greenConfig);
    await greenContainer.start();

    // Give time for the container to boot up and Traefik to register the dynamic labels
    await new Promise(resolve => setTimeout(resolve, 3000));

    console.log(`[Zero-Downtime] Stopping and removing Blue Container ${oldDockerContainer.id}`);
    try {
        await oldDockerContainer.stop();
    } catch (e) { }
    await oldDockerContainer.remove();

    // Update DB Record to point to Green
    dbContainer.dockerId = greenContainer.id;
    dbContainer.name = greenName;
    await dbContainer.save();
}

export default router;
