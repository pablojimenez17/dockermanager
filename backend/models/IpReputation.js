import mongoose from 'mongoose';

/**
 * IP Reputation System
 *
 * score:  0–100  (100 = clean, 0 = fully blacklisted)
 * Each security incident reduces the score.
 * Score recovers +5 per clean hour (handled by a TTL-based reset or cron).
 */
const incidentSchema = new mongoose.Schema({
    type: {
        type: String,
        enum: [
            'INJECTION_ATTEMPT',
            'RATE_LIMIT_HIT',
            'BOT_DETECTED',
            'FAILED_LOGIN',
            'SUSPICIOUS_UA',
            'INCOMPLETE_HEADERS',
            'TIMING_ANOMALY',
            'MANUAL_BLOCK',
        ],
        required: true,
    },
    detail: { type: String, default: '' },
    scoreDelta: { type: Number, required: true },  // negative = penalty
    createdAt: { type: Date, default: Date.now },
}, { _id: false });

const ipReputationSchema = new mongoose.Schema({
    ip: {
        type: String,
        required: true,
        unique: true,
        index: true,
        maxlength: 45, // IPv6 max length
    },
    score: {
        type: Number,
        default: 100,
        min: 0,
        max: 100,
    },
    blockedUntil: {
        type: Date,
        default: null,
    },
    manualBlock: {
        type: Boolean,
        default: false,
    },
    incidents: {
        type: [incidentSchema],
        default: [],
    },
    totalIncidents: {
        type: Number,
        default: 0,
    },
    lastSeenAt: {
        type: Date,
        default: Date.now,
    },
}, {
    timestamps: true,
});

// TTL index: auto-delete clean records (score=100, no incidents) after 30 days
ipReputationSchema.index({ updatedAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

const IpReputation = mongoose.model('IpReputation', ipReputationSchema);
export default IpReputation;
