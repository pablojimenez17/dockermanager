import express from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import authMiddleware from '../middleware/auth.js';
import { sendWelcomeEmail, sendVerificationCode, sendPasswordResetEmail } from '../services/emailService.js';

const router = express.Router();

// Helper to generate OTP
const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

// Validate password strength
const validatePasswordStrength = (password) => {
    const criteria = {
        length: password.length >= 8,
        lowercase: /[a-z]/.test(password),
        uppercase: /[A-Z]/.test(password),
        numbers: /[0-9]/.test(password),
        special: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password),
    };

    const errors = [];
    if (!criteria.length) errors.push('Password must be at least 8 characters long');
    if (!criteria.lowercase) errors.push('Password must contain lowercase letters');
    if (!criteria.uppercase) errors.push('Password must contain uppercase letters');
    if (!criteria.numbers) errors.push('Password must contain numbers');
    if (!criteria.special) errors.push('Password must contain special characters (!@#$%^&*)');

    return {
        isValid: errors.length === 0,
        errors,
        message: errors.join('; ')
    };
};

router.post('/register', async (req, res) => {
    try {
        const { name, email, password } = req.body;

        // Validate password
        const passwordValidation = validatePasswordStrength(password);
        if (!passwordValidation.isValid) {
            return res.status(400).json({ message: passwordValidation.message });
        }

        // Check if user exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ message: 'User already exists with this email' });
        }

        const ADMIN_EMAIL = 'admin@orbitcloud.app';
        const role = email.toLowerCase() === ADMIN_EMAIL ? 'admin' : 'user';
        const extraLimits = role === 'admin' ? {
            maxContainers: 9999, maxRamMb: 999999, maxCpuCores: 999,
            maxDomains: 999, maxVolumes: 999, maxVolumeSizeMb: 999999,
            maxSnapshots: 999, maxBuckets: 999
        } : {};

        const user = new User({ name, email, password, role, ...(role === 'admin' ? { planType: 'enterprise', limits: extraLimits } : {}) });
        
        const code = generateOTP();
        user.verificationCode = code;
        user.verificationCodeExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 mins
        await user.save();

        sendWelcomeEmail(user.email, user.name);
        sendVerificationCode(user.email, code);

        res.status(201).json({ 
            message: 'User created successfully. Verification required.', 
            requireVerification: true,
            email: user.email
        });
    } catch (error) {
        res.status(500).json({ message: 'Error creating user', error: error.message });
    }
});

router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        const code = generateOTP();
        user.verificationCode = code;
        user.verificationCodeExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 mins
        await user.save();

        sendVerificationCode(user.email, code);

        res.json({
            message: 'Verification required.',
            requireVerification: true,
            email: user.email
        });
    } catch (error) {
        res.status(500).json({ message: 'Error logging in', error: error.message });
    }
});

router.post('/verify-code', async (req, res) => {
    try {
        const { email, code } = req.body;

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({ message: 'Invalid request' });
        }

        if (!user.verificationCode || user.verificationCode !== code) {
            return res.status(401).json({ message: 'Invalid verification code' });
        }

        if (user.verificationCodeExpires < new Date()) {
            return res.status(401).json({ message: 'Verification code has expired' });
        }

        // Code valid, clear it
        user.verificationCode = undefined;
        user.verificationCodeExpires = undefined;
        await user.save();

        const token = jwt.sign({ userId: user._id, role: user.role }, process.env.JWT_SECRET || 'fallback_secret', { expiresIn: '1d' });

        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 24 * 60 * 60 * 1000 // 1 day
        });

        res.json({
            token,
            name: user.name,
            email: user.email,
            role: user.role,
            planType: user.planType,
            limits: user.limits
        });
    } catch (error) {
        res.status(500).json({ message: 'Error verifying code', error: error.message });
    }
});

router.post('/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;
        const user = await User.findOne({ email });
        
        if (!user) {
            // Return 200 anyway to prevent email enumeration
            return res.json({ message: 'If that email is in our database, we will send a recovery code.' });
        }

        const code = generateOTP();
        user.resetPasswordCode = code;
        user.resetPasswordExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 mins
        await user.save();

        sendPasswordResetEmail(user.email, code);

        res.json({ message: 'If that email is in our database, we will send a recovery code.', success: true });
    } catch (error) {
        res.status(500).json({ message: 'Error processing request', error: error.message });
    }
});

router.post('/reset-password', async (req, res) => {
    try {
        const { email, code, newPassword } = req.body;

        // Validate password
        const passwordValidation = validatePasswordStrength(newPassword);
        if (!passwordValidation.isValid) {
            return res.status(400).json({ message: passwordValidation.message });
        }

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({ message: 'Invalid request' });
        }

        if (!user.resetPasswordCode || user.resetPasswordCode !== code) {
            return res.status(401).json({ message: 'Invalid recovery code' });
        }

        if (user.resetPasswordExpires < new Date()) {
            return res.status(401).json({ message: 'Recovery code has expired' });
        }

        // Code valid, update password
        user.password = newPassword;
        user.resetPasswordCode = undefined;
        user.resetPasswordExpires = undefined;
        await user.save();

        res.json({ message: 'Password has been reset successfully. You can now log in.' });
    } catch (error) {
        res.status(500).json({ message: 'Error resetting password', error: error.message });
    }
});

// Logout Route
router.post('/logout', (req, res) => {
    res.clearCookie('token', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax'
    });
    res.json({ message: 'Logged out successfully' });
});

router.get('/me', authMiddleware, async (req, res) => {
    try {
        const user = await User.findById(req.user.userId).select('-password');
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const PLANS = {
            free: { maxContainers: 2, maxRamMb: 1024, maxCpuCores: 1, maxDomains: 0, maxVolumes: 1, maxVolumeSizeMb: 1024, maxBuckets: 1, maxSnapshots: 0 },
            pro: { maxContainers: 10, maxRamMb: 8192, maxCpuCores: 4, maxDomains: 3, maxVolumes: 5, maxVolumeSizeMb: 10240, maxSnapshots: 5, maxBuckets: 5 },
            enterprise: { maxContainers: 50, maxRamMb: 32768, maxCpuCores: 16, maxDomains: 999, maxVolumes: 20, maxVolumeSizeMb: 102400, maxSnapshots: 999, maxBuckets: 999 },
            agency: { maxContainers: 999, maxRamMb: 131072, maxCpuCores: 64, maxDomains: 999, maxVolumes: 100, maxVolumeSizeMb: 1048576, maxSnapshots: 999, maxBuckets: 999 }
        };

        const planType = (req.organization ? req.organization.plan : user.planType) || 'free';
        let resolvedLimits = user.limits;

        if (user.role === 'admin') {
             resolvedLimits = {
                maxContainers: 9999, maxRamMb: 999999, maxCpuCores: 999,
                maxDomains: 999, maxVolumes: 999, maxVolumeSizeMb: 999999,
                maxSnapshots: 999, maxBuckets: 999
            };
        } else if (PLANS[planType]) {
             resolvedLimits = PLANS[planType];
        }

        const responseObj = user.toObject();
        // Force planType to match the organization's plan if requested
        responseObj.planType = planType;
        responseObj.limits = resolvedLimits;

        res.json(responseObj);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching user profile', error: error.message });
    }
});

export default router;
