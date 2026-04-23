import express from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import authMiddleware from '../middleware/auth.js';

const router = express.Router();

// Validar fortaleza de contraseña
const validatePasswordStrength = (password) => {
    const criteria = {
        length: password.length >= 8,
        lowercase: /[a-z]/.test(password),
        uppercase: /[A-Z]/.test(password),
        numbers: /[0-9]/.test(password),
        special: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password),
    };

    const errors = [];
    if (!criteria.length) errors.push('La contraseña debe tener al menos 8 caracteres');
    if (!criteria.lowercase) errors.push('La contraseña debe contener letras minúsculas');
    if (!criteria.uppercase) errors.push('La contraseña debe contener letras mayúsculas');
    if (!criteria.numbers) errors.push('La contraseña debe contener números');
    if (!criteria.special) errors.push('La contraseña debe contener caracteres especiales (!@#$%^&*)');

    return {
        isValid: errors.length === 0,
        errors,
        message: errors.join('; ')
    };
};

router.post('/register', async (req, res) => {
    try {
        const { name, email, password } = req.body;

        // Validar contraseña
        const passwordValidation = validatePasswordStrength(password);
        if (!passwordValidation.isValid) {
            return res.status(400).json({ message: passwordValidation.message });
        }

        // Check if user exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ message: 'El usuario ya existe con este correo' });
        }

        const role = 'user';

        const user = new User({ name, email, password, role });
        await user.save();

        const token = jwt.sign({ userId: user._id, role: user.role }, process.env.JWT_SECRET || 'fallback_secret', { expiresIn: '1d' });

        // Set HTTP-Only Cookie
        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 24 * 60 * 60 * 1000 // 1 day
        });

        res.status(201).json({ 
            message: 'Usuario creado correctamente', 
            token,
            name: user.name,
            email: user.email,
            role: user.role,
            planType: user.planType,
            limits: user.limits
        });
    } catch (error) {
        res.status(500).json({ message: 'Error al crear usuario', error: error.message });
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
