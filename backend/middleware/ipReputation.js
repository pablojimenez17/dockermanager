import IpReputation from '../models/IpReputation.js';

/**
 * In-memory cache to avoid a DB hit on every request.
 * Structure: { [ip]: { blockedUntil: Date|null, score: number, cachedAt: number } }
 * Cache TTL: 5 minutes
 */
const cache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Score penalty thresholds:
 *  score >= 60  → normal traffic
 *  score 30-59  → challenge mode: stricter rate limiting applied elsewhere
 *  score < 30   → blocked entirely
 */
const BLOCK_THRESHOLD = 30;

/**
 * Fetch IP reputation from cache first, then DB.
 */
async function getReputation(ip) {
    const cached = cache.get(ip);
    if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
        return cached;
    }

    const record = await IpReputation.findOne({ ip }).lean();
    const entry = record
        ? { blockedUntil: record.blockedUntil, score: record.score, manualBlock: record.manualBlock }
        : { blockedUntil: null, score: 100, manualBlock: false };

    cache.set(ip, { ...entry, cachedAt: Date.now() });
    return entry;
}

/**
 * Invalidate cache for an IP (called by securityLogger after updating score).
 */
export function invalidateIpCache(ip) {
    cache.delete(ip);
}

/**
 * Record a security incident for an IP and adjust its score.
 * @param {string} ip
 * @param {string} type  - incident type (matches IpReputation.incidents.type enum)
 * @param {string} detail - optional context
 * @param {number} penalty - score reduction (positive number = penalty)
 */
export async function recordIncident(ip, type, detail = '', penalty = 10) {
    try {
        const record = await IpReputation.findOneAndUpdate(
            { ip },
            {
                $inc: { score: -penalty, totalIncidents: 1 },
                $push: {
                    incidents: {
                        $each: [{ type, detail, scoreDelta: -penalty }],
                        $slice: -50, // keep only the last 50 incidents
                    },
                },
                $set: { lastSeenAt: new Date() },
                // If score drops below threshold, block for 1 hour
                ...(penalty >= 20 ? { $set: { blockedUntil: new Date(Date.now() + 60 * 60 * 1000), lastSeenAt: new Date() } } : {}),
            },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );

        // Clamp score to [0, 100]
        if (record.score < 0) {
            await IpReputation.updateOne({ ip }, { $set: { score: 0, blockedUntil: new Date(Date.now() + 24 * 60 * 60 * 1000) } });
        }

        // Invalidate cache so next request re-reads from DB
        invalidateIpCache(ip);
    } catch (err) {
        // Non-fatal — never block the request pipeline due to reputation DB issues
        console.error('[IpReputation] recordIncident error:', err.message);
    }
}

/**
 * Express middleware — blocks requests from IPs with score < BLOCK_THRESHOLD
 * or with an active blockedUntil date.
 */
const ipReputationMiddleware = async (req, res, next) => {
    // Skip internal health checks and Stripe webhooks
    if (req.path === '/api/health' || req.path === '/api/billing/webhook') {
        return next();
    }

    const ip = req.ip || req.socket.remoteAddress;
    if (!ip) return next(); // Cannot determine IP — let it pass

    try {
        const rep = await getReputation(ip);

        // Manual or auto block still active
        if (rep.manualBlock || (rep.blockedUntil && new Date(rep.blockedUntil) > new Date())) {
            const retryAfter = rep.manualBlock
                ? 'indefinitely'
                : Math.ceil((new Date(rep.blockedUntil) - Date.now()) / 1000);

            return res.status(429).json({
                message: 'Your IP has been temporarily blocked due to suspicious activity.',
                retryAfter: rep.manualBlock ? null : retryAfter,
            });
        }

        // Low score — attach flag for downstream middlewares (e.g. bot detection can be stricter)
        if (rep.score < BLOCK_THRESHOLD + 30) {
            req.lowReputationIp = true;
        }

        next();
    } catch (err) {
        // Non-fatal — let the request through if DB is unavailable
        console.error('[IpReputation] middleware error:', err.message);
        next();
    }
};

export default ipReputationMiddleware;
