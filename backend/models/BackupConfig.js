import mongoose from 'mongoose';

const backupTypeSchema = new mongoose.Schema({
    enabled:    { type: Boolean, default: true },
    intervalMs: { type: Number, default: 24 * 60 * 60 * 1000 } // 24h default
}, { _id: false });

const backupConfigSchema = new mongoose.Schema({
    db:        { type: backupTypeSchema, default: () => ({}) },
    server:    { type: backupTypeSchema, default: () => ({}) },
    web:       { type: backupTypeSchema, default: () => ({}) },
    retention: { type: Number, default: 7 }
}, { timestamps: true });

// Singleton pattern — only one config document ever
backupConfigSchema.statics.getSingleton = async function () {
    let cfg = await this.findOne();
    if (!cfg) {
        cfg = await this.create({});
    }
    return cfg;
};

export default mongoose.model('BackupConfig', backupConfigSchema);
