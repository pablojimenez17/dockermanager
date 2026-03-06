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
        maxVolumeSizeMb: 1024 // 1GB
    },
    pro: {
        maxContainers: 10,
        maxRamMb: 8192,
        maxCpuCores: 4,
        maxDomains: 3,
        maxVolumes: 5,
        maxVolumeSizeMb: 10240 // 10GB
    },
    enterprise: {
        maxContainers: 50,
        maxRamMb: 32768, // 32 GB
        maxCpuCores: 16,
        maxDomains: 99,
        maxVolumes: 20,
        maxVolumeSizeMb: 102400 // 100GB
    }
};

router.use(authMiddleware);

// Upgrade user plan
router.post('/upgrade', async (req, res) => {
    try {
        const { planType } = req.body;

        if (!['free', 'pro', 'enterprise'].includes(planType)) {
            return res.status(400).json({ message: 'Invalid plan type selected.' });
        }

        const user = await User.findById(req.user.userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }

        user.planType = planType;
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

export default router;
