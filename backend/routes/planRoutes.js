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

const PLAN_PRIORITY = {
    enterprise: 0,
    agency: 1,
    pro: 2,
    free: 3
};

const isValidPlanType = (planType) => Object.prototype.hasOwnProperty.call(PLANS, planType);

router.use(authMiddleware);

// Change user plan (upgrade immediate, downgrade scheduled)
router.post('/upgrade', async (req, res) => {
    try {
        const { planType } = req.body;

        if (!isValidPlanType(planType)) {
            return res.status(400).json({ message: 'Invalid plan type selected.' });
        }
        if (planType === 'free') {
            return res.status(400).json({ message: 'Free (Hobby) cannot be selected directly. Use cancel subscription instead.' });
        }

        const user = await User.findById(req.user.userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }

        const currentPlan = user.planType || 'free';
        const currentPriority = PLAN_PRIORITY[currentPlan];
        const targetPriority = PLAN_PRIORITY[planType];

        if (currentPriority === targetPriority) {
            user.pendingPlanType = null;
            user.planChangeAt = null;
            await user.save();

            return res.json({
                message: `Your current plan is already ${planType}.`,
                planType: user.planType,
                pendingPlanType: user.pendingPlanType,
                planChangeAt: user.planChangeAt,
                autoRenew: user.autoRenew,
                limits: user.limits,
                planExpiresAt: user.planExpiresAt
            });
        }

        const isUpgrade = targetPriority < currentPriority;

        if (isUpgrade) {
            user.planType = planType;
            user.autoRenew = true;
            const expiration = new Date();
            expiration.setMonth(expiration.getMonth() + 1);
            user.planExpiresAt = expiration;
            user.pendingPlanType = null;
            user.planChangeAt = null;
            user.limits = PLANS[planType];
            await user.save();

            return res.json({
                message: `Successfully upgraded to ${planType} plan.`,
                planType: user.planType,
                pendingPlanType: user.pendingPlanType,
                planChangeAt: user.planChangeAt,
                autoRenew: user.autoRenew,
                limits: user.limits,
                planExpiresAt: user.planExpiresAt
            });
        }

        const effectiveDate = user.planExpiresAt || new Date();
        user.pendingPlanType = planType;
        user.planChangeAt = effectiveDate;
        await user.save();

        res.json({
            message: `Downgrade to ${planType} scheduled for end of billing cycle.`,
            planType: user.planType,
            pendingPlanType: user.pendingPlanType,
            planChangeAt: user.planChangeAt,
            autoRenew: user.autoRenew,
            limits: user.limits,
            planExpiresAt: user.planExpiresAt
        });

    } catch (error) {
        res.status(500).json({ message: 'Error upgrading plan', error: error.message });
    }
});

// Cancel plan (schedule downgrade to free at cycle end)
router.post('/cancel', async (req, res) => {
    try {
        const user = await User.findById(req.user.userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }

        if (user.planType === 'free') {
            return res.status(400).json({ message: 'You are already on the Free plan.' });
        }

        user.autoRenew = false;
        user.pendingPlanType = 'free';
        user.planChangeAt = user.planExpiresAt || new Date();
        await user.save();

        res.json({
            message: 'Subscription cancelled. Your account will move to Hobby at the end of the billing cycle.',
            planType: user.planType,
            pendingPlanType: user.pendingPlanType,
            planChangeAt: user.planChangeAt,
            autoRenew: user.autoRenew,
            planExpiresAt: user.planExpiresAt,
            limits: user.limits
        });

    } catch (error) {
        res.status(500).json({ message: 'Error cancelling plan', error: error.message });
    }
});

export default router;
