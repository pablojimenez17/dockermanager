import AuditLog from '../models/AuditLog.js';
import { recordIncident } from './ipReputation.js';

/**
 * Security Logger Middleware
 *
 * This is a RESPONSE-phase middleware (not a request interceptor).
 * It hooks into res.json() to inspect the final response and log
 * security-relevant events to AuditLog + IpReputation.
 *
 * Detected events:
 *  - 401 repeated on auth endpoints  → FAILED_LOGIN_ATTEMPT
 *  - 400 with "Validation error"      → potential injection probe
 *  - 429 rate-limit hits              → RATE_LIMIT_HIT
 *  - Mongo operator chars in body     → INJECTION_ATTEMPT
 */

// Regex to detect NoSQL injection operator attempts in raw body strings
const INJECTION_PATTERN = /[${}\[\]]/;

/**
 * Checks raw body keys recursively for injection operators.
 */
function detectInjection(obj, depth = 0) {
    if (depth > 5 || typeof obj !== 'object' || obj === null) return false;
    return Object.keys(obj).some(
        (key) => INJECTION_PATTERN.test(key) || detectInjection(obj[key], depth + 1)
    );
}

const securityLogger = (req, res, next) => {
    const ip = req.ip || req.socket?.remoteAddress;
    const originalJson = res.json.bind(res);

    // Override res.json to intercept outgoing responses
    res.json = function (body) {
        const statusCode = res.statusCode;
        const path = req.path;
        const userId = req.user?.userId;

        // ── Injection attempt in body keys ─────────────────────────────────
        if (req.body && detectInjection(req.body)) {
            setImmediate(() => {
                AuditLog.create({
                    userId,
                    action: 'SECURITY_INJECTION_ATTEMPT',
                    resourceName: path,
                    details: `IP: ${ip} | UA: ${(req.headers['user-agent'] || '').substring(0, 100)}`,
                }).catch(() => {});
                if (ip) recordIncident(ip, 'INJECTION_ATTEMPT', `Path: ${path}`, 30);
            });
        }

        // ── Auth failures (401 on /api/auth/*) ─────────────────────────────
        if (statusCode === 401 && path.startsWith('/auth')) {
            setImmediate(() => {
                AuditLog.create({
                    userId,
                    action: 'FAILED_LOGIN_ATTEMPT',
                    resourceName: path,
                    details: `IP: ${ip}`,
                }).catch(() => {});
                if (ip) recordIncident(ip, 'FAILED_LOGIN', `Path: ${path}`, 5);
            });
        }

        // ── Rate limit hits (429) ───────────────────────────────────────────
        if (statusCode === 429) {
            setImmediate(() => {
                AuditLog.create({
                    userId,
                    action: 'SECURITY_RATE_LIMIT_HIT',
                    resourceName: path,
                    details: `IP: ${ip}`,
                }).catch(() => {});
                if (ip) recordIncident(ip, 'RATE_LIMIT_HIT', `Path: ${path}`, 8);
            });
        }

        // ── Bot blocked (403 from botDetection) ────────────────────────────
        if (statusCode === 403 && body?.message?.includes('automated client')) {
            setImmediate(() => {
                AuditLog.create({
                    userId,
                    action: 'SECURITY_BOT_DETECTED',
                    resourceName: path,
                    details: `IP: ${ip} | UA: ${(req.headers['user-agent'] || '').substring(0, 100)}`,
                }).catch(() => {});
            });
        }

        return originalJson(body);
    };

    next();
};

export default securityLogger;
