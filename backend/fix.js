import mongoose from 'mongoose';
import User from './models/User.js';

mongoose.connect('mongodb://localhost:27017/dockermanager').then(async () => {
    const users = await User.find({});
    for (let u of users) {
        if (u.planType === 'enterprise') {
            u.limits = { maxContainers: 50, maxRamMb: 32768, maxCpuCores: 16, maxDomains: 999, maxVolumes: 20, maxVolumeSizeMb: 102400, maxSnapshots: 999, maxBuckets: 999 };
            await u.save();
            console.log('Updated ' + u.email);
        } else if (u.planType === 'pro') {
            u.limits = { maxContainers: 10, maxRamMb: 8192, maxCpuCores: 4, maxDomains: 3, maxVolumes: 5, maxVolumeSizeMb: 10240, maxSnapshots: 5, maxBuckets: 5 };
            await u.save();
            console.log('Updated ' + u.email);
        }
    }
    console.log('Done');
    process.exit(0);
});
