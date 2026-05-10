import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true
    },
    password: {
        type: String,
        required: true
    },
    role: {
        type: String,
        enum: ['user', 'admin'],
        default: 'user'
    },
    planType: {
        type: String,
        enum: ['free', 'pro', 'enterprise', 'agency'],
        default: 'free'
    },
    planExpiresAt: {
        type: Date
    },
    autoRenew: {
        type: Boolean,
        default: true
    },
    pendingPlanType: {
        type: String,
        enum: ['free', 'pro', 'enterprise', 'agency', null],
        default: null
    },
    planChangeAt: {
        type: Date,
        default: null
    },
    stripeCustomerId: {
        type: String,
        default: null,
        index: true
    },
    stripeSubscriptionId: {
        type: String,
        default: null,
        index: true
    },
    stripePriceId: {
        type: String,
        default: null
    },
    subscriptionStatus: {
        type: String,
        enum: ['active', 'trialing', 'past_due', 'unpaid', 'canceled', 'incomplete', 'incomplete_expired', null],
        default: null
    },
    currentPeriodEnd: {
        type: Date,
        default: null
    },
    limits: {
        maxContainers: { type: Number, default: 2 },
        maxRamMb: { type: Number, default: 1024 },
        maxCpuCores: { type: Number, default: 1 },
        maxDomains: { type: Number, default: 0 },
        maxVolumes: { type: Number, default: 1 },
        maxVolumeSizeMb: { type: Number, default: 1024 },
        maxSnapshots: { type: Number, default: 0 },
        maxBuckets: { type: Number, default: 1 }
    },
    verificationCode: {
        type: String
    },
    verificationCodeExpires: {
        type: Date
    },
    resetPasswordCode: {
        type: String
    },
    resetPasswordExpires: {
        type: Date
    }
}, { timestamps: true });

// Hash password before saving
userSchema.pre('save', async function (next) {
    if (!this.isModified('password')) return next();
    this.password = await bcrypt.hash(this.password, 10);
    next();
});

// Compare password
userSchema.methods.comparePassword = async function (candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
};

export default mongoose.model('User', userSchema);
