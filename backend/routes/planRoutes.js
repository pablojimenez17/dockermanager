import express from 'express';
import User from '../models/User.js';
import authMiddleware from '../middleware/auth.js';

const router = express.Router();

// Define plans
const PLANS = {
    free: {
        maxContainers: 2,
        maxRamMb: 1024,
        maxCpuCores: 1,
        maxDomains: 0,
        maxVolumes: 1,
        maxVolumeSizeMb: 1024, // 1GB
        maxBuckets: 1
    },
    pro: {
        maxContainers: 10,
        maxRamMb: 8192,
        maxCpuCores: 4,
        maxDomains: 3,
        maxVolumes: 5,
        maxVolumeSizeMb: 10240, // 10GB
        maxSnapshots: 5,
        maxBuckets: 5
    },
    enterprise: {
        maxContainers: 50,
        maxRamMb: 32768, // 32 GB
        maxCpuCores: 16,
        maxDomains: 999,
        maxVolumes: 20,
        maxVolumeSizeMb: 102400, // 100GB
        maxSnapshots: 999,
        maxBuckets: 999
    },
    agency: {
        maxContainers: 999,
        maxRamMb: 131072, // 128 GB
        maxCpuCores: 64,
        maxDomains: 999,
        maxVolumes: 100,
        maxVolumeSizeMb: 1048576, // 1TB
        maxSnapshots: 999,
        maxBuckets: 999
    }
};

router.use(authMiddleware);

// Upgrade user plan
router.post('/upgrade', async (req, res) => {
    try {
        const { planType } = req.body;

        if (!['free', 'pro', 'enterprise', 'agency'].includes(planType)) {
            return res.status(400).json({ message: 'Invalid plan type selected.' });
        }

        const user = await User.findById(req.user.userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }

        user.planType = planType;
        user.autoRenew = true; // Ensure autoRenew is on when upgrading
        // Mock auto-renewal one month from today
        const expiration = new Date();
        expiration.setMonth(expiration.getMonth() + 1);
        user.planExpiresAt = expiration;

        user.limits = PLANS[planType];

        await user.save();

        res.json({
            message: `Successfully upgraded to ${planType} plan!`,
            planType: user.planType,
            limits: user.limits,
            planExpiresAt: user.planExpiresAt
        });

    } catch (error) {
        res.status(500).json({ message: 'Error upgrading plan', error: error.message });
    }
});

// Cancel plan (disable auto-renew)
router.post('/cancel', async (req, res) => {
    try {
        const user = await User.findById(req.user.userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }

        if (user.planType === 'free') {
            return res.status(400).json({ message: 'You are already on the Free plan.' });
        }

        // Only disable auto-renew. The Reaper Service will take care of downgrading when planExpiresAt passes.
        user.autoRenew = false;
        await user.save();

        res.json({
            message: 'Your plan has been cancelled and will not renew. You can keep using your resources until the end of the billing period.',
            autoRenew: false,
            planExpiresAt: user.planExpiresAt
        });

    } catch (error) {
        res.status(500).json({ message: 'Error cancelling plan', error: error.message });
    }
});

export default router;
