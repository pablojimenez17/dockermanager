import mongoose from 'mongoose';

const organizationSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    ownerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    plan: {
        type: String,
        enum: ['hobby', 'enterprise', 'agency'],
        default: 'hobby'
    }
}, { timestamps: true });

export default mongoose.model('Organization', organizationSchema);
