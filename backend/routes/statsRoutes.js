import express from 'express';
import Docker from 'dockerode';
import Container from '../models/Container.js';
import authMiddleware from '../middleware/auth.js';

const router = express.Router();
const docker = new Docker(process.env.DOCKER_HOST ? { host: process.env.DOCKER_HOST.split(':')[1].replace('//', ''), port: process.env.DOCKER_HOST.split(':').pop() } : { socketPath: process.platform === 'win32' ? '//./pipe/docker_engine' : '/var/run/docker.sock' });

router.use(authMiddleware);

// Get stats for a specific container
router.get('/:id', async (req, res) => {
    try {
        const dbContainer = await Container.findOne({ _id: req.params.id, userId: req.user.userId });
        if (!dbContainer) {
            return res.status(404).json({ message: 'Container not found' });
        }

        const container = docker.getContainer(dbContainer.dockerId);

        // Get single stats snapshot (stream: false) and inspect data
        const [stats, info] = await Promise.all([
            container.stats({ stream: false }),
            container.inspect()
        ]);

        let networkMode = info.HostConfig.NetworkMode;
        let ipv4Address = 'N/A';

        if (info.NetworkSettings && info.NetworkSettings.Networks) {
            const networks = info.NetworkSettings.Networks;
            const netNames = Object.keys(networks);
            if (netNames.length > 0) {
                // Get the first network's IP address
                ipv4Address = networks[netNames[0]].IPAddress || ipv4Address;
                // If the mode is default 'default', use the custom network's name instead
                if (networkMode === 'default' || !networkMode) networkMode = netNames[0];
            }
        }

        // Calculate simple percentages
        // CPU calculation can be complex depending on OS; simplified here
        let cpuPercent = 0.0;
        try {
            const cpuDelta = stats.cpu_stats.cpu_usage.total_usage - stats.precpu_stats.cpu_usage.total_usage;
            const systemDelta = stats.cpu_stats.system_cpu_usage - stats.precpu_stats.system_cpu_usage;
            if (systemDelta > 0 && cpuDelta > 0) {
                cpuPercent = (cpuDelta / systemDelta) * stats.cpu_stats.online_cpus * 100.0;
            }
        } catch (e) {
            // Handle if stats format diff
        }

        let memUsage = stats.memory_stats.usage;
        let memLimit = stats.memory_stats.limit;
        let memPercent = 0.0;
        if (memLimit > 0) {
            memPercent = (memUsage / memLimit) * 100.0;
        }

        res.json({
            cpuPercent: cpuPercent.toFixed(2),
            memUsage: memUsage,
            memLimit: memLimit,
            memPercent: memPercent.toFixed(2),
            networkMode: networkMode,
            ipv4Address: ipv4Address,
            raw: stats
        });
    } catch (error) {
        res.status(500).json({ message: 'Error fetching stats', error: error.message });
    }
});

router.get('/:id/logs', async (req, res) => {
    try {
        const dbContainer = await Container.findOne({ _id: req.params.id, userId: req.user.userId });
        if (!dbContainer) {
            return res.status(404).json({ message: 'Container not found' });
        }

        const container = docker.getContainer(dbContainer.dockerId);

        const logs = await container.logs({
            stdout: true,
            stderr: true,
            tail: 100, // last 100 lines
            timestamps: true
        });

        res.send(logs.toString('utf-8'));
    } catch (error) {
        res.status(500).json({ message: 'Error fetching logs', error: error.message });
    }
});

export default router;
