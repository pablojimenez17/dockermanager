import express from 'express';
import Docker from 'dockerode';
import authMiddleware from '../middleware/auth.js';
import { checkPermission } from '../middleware/rbac.js';
import NetworkModel from '../models/Network.js';

const router = express.Router();
// Use Dockerode connected to local socket
const docker = new Docker(process.env.DOCKER_HOST ? { host: process.env.DOCKER_HOST.split(':')[1].replace('//', ''), port: process.env.DOCKER_HOST.split(':').pop() } : { socketPath: process.platform === 'win32' ? '//./pipe/docker_engine' : '/var/run/docker.sock' });

router.use(authMiddleware);

// Get all networks for the logged-in user or organization
router.get('/', async (req, res) => {
    try {
        const query = req.organization
            ? { organizationId: req.organization._id }
            : { userId: req.user.userId, organizationId: { $exists: false } };

        const userNetworks = await NetworkModel.find(query);
        const userNetworkIds = userNetworks.map(n => n.dockerId);

        const allNetworks = await docker.listNetworks();
        // Return only the networks owned by this user/org
        const filteredNetworks = allNetworks.filter(n => userNetworkIds.includes(n.Id));

        res.json(filteredNetworks);
    } catch (error) {
        console.error('Error fetching networks:', error);
        res.status(500).json({ message: 'Error retrieving networks', error: error.message });
    }
});

// Create a new custom network (always prefixed + internal for VPC isolation)
router.post('/', checkPermission('manageNetworks'), async (req, res) => {
    try {
        const { name, subnet, gateway } = req.body;

        if (!name) {
            return res.status(400).json({ message: 'Network name is required' });
        }

        // Enforce user-scoped namespacing to prevent collisions between tenants
        const prefixedName = `${req.user.userId}_${name.replace(/[^a-zA-Z0-9_-]/g, '-')}`;

        // Check for duplicate in Docker
        const existing = await docker.listNetworks({ filters: { name: [prefixedName] } });
        if (existing.find(n => n.Name === prefixedName)) {
            return res.status(409).json({ message: `A network named "${name}" already exists` });
        }

        const networkConfig = {
            Name: prefixedName,
            Driver: 'bridge',
            CheckDuplicate: true,
            Internal: true, // Always internal — prevents egress outside the user's VPC
            Labels: {
                'dockermanager.vpc': 'true',
                'dockermanager.owner': req.user.userId.toString(),
                'dockermanager.display_name': name // Keep original name for UI display
            }
        };

        // If user provided subnet/gateway, add IPAM config
        if (subnet || gateway) {
            const ipamConfig = {};
            if (subnet) ipamConfig.Subnet = subnet;
            if (gateway) ipamConfig.Gateway = gateway;

            networkConfig.IPAM = {
                Driver: 'default',
                Config: [ipamConfig]
            };
        }

        const network = await docker.createNetwork(networkConfig);
        const networkInfo = await network.inspect();

        // Save to DB to establish ownership
        const networkData = {
            name: prefixedName,
            dockerId: network.id,
            userId: req.user.userId
        };
        if (req.organization) {
            networkData.organizationId = req.organization._id;
        }

        const newNetworkRecord = new NetworkModel(networkData);
        await newNetworkRecord.save();

        res.status(201).json({ message: 'Network created successfully', network: networkInfo, displayName: name, prefixedName });
    } catch (error) {
        console.error('Error creating network:', error);
        res.status(500).json({ message: 'Error creating network', error: error.message });
    }
});


// Delete a network
router.delete('/:id', checkPermission('manageNetworks'), async (req, res) => {
    try {
        const networkId = req.params.id;
        const query = req.organization
            ? { dockerId: networkId, organizationId: req.organization._id }
            : { dockerId: networkId, userId: req.user.userId, organizationId: { $exists: false } };

        // Verify ownership in DB
        const networkRecord = await NetworkModel.findOne(query);
        if (!networkRecord) {
            return res.status(403).json({ message: 'Unauthorized or network not found' });
        }

        const network = docker.getNetwork(networkId);

        // Inspect to see if it exists
        await network.inspect();

        await network.remove();

        // Delete from DB tracking
        await NetworkModel.deleteOne({ dockerId: networkId });

        res.json({ message: 'Network deleted successfully' });
    } catch (error) {
        console.error('Error deleting network:', error);

        // Handle specific dockerode error codes
        if (error.statusCode === 404) {
            return res.status(404).json({ message: 'Network not found' });
        }
        if (error.statusCode === 403) {
            return res.status(403).json({ message: 'Network has active endpoints (containers are using it)', error: error.message });
        }

        res.status(500).json({ message: 'Error deleting network', error: error.message });
    }
});

export default router;
