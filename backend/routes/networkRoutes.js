import express from 'express';
import Docker from 'dockerode';
import authMiddleware from '../middleware/auth.js';
import NetworkModel from '../models/Network.js';

const router = express.Router();
// Use Dockerode connected to local socket
const docker = new Docker({ socketPath: process.platform === 'win32' ? '//./pipe/docker_engine' : '/var/run/docker.sock' });

router.use(authMiddleware);

// Get all networks for the logged-in user
router.get('/', async (req, res) => {
    try {
        const userId = req.user.userId;
        const userNetworks = await NetworkModel.find({ userId });
        const userNetworkIds = userNetworks.map(n => n.dockerId);

        const allNetworks = await docker.listNetworks();
        // Return only the networks owned by this user
        const filteredNetworks = allNetworks.filter(n => userNetworkIds.includes(n.Id));

        res.json(filteredNetworks);
    } catch (error) {
        console.error('Error fetching networks:', error);
        res.status(500).json({ message: 'Error retrieving networks', error: error.message });
    }
});

// Create a new custom network
router.post('/', async (req, res) => {
    try {
        const { name, subnet, gateway } = req.body;

        if (!name) {
            return res.status(400).json({ message: 'Network name is required' });
        }

        const networkConfig = {
            Name: name,
            Driver: 'bridge',
            CheckDuplicate: true,
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
        const newNetworkRecord = new NetworkModel({
            name: name,
            dockerId: network.id,
            userId: req.user.userId
        });
        await newNetworkRecord.save();

        res.status(201).json({ message: 'Network created successfully', network: networkInfo });
    } catch (error) {
        console.error('Error creating network:', error);
        res.status(500).json({ message: 'Error creating network', error: error.message });
    }
});

// Delete a network
router.delete('/:id', async (req, res) => {
    try {
        const networkId = req.params.id;
        const userId = req.user.userId;

        // Verify ownership in DB
        const networkRecord = await NetworkModel.findOne({ dockerId: networkId, userId });
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
