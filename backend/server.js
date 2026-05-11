import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import compression from 'compression';
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
// import bucketRoutes from './routes/bucketRoutes.js';
import snapshotRoutes from './routes/snapshotRoutes.js';
import orgRoutes from './routes/orgRoutes.js';
import billingRoutes, { billingWebhookHandler } from './routes/billingRoutes.js';
import { setupSockets } from './websockets.js';
import { initProxyService } from './proxyService.js';
import { initMinio } from './services/minioService.js';
import { initOllama } from './services/ollamaService.js';
import { startReaper } from './services/reaperService.js';
import { startBackupScheduler } from './services/backupService.js';
import { repairProxyNetworks } from './services/proxyRepairService.js';
import User from './models/User.js';
import { createServer } from 'http';
import https from 'https';
import fs from 'fs';
import helmet from 'helmet';
import mongoSanitize from 'express-mongo-sanitize';
import xss from 'xss-clean';
import hpp from 'hpp';
import rateLimit from 'express-rate-limit';
// ── Security Layer Middlewares ──
import ipReputationMiddleware from './middleware/ipReputation.js';
import botDetection from './middleware/botDetection.js';
import securityLogger from './middleware/securityLogger.js';
import requestTimeout from './middleware/requestTimeout.js';
dotenv.config();

// ──────────────────────────────────────────────────────────────────
// VPS Stability: Process-level error handlers
// These prevent silent crashes from unhandled promise rejections or
// synchronous throws that escape all try/catch blocks.
// On a low-spec VPS these are the #1 cause of "goes slow and needs restart".
// ──────────────────────────────────────────────────────────────────
process.on('unhandledRejection', (reason, promise) => {
    // Log the error but DO NOT crash the process.
    // Docker restart:always will restart if the process exits; we prefer to stay up
    // and serve the requests that ARE working.
    console.error('[Process] Unhandled Promise Rejection at:', promise, 'reason:', reason);
    requestShutdown('unhandledRejection', 1);
});

process.on('uncaughtException', (err) => {
    // An uncaught synchronous exception leaves the process in an undefined state,
    // so we DO exit — but gracefully, giving Docker time to restart us.
    console.error('[Process] Uncaught Exception — initiating graceful exit in 1s:', err);
    requestShutdown('uncaughtException', 1);
});

process.on('SIGTERM', () => requestShutdown('SIGTERM', 0));
process.on('SIGINT', () => requestShutdown('SIGINT', 0));


const app = express();
let server;
let shuttingDown = false;

const HEALTH_MAX_RSS_MB = parseInt(process.env.HEALTH_MAX_RSS_MB || '700', 10);
const HEALTH_MAX_HEAP_MB = parseInt(process.env.HEALTH_MAX_HEAP_MB || '384', 10);
const HEALTH_MAX_EVENT_LOOP_LAG_MS = parseInt(process.env.HEALTH_MAX_EVENT_LOOP_LAG_MS || '1000', 10);
let eventLoopLagMs = 0;

setInterval(() => {
    const started = Date.now();
    setImmediate(() => {
        eventLoopLagMs = Math.max(0, Date.now() - started);
    });
}, 1000).unref();

function requestShutdown(reason, exitCode = 1) {
    if (shuttingDown) return;
    shuttingDown = true;
    console.error(`[Process] Graceful shutdown requested: ${reason}`);

    const forceExit = setTimeout(() => {
        console.error('[Process] Force exiting after graceful shutdown timeout.');
        process.exit(exitCode);
    }, 10000);
    forceExit.unref();

    if (!server) {
        process.exit(exitCode);
        return;
    }

    server.close(() => {
        mongoose.connection.close(false).finally(() => process.exit(exitCode));
    });
}

function healthHandler(_req, res) {
    const mem = process.memoryUsage();
    const rssMb = Math.round(mem.rss / 1024 / 1024);
    const heapUsedMb = Math.round(mem.heapUsed / 1024 / 1024);
    const reasons = [];

    if (shuttingDown) reasons.push('process_shutting_down');
    if (mongoose.connection.readyState !== 1) reasons.push('mongodb_not_connected');
    if (rssMb > HEALTH_MAX_RSS_MB) reasons.push(`rss_above_${HEALTH_MAX_RSS_MB}mb`);
    if (heapUsedMb > HEALTH_MAX_HEAP_MB) reasons.push(`heap_above_${HEALTH_MAX_HEAP_MB}mb`);
    if (eventLoopLagMs > HEALTH_MAX_EVENT_LOOP_LAG_MS) reasons.push(`event_loop_lag_above_${HEALTH_MAX_EVENT_LOOP_LAG_MS}ms`);

    res.status(reasons.length ? 503 : 200).json({
        status: reasons.length ? 'unhealthy' : 'ok',
        reasons,
        ts: Date.now(),
        memory: {
            rss_mb: rssMb,
            heap_used_mb: heapUsedMb,
            heap_total_mb: Math.round(mem.heapTotal / 1024 / 1024),
        },
        event_loop_lag_ms: eventLoopLagMs,
        mongo_ready_state: mongoose.connection.readyState,
        uptime_s: Math.round(process.uptime()),
    });
}

// ── Compression (gzip) ──
// Reduces response sizes ~70%, critical on a low-bandwidth VPS.
// Skips already-compressed content (images, video, binary) automatically.
app.use(compression({ threshold: 1024 }));

// Trust the first proxy (Traefik) so rate-limit & IP detection work correctly
app.set('trust proxy', 1);

// Health check: keep this before rate limits and bot/security middleware.
app.get('/api/health', healthHandler);

// CORS and cookies must run before API security middleware so error responses
// and preflight requests are visible to the SPA instead of hanging client-side.
app.use(cors({
    origin: [
        'http://localhost:5173',
        'https://localhost:5173',
        'http://localhost',
        'https://localhost',
        'https://orbitcloud.app',
        'https://www.orbitcloud.app'
    ],
    credentials: true
}));
app.use(cookieParser());

// Fail fast for stuck API requests instead of leaving the UI loading for minutes.
app.use('/api', requestTimeout);

// ── Security Middlewares ──
// 1. Set security HTTP headers
app.use(helmet());

// 2. Limit requests from the same IP (global backstop — granular limits applied per-route)
const limiter = rateLimit({
    max: 500,               // Tightened: 500 req/h per IP (down from 2000)
    windowMs: 60 * 60 * 1000, // 1 hour
    standardHeaders: true,
    legacyHeaders: false,
    message: 'Too many requests from this IP, please try again in an hour!'
});
app.use('/api', limiter);

// 3. Security logger — intercepts res.json() to log malicious events to AuditLog
app.use(securityLogger);

// 3. Stripe webhook must receive the raw body to validate signatures.
app.post('/api/billing/webhook', express.raw({ type: 'application/json' }), billingWebhookHandler);

// 4. Body parser, reading data from body into req.body
app.use(express.json({ limit: '10kb' }));

// 5. Data sanitization against NoSQL query injection
app.use(mongoSanitize());

// 6. Data sanitization against XSS
app.use(xss());

// 7. Prevent parameter pollution
app.use(hpp());

// 8. IP Reputation check — blocks blacklisted IPs (registered after body parsers)
app.use(ipReputationMiddleware);

// 9. Bot detection — blocks headless browsers, empty UAs, timing anomalies
app.use(botDetection);

// Set up HTTPS Server
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

server.requestTimeout = parseInt(process.env.SERVER_REQUEST_TIMEOUT_MS || '130000', 10);
server.headersTimeout = parseInt(process.env.SERVER_HEADERS_TIMEOUT_MS || '135000', 10);
server.keepAliveTimeout = parseInt(process.env.SERVER_KEEPALIVE_TIMEOUT_MS || '65000', 10);

// Health check — no auth required, used by Docker healthcheck & load balancers
// Returns memory stats to help diagnose VPS slowness
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
// app.use('/api/buckets', bucketRoutes);
app.use('/api/snapshots', snapshotRoutes);
app.use('/api/organizations', orgRoutes);
app.use('/api/billing', billingRoutes);

// Database Connection — tuned for low-spec VPS
// maxPoolSize:5  → don't open more than 5 concurrent MongoDB connections
// serverSelectionTimeoutMS → fail fast on connection loss instead of hanging
// heartbeatFrequencyMS → detect a dropped connection within 10s
// socketTimeoutMS → abandon a query that hangs more than 60s
mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/dockermanager', {
    maxPoolSize: 5,
    minPoolSize: 1,
    serverSelectionTimeoutMS: 10000,
    heartbeatFrequencyMS: 10000,
    socketTimeoutMS: 60000,
    connectTimeoutMS: 10000,
})
    .then(async () => {
        console.log('MongoDB connected...');

        // Reconnect events — log so we know if MongoDB drops/recovers
        mongoose.connection.on('error', err =>
            console.error('[MongoDB] Connection error:', err.message)
        );
        mongoose.connection.on('disconnected', () =>
            console.warn('[MongoDB] Disconnected — mongoose will auto-reconnect...')
        );
        mongoose.connection.on('reconnected', () =>
            console.log('[MongoDB] Reconnected successfully.')
        );

        // Memory watchdog — log a warning every 5 min if RSS is too high.
        // On a 1-2 GB VPS anything above 400 MB is a red flag for a memory leak.
        const MEM_WARN_MB = parseInt(process.env.MEM_WARN_MB || '400');
        setInterval(() => {
            const rssMb = Math.round(process.memoryUsage().rss / 1024 / 1024);
            if (rssMb > MEM_WARN_MB) {
                console.warn(`[Memory] WARNING: RSS is ${rssMb} MB (threshold ${MEM_WARN_MB} MB). Consider restarting if this keeps growing.`);
            } else {
                console.log(`[Memory] RSS: ${rssMb} MB — OK`);
            }
        }, 5 * 60 * 1000);

        // Boot the Proxy Service
        await initProxyService();

        // Boot MinIO Service
        try {
            await initMinio();
        } catch (minioErr) {
            console.error('Failed to initialize MinIO during boot:', minioErr);
        }

        // Boot Ollama Local AI Service — fire-and-forget, never blocks startup
        (async () => {
            try { await initOllama(); }
            catch (ollamaErr) { console.error('Failed to initialize Ollama during boot:', ollamaErr); }
        })();

        // Auto-repair proxy ↔ VPC network connections for all public containers.
        // Fixes Bad Gateway on existing containers without needing VPS access.
        (async () => {
            try { await repairProxyNetworks(); }
            catch (repairErr) { console.warn('ProxyRepair failed (non-fatal):', repairErr.message); }
        })();

        // Start the Reaper Service for enforcing plan limits
        startReaper();

        // Start the automated MongoDB → NAS backup scheduler
        try {
            startBackupScheduler();
        } catch (backupErr) {
            console.error('Failed to start Backup Scheduler:', backupErr);
        }
    })
    .catch((err) => console.error('Error connecting to MongoDB:', err));

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});

