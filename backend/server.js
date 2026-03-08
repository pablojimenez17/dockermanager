import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import authRoutes from './routes/authRoutes.js';
import containerRoutes from './routes/containerRoutes.js';
import statsRoutes from './routes/statsRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import aiRoutes from './routes/aiRoutes.js';
import networkRoutes from './routes/networkRoutes.js';
import planRoutes from './routes/planRoutes.js';
import gitRoutes from './routes/gitRoutes.js';
import volumeRoutes from './routes/volumeRoutes.js';
import secretRoutes from './routes/secretRoutes.js';
import registryRoutes from './routes/registryRoutes.js';
import webhookRoutes from './routes/webhookRoutes.js';
import { setupSockets } from './websockets.js';
import { initProxyService } from './proxyService.js';
import User from './models/User.js';
import { createServer } from 'http';

dotenv.config();

const app = express();
const server = createServer(app);

// Initialize WebSockets for real-time Terminal
setupSockets(server);

// Middleware
app.use(cors({
    origin: 'http://localhost:5173', // Vite default port
    credentials: true // Required for HTTP-Only cookies
}));
app.use(express.json());
app.use(cookieParser());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/containers', containerRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/networks', networkRoutes);
app.use('/api/plans', planRoutes);
app.use('/api/git', gitRoutes);
app.use('/api/volumes', volumeRoutes);
app.use('/api/secrets', secretRoutes);
app.use('/api/registries', registryRoutes);
app.use('/api/webhooks', webhookRoutes);

// Database Connection
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/dockermanager')
    .then(async () => {
        console.log('MongoDB connected...');

        // Boot the Proxy Service
        await initProxyService();

        // Seed default admin user if no admins
        try {
            const existingAdmin = await User.findOne({ email: 'test' });
            if (!existingAdmin) {
                const adminUser = new User({
                    name: 'Test Admin',
                    email: 'test',
                    password: 'user',
                    role: 'admin'
                });
                await adminUser.save();
                console.log('Admin user "test" (password: "user") created successfully.');
            } else {
                console.log('Admin user "test" already exists.');
            }
        } catch (error) {
            console.error('Error seeding admin user:', error);
        }
    })
    .catch((err) => console.error('Error connecting to MongoDB:', err));

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});
