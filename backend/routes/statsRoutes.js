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

        // Verify Docker container still exists
        let info;
        try {
            info = await container.inspect();
        } catch (inspectErr) {
            if (inspectErr.statusCode === 404) {
                return res.status(404).json({ message: 'Docker container no longer exists' });
            }
            throw inspectErr;
        }

        const logsBuffer = await container.logs({
            stdout: true,
            stderr: true,
            tail: 200,
            timestamps: true
            // Note: follow is intentionally omitted (defaults false) — works on both running and stopped containers
        });

        // Docker multiplexes stdout/stderr with an 8-byte header per chunk.
        // Strip those header bytes so the frontend receives clean text.
        if (info.Config.Tty) {
            // TTY containers: raw text, no header
            res.send(logsBuffer.toString('utf-8'));
        } else {
            // Non-TTY: strip the 8-byte multiplexing header from each chunk
            const lines = [];
            let buf = Buffer.isBuffer(logsBuffer) ? logsBuffer : Buffer.from(logsBuffer);
            let offset = 0;
            while (offset + 8 <= buf.length) {
                const size = buf.readUInt32BE(offset + 4);
                offset += 8;
                if (offset + size <= buf.length) {
                    lines.push(buf.slice(offset, offset + size).toString('utf-8'));
                    offset += size;
                } else {
                    break;
                }
            }
            res.send(lines.join(''));
        }
    } catch (error) {
        console.error('[Logs Error]', error);
        res.status(500).json({ message: 'Error fetching logs', error: error.message });
    }
});

export default router;
