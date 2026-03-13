import express from 'express';
import Secret, { encrypt, decrypt } from '../models/Secret.js';
import User from '../models/User.js';
import AuditLog from '../models/AuditLog.js';
import authMiddleware from '../middleware/auth.js';
import { checkPermission } from '../middleware/rbac.js';

const router = express.Router();
router.use(authMiddleware);

// Middleware to check Professional+ Plan
const checkProInfo = async (req, res, next) => {
    try {
        const ownerId = req.organization ? req.organization.ownerId : req.user.userId;
        const user = await User.findById(ownerId);

        if (!user) return res.status(404).json({ message: 'User not found' });

        if (!['pro', 'professional', 'enterprise', 'agency', 'msp', 'partner'].includes(user.planType) && user.role !== 'admin') {
            return res.status(403).json({
                message: 'Secret Manager is available starting from the Professional plan. Please upgrade to unlock.'
            });
        }
        next();
    } catch (error) {
        res.status(500).json({ message: 'Server error checking plan', error: error.message });
    }
};

router.use(checkProInfo);

// POST: Create a new secret
router.post('/', checkPermission('manageContainers'), async (req, res) => {
    try {
        const { name, value, description } = req.body;

        if (!name || !value) {
            return res.status(400).json({ message: 'Secret name and value are required.' });
        }

        // Validate format (alphanumeric and underscores)
        if (!/^[A-Za-z0-9_]+$/.test(name)) {
            return res.status(400).json({ message: 'Secret names can only contain letters, numbers, and underscores.' });
        }

        const query = req.organization
            ? { organizationId: req.organization._id, name }
            : { userId: req.user.userId, organizationId: { $exists: false }, name };

        // Check if secret with same name exists for this user/org
        const existingSecret = await Secret.findOne(query);
        if (existingSecret) {
            return res.status(409).json({ message: 'A secret with this name already exists.' });
        }

        // Encrypt the value
        const { iv, encryptedData } = encrypt(value);

        const secretData = {
            userId: req.user.userId,
            name,
            encryptedValue: encryptedData,
            iv,
            description
        };
        if (req.organization) {
            secretData.organizationId = req.organization._id;
        }

        const newSecret = new Secret(secretData);

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
        const query = req.organization
            ? { organizationId: req.organization._id }
            : { userId: req.user.userId, organizationId: { $exists: false } };

        const secrets = await Secret.find(query)
            .select('-encryptedValue -iv')
            .sort({ createdAt: -1 });

        res.json(secrets);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching secrets.', error: error.message });
    }
});

// DELETE: Remove a secret
router.delete('/:id', checkPermission('manageContainers'), async (req, res) => {
    try {
        const query = req.organization
            ? { _id: req.params.id, organizationId: req.organization._id }
            : { _id: req.params.id, userId: req.user.userId, organizationId: { $exists: false } };

        const secret = await Secret.findOneAndDelete(query);
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
