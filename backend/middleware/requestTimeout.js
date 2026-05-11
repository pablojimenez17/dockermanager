const DEFAULT_API_TIMEOUT_MS = parseInt(process.env.API_TIMEOUT_MS || '15000', 10);
const LONG_API_TIMEOUT_MS = parseInt(process.env.API_LONG_TIMEOUT_MS || '120000', 10);
const AI_API_TIMEOUT_MS = parseInt(process.env.API_AI_TIMEOUT_MS || '60000', 10);
const TIMEOUT_RESTART_THRESHOLD = parseInt(process.env.TIMEOUT_RESTART_THRESHOLD || '3', 10);
const TIMEOUT_RESTART_WINDOW_MS = parseInt(process.env.TIMEOUT_RESTART_WINDOW_MS || '60000', 10);
const TIMEOUT_RESTART_COOLDOWN_MS = parseInt(process.env.TIMEOUT_RESTART_COOLDOWN_MS || '120000', 10);

let recentTimeouts = [];
let restartScheduledAt = 0;

const isLongRunningRequest = (req) => {
    const url = req.originalUrl || req.url || '';
    const method = (req.method || 'GET').toUpperCase();

    if (url.startsWith('/api/git/deploy')) return true;
    if (url.startsWith('/api/ai/')) return 'ai';
    if (url.startsWith('/api/admin/backup/')) return true;
    if (url.includes('/upload')) return true;
    if (url.includes('/redeploy') || url.includes('/snapshot')) return true;
    if (url.startsWith('/api/containers') && ['POST', 'PUT', 'DELETE'].includes(method)) return true;
    if (url.startsWith('/api/networks') && ['POST', 'DELETE'].includes(method)) return true;
    if (url.startsWith('/api/volumes') && ['POST', 'DELETE'].includes(method)) return true;

    return false;
};

const getTimeoutMs = (req) => {
    const longRequest = isLongRunningRequest(req);
    if (longRequest === 'ai') return AI_API_TIMEOUT_MS;
    return longRequest ? LONG_API_TIMEOUT_MS : DEFAULT_API_TIMEOUT_MS;
};

const trackTimeoutAndMaybeRestart = (req, timeoutMs) => {
    const now = Date.now();
    recentTimeouts = recentTimeouts.filter((ts) => now - ts < TIMEOUT_RESTART_WINDOW_MS);
    recentTimeouts.push(now);

    console.error(
        `[RequestTimeout] ${req.method} ${req.originalUrl || req.url} exceeded ${timeoutMs}ms ` +
        `(${recentTimeouts.length}/${TIMEOUT_RESTART_THRESHOLD} in ${TIMEOUT_RESTART_WINDOW_MS}ms)`
    );

    if (
        recentTimeouts.length >= TIMEOUT_RESTART_THRESHOLD &&
        now - restartScheduledAt > TIMEOUT_RESTART_COOLDOWN_MS
    ) {
        restartScheduledAt = now;
        console.error('[RequestTimeout] Too many stuck requests. Exiting so Docker can restart the backend.');
        setTimeout(() => process.exit(1), 1000).unref();
    }
};

export default function requestTimeout(req, res, next) {
    const timeoutMs = getTimeoutMs(req);
    let timedOut = false;
    let sendingTimeoutResponse = false;

    const originalJson = res.json.bind(res);
    const originalSend = res.send.bind(res);
    const originalEnd = res.end.bind(res);

    res.json = (body) => {
        if (timedOut && !sendingTimeoutResponse) return res;
        return originalJson(body);
    };

    res.send = (body) => {
        if (timedOut && !sendingTimeoutResponse) return res;
        return originalSend(body);
    };

    res.end = (...args) => {
        if (timedOut && !sendingTimeoutResponse) return res;
        return originalEnd(...args);
    };

    const timer = setTimeout(() => {
        timedOut = true;
        req.timedout = true;
        trackTimeoutAndMaybeRestart(req, timeoutMs);

        if (!res.headersSent && !res.writableEnded) {
            sendingTimeoutResponse = true;
            res.status(503);
            res.set('Connection', 'close');
            originalJson({
                message: 'The server is taking too long to respond. Please try again in a few seconds.',
                code: 'REQUEST_TIMEOUT',
                timeoutMs,
            });
            sendingTimeoutResponse = false;
        }
    }, timeoutMs);

    const clear = () => clearTimeout(timer);
    res.on('finish', clear);
    res.on('close', clear);

    next();
}
