import { recordIncident } from './ipReputation.js';

/**
 * Known headless/bot User-Agent patterns.
 * These strings appear in automated tools but not in real browsers.
 */
const BOT_UA_PATTERNS = [
    /headlesschrome/i,
    /phantomjs/i,
    /selenium/i,
    /puppeteer/i,
    /playwright/i,
    /python-requests/i,
    /go-http-client/i,
    /java\/\d/i,
    /libwww-perl/i,
    /curl\/\d/i,
    /wget\/\d/i,
    /scrapy/i,
    /httpx/i,
    /aiohttp/i,
    /axios\/\d/i,
    /okhttp/i,
    /bot[^a-z]/i,
    /crawler/i,
    /spider/i,
];

/**
 * Headers that real browsers always send but bots often omit.
 * We require at least 2 of these to be present.
 */
const EXPECTED_BROWSER_HEADERS = [
    'accept',
    'accept-language',
    'accept-encoding',
];

/**
 * Paths that are exempt from ALL bot detection checks.
 * socket.io polling legitimately fires 10-20 req/s per client → would
 * always trigger the timing anomaly threshold and break real-time features.
 */
const EXEMPT_PATHS = [
    '/api/health',
    '/api/billing/webhook',
    '/socket.io',          // socket.io polling & websocket upgrade
    '/favicon',
    '/assets',
];

/**
 * Per-IP request timing tracker (in-memory, auto-expires).
 * Structure: { [ip]: { lastTs: number, rapidCount: number } }
 */
const timingTracker = new Map();
const TIMING_WINDOW_MS = 1000;   // 1 second window
const RAPID_THRESHOLD = 40;      // >40 req/s = bot behaviour (raised from 15 to avoid false-positives on SPA navigation)
const TRACKER_CLEANUP_INTERVAL = 60 * 1000; // cleanup every 60s

// Periodic cleanup to prevent memory leak
setInterval(() => {
    const cutoff = Date.now() - 5 * 60 * 1000; // entries older than 5 min
    for (const [ip, data] of timingTracker.entries()) {
        if (data.lastTs < cutoff) timingTracker.delete(ip);
    }
}, TRACKER_CLEANUP_INTERVAL);

/**
 * Bot Detection middleware.
 *
 * Checks (in order):
 *  1. Path exemption (socket.io, health, billing webhook, assets)
 *  2. User-Agent blacklist (known automation tools)
 *  3. Empty/missing User-Agent (always a bot)
 *  4. Missing expected browser headers
 *  5. Request timing anomaly (too many requests in 1 second)
 */
const botDetection = async (req, res, next) => {
    // Skip exempt paths — socket.io polling especially must not be rate-checked
    const path = req.path || '';
    if (EXEMPT_PATHS.some((p) => path.startsWith(p))) {
        return next();
    }

    const ip = req.ip || req.socket.remoteAddress;
    const ua = req.headers['user-agent'] || '';

    // ── 1. Empty User-Agent ───────────────────────────────────────────────────
    if (!ua || ua.trim().length === 0) {
        if (ip) {
            recordIncident(ip, 'SUSPICIOUS_UA', 'Empty User-Agent', 20);
        }
        return res.status(403).json({ message: 'Request blocked: missing User-Agent.' });
    }

    // ── 2. Blacklisted User-Agent ─────────────────────────────────────────────
    if (BOT_UA_PATTERNS.some((pattern) => pattern.test(ua))) {
        if (ip) {
            recordIncident(ip, 'BOT_DETECTED', `Blocked UA: ${ua.substring(0, 100)}`, 25);
        }
        return res.status(403).json({ message: 'Request blocked: automated client detected.' });
    }

    // ── 3. Missing browser headers (only enforce on non-API-key paths) ─────────
    const presentBrowserHeaders = EXPECTED_BROWSER_HEADERS.filter(
        (h) => req.headers[h] !== undefined
    );
    if (presentBrowserHeaders.length < 2 && !req.headers['x-api-key']) {
        if (ip) {
            recordIncident(ip, 'INCOMPLETE_HEADERS', `Present: ${presentBrowserHeaders.join(',')}`, 10);
        }
        // Soft block for missing headers — only if IP already has low reputation
        if (req.lowReputationIp) {
            return res.status(403).json({ message: 'Request blocked: incomplete request headers.' });
        }
    }

    // ── 4. Timing anomaly detection ───────────────────────────────────────────
    if (ip) {
        const now = Date.now();
        const tracker = timingTracker.get(ip) || { lastTs: now, rapidCount: 0 };

        if (now - tracker.lastTs < TIMING_WINDOW_MS) {
            tracker.rapidCount += 1;
        } else {
            tracker.rapidCount = 1;
            tracker.lastTs = now;
        }

        timingTracker.set(ip, tracker);

        if (tracker.rapidCount > RAPID_THRESHOLD) {
            recordIncident(ip, 'TIMING_ANOMALY', `${tracker.rapidCount} req/s`, 15);
            return res.status(429).json({
                message: 'Request rate too high. Please slow down.',
                retryAfter: 5,
            });
        }
    }

    next();
};

export default botDetection;
