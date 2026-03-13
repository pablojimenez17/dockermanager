import express from 'express';
import multer from 'multer';
import User from '../models/User.js';
import authMiddleware from '../middleware/auth.js';
import { checkPermission } from '../middleware/rbac.js';
import { getMinioClient } from '../services/minioService.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() }); // Buffer file strings in memory

// Protect all routes
router.use(authMiddleware);

// --- BUCKETS ---

// List all buckets
router.get('/', async (req, res) => {
    try {
        const client = getMinioClient();
        const buckets = await client.listBuckets();
        const ownerPrefix = req.organization
            ? `org-${req.organization._id}-`
            : `user-${req.user.userId}-`;

        // Only return buckets that belong to this user/org
        const userBuckets = buckets
            .filter(b => b.name.startsWith(ownerPrefix))
            .map(b => ({
                ...b,
                name: b.name.replace(ownerPrefix, '') // Hide prefix from frontend
            }));

        res.json(userBuckets);
    } catch (err) {
        console.error('MinIO List Buckets Error:', err);
        res.status(500).json({ message: 'Failed to list buckets', error: err.message });
    }
});

// Create a new bucket
router.post('/', checkPermission('manageVolumes'), async (req, res) => {
    try {
        const { name } = req.body;
        if (!name) return res.status(400).json({ message: 'Bucket name required' });

        const ownerId = req.organization ? req.organization.ownerId : req.user.userId;
        const ownerPrefix = req.organization
            ? `org-${req.organization._id}-`
            : `user-${req.user.userId}-`;

        // Retrieve owner limits
        const user = await User.findById(ownerId);
        const maxBuckets = user?.limits?.maxBuckets || 1;

        const client = getMinioClient();

        // Measure current usage
        const buckets = await client.listBuckets();
        const currentCount = buckets.filter(b => b.name.startsWith(ownerPrefix)).length;

        if (currentCount >= maxBuckets) {
            return res.status(403).json({ message: `Quota Exceeded: Your plan limits you to ${maxBuckets} bucket(s).` });
        }

        // AWS S3 rules apply to minio bucket naming
        let bucketName = name.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
        const realBucketName = `${ownerPrefix}${bucketName}`;

        const exists = await client.bucketExists(realBucketName);
        if (exists) {
            return res.status(409).json({ message: 'Bucket already exists' });
        }

        await client.makeBucket(realBucketName, 'us-east-1');
        res.status(201).json({ message: `Bucket ${bucketName} created successfully`, name: bucketName });
    } catch (err) {
        console.error('MinIO Create Bucket Error:', err);
        res.status(500).json({ message: 'Failed to create bucket', error: err.message });
    }
});

// Delete a bucket
router.delete('/:bucketName', checkPermission('deleteVolumes'), async (req, res) => {
    try {
        const { bucketName } = req.params;
        const ownerPrefix = req.organization
            ? `org-${req.organization._id}-`
            : `user-${req.user.userId}-`;
        const realBucketName = `${ownerPrefix}${bucketName}`;
        const client = getMinioClient();

        await client.removeBucket(realBucketName);
        res.json({ message: `Bucket ${bucketName} deleted successfully` });
    } catch (err) {
        console.error('MinIO Delete Bucket Error:', err);
        res.status(500).json({ message: 'Failed to delete bucket. Ensure bucket is empty first.', error: err.message });
    }
});

// --- OBJECTS ---

// List objects in a bucket
router.get('/:bucketName/objects', async (req, res) => {
    try {
        const { bucketName } = req.params;
        const ownerPrefix = req.organization
            ? `org-${req.organization._id}-`
            : `user-${req.user.userId}-`;
        const realBucketName = `${ownerPrefix}${bucketName}`;
        const client = getMinioClient();

        const objectsList = [];
        const stream = client.listObjects(realBucketName, '', true);

        stream.on('data', (obj) => { objectsList.push(obj); });
        stream.on('error', (err) => {
            console.error('MinIO Stream Error:', err);
            res.status(500).json({ message: 'Error streaming files', error: err.message });
        });
        stream.on('end', () => {
            res.json(objectsList);
        });
    } catch (err) {
        console.error('MinIO List Objects Error:', err);
        res.status(500).json({ message: 'Failed to list objects', error: err.message });
    }
});

// Upload a single file into a bucket
router.post('/:bucketName/upload', checkPermission('manageVolumes'), upload.single('file'), async (req, res) => {
    try {
        const { bucketName } = req.params;
        const ownerPrefix = req.organization
            ? `org-${req.organization._id}-`
            : `user-${req.user.userId}-`;
        const realBucketName = `${ownerPrefix}${bucketName}`;
        const file = req.file;

        if (!file) return res.status(400).json({ message: 'No file provided' });

        const client = getMinioClient();

        // MinIO PUT Object requires data buffer and size
        await client.putObject(realBucketName, file.originalname, file.buffer, file.size, {
            'Content-Type': file.mimetype
        });

        res.status(201).json({ message: 'File uploaded successfully', fileName: file.originalname });
    } catch (err) {
        console.error('MinIO Upload Error:', err);
        res.status(500).json({ message: 'Failed to upload file', error: err.message });
    }
});

// Delete an object from a bucket
router.delete('/:bucketName/objects/:objectName(*)', checkPermission('manageVolumes'), async (req, res) => {
    try {
        const { bucketName, objectName } = req.params;
        const ownerPrefix = req.organization
            ? `org-${req.organization._id}-`
            : `user-${req.user.userId}-`;
        const realBucketName = `${ownerPrefix}${bucketName}`;
        const client = getMinioClient();

        await client.removeObject(realBucketName, objectName);
        res.json({ message: `Object ${objectName} deleted` });
    } catch (err) {
        console.error('MinIO Delete Object Error:', err);
        res.status(500).json({ message: 'Failed to delete object', error: err.message });
    }
});

export default router;
