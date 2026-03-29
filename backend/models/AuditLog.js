import mongoose from 'mongoose';

const auditLogSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: false // Optional for system-wide automated tasks
    },
    action: {
        type: String,
        required: true,
        enum: [
            'CREATE_CONTAINER', 
            'START_CONTAINER', 
            'STOP_CONTAINER', 
            'DELETE_CONTAINER', 
            'FORCE_DELETE_CONTAINER', 
            'CREATED_SECRET', 
            'DELETED_SECRET',
            'BACKUP_COMPLETED',
            'BACKUP_FAILED'
        ]
    },
    resourceName: {
        type: String,
        required: true
    },
    details: {
        type: String,
        default: ''
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

const AuditLog = mongoose.model('AuditLog', auditLogSchema);
export default AuditLog;
