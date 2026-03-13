import mongoose from 'mongoose';

const snapshotSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    organizationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Organization'
    },
    containerId: {
        type: String, // Docker container ID source
        required: true
    },
    containerName: {
        type: String,
        required: true
    },
    snapshotName: {
        type: String, // e.g. "my-app-backup:v1"
        required: true
    },
    imageId: {
        type: String, // Docker image ID
        required: true
    }
}, { timestamps: true });

// Ensure snapshot names are unique per user to prevent overwrites or confusion
snapshotSchema.index({ userId: 1, snapshotName: 1 }, { unique: true });

export default mongoose.model('Snapshot', snapshotSchema);
