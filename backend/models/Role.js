import mongoose from 'mongoose';

const roleSchema = new mongoose.Schema({
    organizationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Organization',
        required: true
    },
    name: {
        type: String,
        required: true,
        trim: true
    },
    permissions: {
        manageContainers: { type: Boolean, default: false },
        deleteContainers: { type: Boolean, default: false },
        manageVolumes: { type: Boolean, default: false },
        deleteVolumes: { type: Boolean, default: false },
        manageNetworks: { type: Boolean, default: false },
        viewLogs: { type: Boolean, default: false },
        accessTerminal: { type: Boolean, default: false },
        deployGit: { type: Boolean, default: false },
        manageDomains: { type: Boolean, default: false }
    },
    scope: {
        type: String,
        enum: ['global', 'specific'],
        default: 'global'
    },
    resourceIds: [{
        type: mongoose.Schema.Types.ObjectId
    }]
}, { timestamps: true });

// Ensure role names are unique per organization
roleSchema.index({ organizationId: 1, name: 1 }, { unique: true });

export default mongoose.model('Role', roleSchema);
