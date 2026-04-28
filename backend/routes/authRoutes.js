import express from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import authMiddleware from '../middleware/auth.js';
import { sendWelcomeEmail } from '../services/emailService.js';

const router = express.Router();

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
        await user.save();

        // Send welcome email (asynchronous, we don't await so it doesn't block the response)
        sendWelcomeEmail(user.email, user.name);

        const token = jwt.sign({ userId: user._id, role: user.role }, process.env.JWT_SECRET || 'fallback_secret', { expiresIn: '1d' });

        // Set HTTP-Only Cookie
        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 24 * 60 * 60 * 1000 // 1 day
        });

        res.status(201).json({ 
            message: 'User created successfully', 
            token,
            name: user.name,
            email: user.email,
            role: user.role,
            planType: user.planType,
            limits: user.limits
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

        const token = jwt.sign({ userId: user._id, role: user.role }, process.env.JWT_SECRET || 'fallback_secret', { expiresIn: '1d' });

        // Set HTTP-Only Cookie
        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 24 * 60 * 60 * 1000 // 1 day
        });

        res.json({
            token, // Kept for backwards compatibility if needed during migration
            name: user.name,
            email: user.email,
            role: user.role,
            planType: user.planType,
            limits: user.limits
        });
    } catch (error) {
        res.status(500).json({ message: 'Error logging in', error: error.message });
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
        res.json(user);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching user profile', error: error.message });
    }
});

export default router;
