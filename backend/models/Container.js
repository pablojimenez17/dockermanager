import mongoose from 'mongoose';

const containerSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    dockerId: {
        type: String,
        required: true,
        unique: true
    },
    image: {
        type: String,
        required: true
    },
    status: {
        type: String,
        default: 'created'
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    domain: {
        type: String,
        trim: true
    },
    deployedViaGit: {
        type: Boolean,
        default: false
    },
    gitRepositoryUrl: {
        type: String, // e.g., https://github.com/user/repo
        trim: true
    },
    gitWebhookSecret: {
        type: String, // Random secret generated during deployment
        trim: true
    }
}, { timestamps: true });

export default mongoose.model('Container', containerSchema);
