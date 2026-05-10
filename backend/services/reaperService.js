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
const PLAN_LIMITS = {
    free: {
        maxContainers: 2,
        maxRamMb: 1024,
        maxCpuCores: 1,
        maxDomains: 0,
        maxVolumes: 1,
        maxVolumeSizeMb: 1024,
        maxSnapshots: 0,
        maxBuckets: 1
    },
    pro: {
        maxContainers: 10,
        maxRamMb: 8192,
        maxCpuCores: 4,
        maxDomains: 3,
        maxVolumes: 5,
        maxVolumeSizeMb: 10240,
        maxSnapshots: 5,
        maxBuckets: 5
    },
    enterprise: {
        maxContainers: 50,
        maxRamMb: 32768,
        maxCpuCores: 16,
        maxDomains: 999,
        maxVolumes: 20,
        maxVolumeSizeMb: 102400,
        maxSnapshots: 999,
        maxBuckets: 999
    },
    agency: {
        maxContainers: 999,
        maxRamMb: 131072,
        maxCpuCores: 64,
        maxDomains: 999,
        maxVolumes: 100,
        maxVolumeSizeMb: 1048576,
        maxSnapshots: 999,
        maxBuckets: 999
    }
};

export const startReaper = () => {
    console.log(`[Reaper] Service started. Running unified cycle every ${REAPER_INTERVAL_MS / 1000}s`);

    setInterval(async () => {
        try {
            console.log('[Reaper] Running cycle...');
            const now = new Date();

            // 1. Apply scheduled plan changes
            const usersWithScheduledChanges = await User.find({
                pendingPlanType: { $ne: null },
                planChangeAt: { $ne: null, $lte: now }
            });
            for (const user of usersWithScheduledChanges) {
                const nextPlan = user.pendingPlanType;
                if (!nextPlan || !PLAN_LIMITS[nextPlan]) continue;
                console.log(`[Reaper] Applying scheduled plan change for ${user.email}: ${user.planType} -> ${nextPlan}`);
                user.planType = nextPlan;
                user.limits = PLAN_LIMITS[nextPlan];
                user.pendingPlanType = null;
                user.planChangeAt = null;
                await user.save();
            }

            // 2. Enforce free-tier uptime limits
            const freeUsers = await User.find({ planType: 'free' });
            for (const user of freeUsers) {
                const userContainers = await Container.find({ userId: user._id, status: 'running' });
                for (const dbContainer of userContainers) {
                    try {
                        const dockerContainer = docker.getContainer(dbContainer.dockerId);
                        const info = await dockerContainer.inspect();
                        if (!info.State.Running) {
                            dbContainer.status = 'stopped';
                            await dbContainer.save();
                            continue;
                        }
                        const startedAt = new Date(info.State.StartedAt);
                        if (now.getTime() - startedAt.getTime() > FREE_TIER_MAX_UPTIME_MS) {
                            console.log(`[Reaper] Stopping ${dbContainer.name} (${user.email}): 24h free-tier limit.`);
                            await dockerContainer.stop();
                            dbContainer.status = 'stopped';
                            await dbContainer.save();
                            await AuditLog.create({
                                userId: user._id,
                                action: 'STOP_CONTAINER',
                                resourceName: dbContainer.name,
                                details: '[Reaper Service] Free tier 24h continuous uptime limit reached.'
                            });
                        }
                    } catch (containerErr) {
                        if (containerErr.statusCode === 404) {
                            await Container.deleteOne({ _id: dbContainer._id });
                        } else {
                            console.error(`[Reaper] Error inspecting ${dbContainer.dockerId}:`, containerErr.message);
                        }
                    }
                }
            }

            // 3. Sweep orphaned VPC networks (merged into same cycle — no extra timer)
            try {
                const allUsers = await User.find({}, '_id').lean();
                for (const u of allUsers) {
                    await pruneUserVpcNetworks(u._id.toString());
                }
            } catch (vpcErr) {
                console.warn('[VPC Reaper] Global sweep error:', vpcErr.message);
            }

        } catch (err) {
            console.error('[Reaper] Error during cycle:', err);
        }
    }, REAPER_INTERVAL_MS);
};
