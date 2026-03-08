import express from 'express';
import Docker from 'dockerode';
import Container from '../models/Container.js';
import User from '../models/User.js';
import AuditLog from '../models/AuditLog.js';
import authMiddleware from '../middleware/auth.js';
import simpleGit from 'simple-git';
import tar from 'tar-fs';
import path from 'path';
import fs from 'fs';
import os from 'os';
import crypto from 'crypto';

const router = express.Router();
const docker = new Docker({ socketPath: process.platform === 'win32' ? '//./pipe/docker_engine' : '/var/run/docker.sock' });

router.use(authMiddleware);

router.post('/deploy', async (req, res) => {
    let tmpDir = null;
    try {
        const { gitUrl, branch, name, domain, domainPort, env } = req.body;

        if (!gitUrl || !name) {
            return res.status(400).json({ message: 'Git URL and Container Name are required.' });
        }

        // ==========================================
        // QUOTA VALIDATION
        // ==========================================
        const user = await User.findById(req.user.userId);
        const limits = user.limits || { maxContainers: 2, maxRamMb: 1024, maxCpuCores: 1, maxDomains: 0, maxVolumes: 1, maxVolumeSizeMb: 1024 };

        const currentContainersDb = await Container.find({ userId: req.user.userId });
        if (currentContainersDb.length + 1 > limits.maxContainers) {
            return res.status(403).json({ message: `Quota Exceeded: Your plan limits you to ${limits.maxContainers} containers.` });
        }

        if (domain && domain.trim() !== '') {
            const currentDomainsDb = currentContainersDb.filter(c => c.domain && c.domain.trim() !== '');
            if (currentDomainsDb.length + 1 > limits.maxDomains) {
                return res.status(403).json({ message: `Quota Exceeded: Your plan limits you to ${limits.maxDomains} custom domains.` });
            }
        }

        // ==========================================
        // CLONE REPOSITORY
        // ==========================================
        const buildId = crypto.randomUUID();
        tmpDir = path.join(os.tmpdir(), `dockermanager-build-${buildId}`);
        fs.mkdirSync(tmpDir, { recursive: true });

        console.log(`[GitDeploy] Cloning ${gitUrl} into ${tmpDir}...`);
        const git = simpleGit();
        await git.clone(gitUrl, tmpDir, branch ? ['-b', branch, '--single-branch'] : ['--depth', '1']);

        // Check for Dockerfile
        if (!fs.existsSync(path.join(tmpDir, 'Dockerfile'))) {
            throw new Error('No Dockerfile found in the repository root.');
        }

        // ==========================================
        // SANDBOXED BUILD IMAGE
        // ==========================================
        console.log(`[GitDeploy] Packing repository...`);
        const tarStream = tar.pack(tmpDir);
        const imageTag = `gitdeploy-${user._id}-${name.toLowerCase()}`;

        console.log(`[GitDeploy] Building image ${imageTag}...`);

        // Build Sandbox Limits: prevent malicious builds crashing our host
        // E.g. limit memory to 1GB during build, 1 CPU Core
        const buildOptions = {
            t: imageTag,
            memory: 1024 * 1024 * 1024, // 1GB RAM max during build
            cpuquota: 100000,           // 1 CPU core equivalent
        };

        const buildStream = await docker.buildImage(tarStream, buildOptions);

        await new Promise((resolve, reject) => {
            docker.modem.followProgress(buildStream, (err, res) => err ? reject(err) : resolve(res), (prog) => {
                if (prog.stream) process.stdout.write(prog.stream);
            });
        });

        // ==========================================
        // DEPLOY CONTAINER
        // ==========================================
        const appId = name.replace(/[^a-zA-Z0-9]/g, ''); // Ensure safe router name

        // Prepare Traefik Labels
        const Labels = {};
        if (domain && domain.trim() !== '' && domainPort) {
            Labels['traefik.enable'] = 'true';
            Labels[`traefik.http.routers.${appId}.rule`] = `Host(\`${domain.trim()}\`)`;
            Labels[`traefik.http.services.${appId}.loadbalancer.server.port`] = `${domainPort}`;
        }

        // Convert key-value env vars to docker array format
        const Env = env && Array.isArray(env)
            ? env.filter(e => e.key && e.key.trim() !== '').map(e => `${e.key}=${e.value}`)
            : [];

        const containerConfig = {
            Image: imageTag,
            name: name,
            Env,
            Labels,
            HostConfig: {
                RestartPolicy: { Name: 'unless-stopped' },
                NetworkMode: 'bridge',
                // Runtime limits (assume default minimum footprint for free tiers if not specified)
                Memory: 512 * 1024 * 1024, // 512MB RAM
            }
        };

        console.log(`[GitDeploy] Creating container ${name}...`);
        const container = await docker.createContainer(containerConfig);
        await container.start();

        // Save to Database
        const webhookSecret = crypto.randomBytes(32).toString('hex');

        const dbContainer = new Container({
            name,
            image: imageTag,
            dockerId: container.id,
            userId: req.user.userId,
            status: 'running',
            domain: domain && domainPort ? domain.trim() : undefined,
            deployedViaGit: true,
            gitRepositoryUrl: gitUrl,
            gitWebhookSecret: webhookSecret
        });

        await dbContainer.save();

        await AuditLog.create({
            userId: req.user.userId,
            action: 'CREATE_CONTAINER',
            resourceName: name,
            details: `Deployed from Git: ${gitUrl}`
        });

        // Return the secret and webhook URL back to the frontend ONE TIME so the user can copy it
        res.status(201).json({
            container: dbContainer,
            webhookSecret,
            webhookUrl: `${req.protocol}://${req.get('host')}/api/webhooks/github`
        });

    } catch (error) {
        console.error(`[ERROR] Git Deploy Failed:`, error);
        res.status(500).json({ message: 'Error deploying repository', error: error.message });
    } finally {
        // Clean up temporary files
        if (tmpDir && fs.existsSync(tmpDir)) {
            console.log(`[GitDeploy] Cleaning up temporary directory ${tmpDir}...`);
            fs.rmSync(tmpDir, { recursive: true, force: true });
        }
    }
});

export default router;
