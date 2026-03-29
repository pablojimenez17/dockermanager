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
import templateRoutes from './routes/templateRoutes.js';
import bucketRoutes from './routes/bucketRoutes.js';
import snapshotRoutes from './routes/snapshotRoutes.js';
import orgRoutes from './routes/orgRoutes.js';
import { setupSockets } from './websockets.js';
import { initProxyService } from './proxyService.js';
import { initMinio } from './services/minioService.js';
import { initOllama } from './services/ollamaService.js';
import { startReaper } from './services/reaperService.js';
import { startBackupScheduler } from './services/backupService.js';
import User from './models/User.js';
import { createServer } from 'http';
import https from 'https';
import fs from 'fs';
import helmet from 'helmet';
import mongoSanitize from 'express-mongo-sanitize';
import xss from 'xss-clean';
import hpp from 'hpp';
import rateLimit from 'express-rate-limit';
dotenv.config();

const app = express();

// ── Security Middlewares ──
// 1. Set security HTTP headers
app.use(helmet());

// 2. Limit requests from the same IP
const limiter = rateLimit({
    max: 2000, // Limit each IP to 2000 requests per `window` (here, per hour)
    windowMs: 60 * 60 * 1000, // 1 hour
    message: 'Too many requests from this IP, please try again in an hour!'
});
app.use('/api', limiter);

// 3. Body parser, reading data from body into req.body
app.use(express.json({ limit: '10kb' }));

// 4. Data sanitization against NoSQL query injection
app.use(mongoSanitize());

// 5. Data sanitization against XSS
app.use(xss());

// 6. Prevent parameter pollution
app.use(hpp());

// Set up HTTPS Server
let server;
try {
    // FORCE HTTP FOR DEV:
    throw new Error('Forcing HTTP for local dev to avoid ERR_CERT_AUTHORITY_INVALID');
    const key = fs.readFileSync('./certs/key.pem');
    const cert = fs.readFileSync('./certs/cert.pem');
    server = https.createServer({ key, cert }, app);
    console.log('🔒 SSL Certificates loaded successfully! Running backend in secure HTTPS mode.');
} catch (error) {
    console.warn('⚠️ SSL Certificates not found or disabled. Falling back to insecure HTTP mode.', error.message);
    server = createServer(app);
}

// Initialize WebSockets for real-time Terminal
setupSockets(server);

// Cors
app.use(cors({
    origin: ['http://localhost:5173', 'https://localhost:5173', 'http://localhost', 'https://localhost'],
    credentials: true
}));
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
app.use('/api/templates', templateRoutes);
app.use('/api/buckets', bucketRoutes);
app.use('/api/snapshots', snapshotRoutes);
app.use('/api/organizations', orgRoutes);

// Database Connection
mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/dockermanager')
    .then(async () => {
        console.log('MongoDB connected...');

        // Boot the Proxy Service
        await initProxyService();

        // Boot MinIO Service
        try {
            await initMinio();
        } catch (minioErr) {
            console.error('Failed to initialize MinIO during boot:', minioErr);
        }

        // Boot Ollama Local AI Service
        try {
            await initOllama();
        } catch (ollamaErr) {
            console.error('Failed to initialize Ollama during boot:', ollamaErr);
        }

        // Start the Reaper Service for enforcing plan limits
        startReaper();

        // Start the automated MongoDB → NAS backup scheduler
        try {
            startBackupScheduler();
        } catch (backupErr) {
            console.error('Failed to start Backup Scheduler:', backupErr);
        }

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

