import mongoose from 'mongoose';

const membershipSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    organizationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Organization',
        required: true
    },
    roleId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Role',
        required: true
    }
}, { timestamps: true });

// A user can only have one membership per organization
membershipSchema.index({ userId: 1, organizationId: 1 }, { unique: true });

export default mongoose.model('Membership', membershipSchema);
