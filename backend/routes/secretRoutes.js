import express from 'express';
import Secret, { encrypt, decrypt } from '../models/Secret.js';
import User from '../models/User.js';
import AuditLog from '../models/AuditLog.js';
import authMiddleware from '../middleware/auth.js';

const router = express.Router();
router.use(authMiddleware);

// POST: Create a new secret
router.post('/', async (req, res) => {
    try {
        const { name, value, description } = req.body;

        if (!name || !value) {
            return res.status(400).json({ message: 'Secret name and value are required.' });
        }

        // Validate format (alphanumeric and underscores)
        if (!/^[A-Za-z0-9_]+$/.test(name)) {
            return res.status(400).json({ message: 'Secret names can only contain letters, numbers, and underscores.' });
        }

        // Check if secret with same name exists for this user
        const existingSecret = await Secret.findOne({ userId: req.user.userId, name });
        if (existingSecret) {
            return res.status(409).json({ message: 'A secret with this name already exists.' });
        }

        // Encrypt the value
        const { iv, encryptedData } = encrypt(value);

        const newSecret = new Secret({
            userId: req.user.userId,
            name,
            encryptedValue: encryptedData,
            iv,
            description
        });

        await newSecret.save();

        await AuditLog.create({
            userId: req.user.userId,
            action: 'CREATED_SECRET',
            resourceName: name,
            details: `Created secret: ${name}`
        });

        res.status(201).json({
            message: 'Secret saved securely.',
            secret: { _id: newSecret._id, name: newSecret.name, description: newSecret.description, createdAt: newSecret.createdAt }
        });

    } catch (error) {
        console.error('Error creating secret:', error);
        res.status(500).json({ message: 'Error storing secret.', error: error.message });
    }
});

// GET: List all secrets (WITHOUT returning their values)
router.get('/', async (req, res) => {
    try {
        const secrets = await Secret.find({ userId: req.user.userId })
            .select('-encryptedValue -iv')
            .sort({ createdAt: -1 });

        res.json(secrets);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching secrets.', error: error.message });
    }
});

// DELETE: Remove a secret
router.delete('/:id', async (req, res) => {
    try {
        const secret = await Secret.findOneAndDelete({ _id: req.params.id, userId: req.user.userId });
        if (!secret) {
            return res.status(404).json({ message: 'Secret not found or unauthorized.' });
        }

        await AuditLog.create({
            userId: req.user.userId,
            action: 'DELETED_SECRET',
            resourceName: secret.name,
            details: `Deleted secret: ${secret.name}`
        });

        res.json({ message: 'Secret deleted successfully.' });
    } catch (error) {
        res.status(500).json({ message: 'Error deleting secret.', error: error.message });
    }
});

export default router;
