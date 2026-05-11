import rateLimit from 'express-rate-limit';

/**
 * Centralised rate limiter definitions.
 *
 * Strategy (in-memory, single-instance):
 *  - authLimiter       → Login/Register/Forgot/Reset: 10 attempts / 15 min
 *  - sensitiveOpsLimiter → Container/Volume/Network CUD: 60 ops / 10 min
 *  - generalLimiter    → Read-heavy endpoints: 300 req / 5 min
 *  - aiLimiter         → AI endpoints: 5 req / 1 min (expensive)
 *  - adminLimiter      → Admin routes: 60 req / 5 min (tight — only admins)
 *
 * If you later scale horizontally, swap the `store` option to a RedisStore
 * without changing any route code:
 *   import { RedisStore } from 'rate-limit-redis';
 *   store: new RedisStore({ ... })
 */

const formatError = (endpoint) => ({
    message: `Too many requests to ${endpoint}. Please slow down and try again later.`,
});

// ── Auth: Brute-force protection ──────────────────────────────────────────────
export const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,   // 15 minutes
    max: 10,                    // 10 attempts per window
    standardHeaders: true,      // Return RateLimit-* headers
    legacyHeaders: false,
    message: formatError('authentication'),
    skipSuccessfulRequests: true, // Only count failed attempts
});

// ── Sensitive write operations (create/delete containers, networks, volumes) ──
export const sensitiveOpsLimiter = rateLimit({
    windowMs: 10 * 60 * 1000,   // 10 minutes
    max: 60,                    // 60 write ops per window
    standardHeaders: true,
    legacyHeaders: false,
    message: formatError('write operations'),
});

// ── General read endpoints ────────────────────────────────────────────────────
export const generalLimiter = rateLimit({
    windowMs: 5 * 60 * 1000,    // 5 minutes
    max: 300,                   // 300 reads per window
    standardHeaders: true,
    legacyHeaders: false,
    message: formatError('this endpoint'),
});

// ── AI endpoints (very expensive — strict cap) ────────────────────────────────
export const aiLimiter = rateLimit({
    windowMs: 60 * 1000,        // 1 minute
    max: 5,                     // 5 AI calls per minute
    standardHeaders: true,
    legacyHeaders: false,
    message: formatError('AI service'),
});

// ── Admin routes ──────────────────────────────────────────────────────────────
export const adminLimiter = rateLimit({
    windowMs: 5 * 60 * 1000,    // 5 minutes
    max: 60,
    standardHeaders: true,
    legacyHeaders: false,
    message: formatError('admin operations'),
});
