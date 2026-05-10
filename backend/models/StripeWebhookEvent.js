import mongoose from 'mongoose';

const stripeWebhookEventSchema = new mongoose.Schema({
    eventId: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    eventType: {
        type: String,
        required: true
    },
    processedAt: {
        type: Date,
        default: Date.now
    }
}, { timestamps: true });

export default mongoose.model('StripeWebhookEvent', stripeWebhookEventSchema);
