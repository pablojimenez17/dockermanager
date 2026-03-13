import express from 'express';
import Registry, { encrypt, decrypt } from '../models/Registry.js';
import User from '../models/User.js';
import AuditLog from '../models/AuditLog.js';
import authMiddleware from '../middleware/auth.js';
import { checkPermission } from '../middleware/rbac.js';

const router = express.Router();
router.use(authMiddleware);

// Middleware to check Enterprise/Agency Plan
const checkEnterpriseInfo = async (req, res, next) => {
    try {
        const ownerId = req.organization ? req.organization.ownerId : req.user.userId;
        const user = await User.findById(ownerId);

        if (!user) return res.status(404).json({ message: 'User not found' });

        // Must be enterprise or agency plan
        if (!['enterprise', 'agency', 'msp', 'partner'].includes(user.planType) && user.role !== 'admin') {
            return res.status(403).json({
                message: 'Private Registries are an Enterprise exclusive feature. Please upgrade your plan to unlock.'
            });
        }
        next();
    } catch (error) {
        res.status(500).json({ message: 'Server error checking plan' });
    }
};

router.use(checkEnterpriseInfo);

// POST: Save new registry credentials
router.post('/', checkPermission('manageContainers'), async (req, res) => {
    try {
        const { name, url, username, password } = req.body;

        if (!name || !url || !username || !password) {
            return res.status(400).json({ message: 'All fields (name, url, username, password) are required.' });
        }

        // Validate name
        if (!/^[A-Za-z0-9_]+$/.test(name)) {
            return res.status(400).json({ message: 'Name can only contain letters, numbers, and underscores.' });
        }

        const query = req.organization
            ? { organizationId: req.organization._id, $or: [{ name }, { url }] }
            : { userId: req.user.userId, organizationId: { $exists: false }, $or: [{ name }, { url }] };

        const existingRegistry = await Registry.findOne(query);
        if (existingRegistry) {
            return res.status(409).json({ message: 'A registry with this name or URL already exists in your vault.' });
        }

        // Encrypt the password
        const { iv, encryptedData } = encrypt(password);

        const registryData = {
            userId: req.user.userId,
            name,
            url,
            username,
            encryptedPassword: encryptedData,
            iv
        };
        if (req.organization) {
            registryData.organizationId = req.organization._id;
        }

        const newRegistry = new Registry(registryData);

        await newRegistry.save();

        await AuditLog.create({
            userId: req.user.userId,
            action: 'CREATED_REGISTRY',
            resourceName: name,
            details: `Saved registry credentials for: ${url}`
        });

        res.status(201).json({
            message: 'Registry credentials saved securely.',
            registry: { _id: newRegistry._id, name: newRegistry.name, url: newRegistry.url, username: newRegistry.username, createdAt: newRegistry.createdAt }
        });

    } catch (error) {
        res.status(500).json({ message: 'Error storing registry.', error: error.message });
    }
});

// GET: List registries (WITHOUT exposing passwords)
router.get('/', async (req, res) => {
    try {
        const query = req.organization
            ? { organizationId: req.organization._id }
            : { userId: req.user.userId, organizationId: { $exists: false } };

        const registries = await Registry.find(query)
            .select('-encryptedPassword -iv')
            .sort({ createdAt: -1 });

        res.json(registries);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching registries.', error: error.message });
    }
});

// DELETE: Remove a registry
router.delete('/:id', checkPermission('manageContainers'), async (req, res) => {
    try {
        const query = req.organization
            ? { _id: req.params.id, organizationId: req.organization._id }
            : { _id: req.params.id, userId: req.user.userId, organizationId: { $exists: false } };

        const registry = await Registry.findOneAndDelete(query);
        if (!registry) {
            return res.status(404).json({ message: 'Registry not found or unauthorized.' });
        }

        await AuditLog.create({
            userId: req.user.userId,
            action: 'DELETED_REGISTRY',
            resourceName: registry.name,
            details: `Deleted registry credentials: ${registry.name}`
        });

        res.json({ message: 'Registry deleted successfully.' });
    } catch (error) {
        res.status(500).json({ message: 'Error deleting registry.', error: error.message });
    }
});

export default router;
