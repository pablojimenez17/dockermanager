import Docker from 'dockerode';
import User from '../models/User.js';
import Container from '../models/Container.js';
import AuditLog from '../models/AuditLog.js';

const docker = new Docker(
    process.env.DOCKER_HOST 
      ? { host: process.env.DOCKER_HOST.split('://')[1].split(':')[0], port: process.env.DOCKER_HOST.split(':').pop() }
      : { socketPath: process.platform === 'win32' ? '//./pipe/docker_engine' : '/var/run/docker.sock' }
);

/**
 * Prune user VPC networks that are empty (no user containers attached).
 * Called after container stops/deletes both from the Reaper and DELETE route.
 */
export const pruneUserVpcNetworks = async (userId) => {
    try {
        const nets = await docker.listNetworks({
            filters: { label: [`dockermanager.vpc=true`, `dockermanager.owner=${userId}`] }
        });
        for (const netInfo of nets) {
            try {
                const network = docker.getNetwork(netInfo.Id);
                const details = await network.inspect();
                const containers = Object.values(details.Containers || {});
                const userContainers = containers.filter(c => !c.Name.includes('lan-proxy'));
                if (userContainers.length === 0) {
                    for (const c of containers) {
                        if (c.Name.includes('lan-proxy')) {
                            try { await network.disconnect({ Container: c.Name, Force: true }); } catch (_) {}
                        }
                    }
                    await network.remove();
                    console.log(`[VPC Reaper] Removed orphaned network: ${netInfo.Name}`);
                }
            } catch (e) {
                if (e.statusCode !== 404) console.warn(`[VPC Reaper] ${netInfo.Name}:`, e.message);
            }
        }
    } catch (err) {
        console.warn('[VPC Reaper] Network prune error:', err.message);
    }
};

// Reaper checks every 5 minutes by default
const REAPER_INTERVAL_MS = 5 * 60 * 1000;
const FREE_TIER_MAX_UPTIME_MS = 24 * 60 * 60 * 1000; // 24 hours

export const startReaper = () => {
    console.log(`[Reaper] Service started. Checking for idle/expired containers every ${REAPER_INTERVAL_MS / 1000}s`);
    
    setInterval(async () => {
        try {
            console.log('[Reaper] Running cycle...');
            const now = new Date();

            // 1. Find users whose plan has expired 
            // OR who are on the 'free' plan (which might need uptime enforcement)
            const usersToCheck = await User.find({
                $or: [
                    { planExpiresAt: { $lt: now } },
                    { planType: 'free' }
                ]
            });

            for (const user of usersToCheck) {
                // Determine if user has fully expired a paid plan
                const isPaidPlanExpired = user.planType !== 'free' && user.planExpiresAt && new Date(user.planExpiresAt) < now;

                // Find all their running containers from DB
                const userContainers = await Container.find({ userId: user._id, status: 'running' });

                for (const dbContainer of userContainers) {
                    try {
                        const dockerContainer = docker.getContainer(dbContainer.dockerId);
                        const info = await dockerContainer.inspect();

                        // Skip if already stopped physically but DB somehow said running
                        if (!info.State.Running) {
                            dbContainer.status = 'stopped';
                            await dbContainer.save();
                            continue;
                        }

                        let shouldStop = false;
                        let reason = '';

                        // Rule A: Paid plan is currently expired
                        if (isPaidPlanExpired) {
                            shouldStop = true;
                            reason = 'Plan subscription expired.';
                        } 
                        // Rule B: Free tier uptime enforcement (e.g. 24h limit like Heroku)
                        else if (user.planType === 'free') {
                            const startedAt = new Date(info.State.StartedAt);
                            const uptimeMs = now.getTime() - startedAt.getTime();
                            
                            if (uptimeMs > FREE_TIER_MAX_UPTIME_MS) {
                                shouldStop = true;
                                reason = `Free tier 24h continuous uptime limit reached.`;
                            }
                        }

                        if (shouldStop) {
                            console.log(`[Reaper] Stopping container ${dbContainer.name} (User: ${user.email}). Reason: ${reason}`);
                            await dockerContainer.stop();

                            dbContainer.status = 'stopped';
                            await dbContainer.save();

                            await AuditLog.create({
                                userId: user._id,
                                action: 'STOP_CONTAINER',
                                resourceName: dbContainer.name,
                                details: `[Reaper Service] ${reason}`
                            });
                        }

                    } catch (containerErr) {
                        if (containerErr.statusCode === 404) {
                            // Container deleted externally
                            await Container.deleteOne({ _id: dbContainer._id });
                        } else {
                            console.error(`[Reaper] Error inspecting container ${dbContainer.dockerId}:`, containerErr.message);
                        }
                    }
                }
            }
        } catch (err) {
            console.error('[Reaper] Error during cycle execute:', err);
        }
    }, REAPER_INTERVAL_MS);

    // Phase 3: Sweep orphaned VPC networks for ALL users once per reaper cycle
    setInterval(async () => {
        try {
            console.log('[VPC Reaper] Sweeping orphaned VPC networks...');
            const allUsers = await User.find({}, '_id').lean();
            for (const u of allUsers) {
                await pruneUserVpcNetworks(u._id.toString());
            }
        } catch (err) {
            console.warn('[VPC Reaper] Global sweep error:', err.message);
        }
    }, REAPER_INTERVAL_MS);
};
