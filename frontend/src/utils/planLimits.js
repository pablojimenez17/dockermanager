/**
 * Centralized plan limits resolver.
 * This is the single source of truth for plan quotas in the frontend.
 * Even if the backend DB has stale limits, this ensures the UI always
 * shows the correct quotas for the user's current planType.
 */

const PLANS = {
    free: {
        maxContainers: 2,
        maxRamMb: 1024,
        maxCpuCores: 1,
        maxDomains: 0,
        maxPublicContainers: 1,  // containers with public internet access
        maxVolumes: 1,
        maxVolumeSizeMb: 1024,
        maxBuckets: 1,
        maxSnapshots: 0
    },
    pro: {
        maxContainers: 10,
        maxRamMb: 8192,
        maxCpuCores: 4,
        maxDomains: 3,
        maxPublicContainers: 8,
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
        maxPublicContainers: 50,
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
        maxPublicContainers: 9999,
        maxVolumes: 100,
        maxVolumeSizeMb: 1048576,
        maxSnapshots: 999,
        maxBuckets: 999
    }
};

/**
 * Resolves the correct limits for a user based on their planType and role.
 * @param {object} userData - The response from /api/auth/me
 * @returns {object} The resolved limits object
 */
export function resolveLimits(userData) {
    if (!userData) return PLANS.free;

    // Admins get unlimited everything
    if (userData.role === 'admin') {
        return {
            maxContainers: 9999,
            maxRamMb: 999999,
            maxCpuCores: 999,
            maxDomains: 999,
            maxPublicContainers: 9999,
            maxVolumes: 999,
            maxVolumeSizeMb: 999999,
            maxSnapshots: 999,
            maxBuckets: 999
        };
    }

    const planType = (userData.planType || 'free').toLowerCase();
    return PLANS[planType] || PLANS.free;
}

export default PLANS;
