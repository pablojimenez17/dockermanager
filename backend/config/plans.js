export const PLAN_LIMITS = {
    free: {
        maxContainers: 2,
        maxRamMb: 1024,
        maxCpuCores: 1,
        maxDomains: 0,
        maxPublicContainers: 1,   // containers with public internet access (isPublic: true)
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
        maxPublicContainers: 9999, // effectively unlimited
        maxVolumes: 100,
        maxVolumeSizeMb: 1048576,
        maxSnapshots: 999,
        maxBuckets: 999
    }
};

export const PLAN_PRIORITY = {
    agency: 0,
    enterprise: 1,
    pro: 2,
    free: 3
};

export const PAID_PLAN_TYPES = ['pro', 'enterprise', 'agency'];

export const isValidPlanType = (planType) => Object.prototype.hasOwnProperty.call(PLAN_LIMITS, planType);
