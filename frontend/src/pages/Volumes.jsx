import React, { useState, useEffect } from 'react';
import { HardDrive, Trash2, Plus, ShieldAlert, AlertCircle, RefreshCw } from 'lucide-react';
import axios from 'axios';
import { useOrg } from '../context/OrgContext';
import { resolveLimits } from '../utils/planLimits';

const Volumes = () => {
    const { activeOrg, userPlan } = useOrg();
    const [volumes, setVolumes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [error, setError] = useState('');
    const [newVolumeName, setNewVolumeName] = useState('');

    const [limits, setLimits] = useState({ maxVolumes: 1, maxVolumeSizeMb: 1024 });
    const [currentUsage, setCurrentUsage] = useState({ count: 0, bytes: 0 });

    const fetchVolumes = async () => {
        setLoading(true);
        setError('');
        try {
            const [volRes] = await Promise.all([
                axios.get(`/api/volumes?t=${Date.now()}`).catch(() => ({ data: [] }))
            ]);

            const role = localStorage.getItem('role');
            const planType = activeOrg ? activeOrg.plan : userPlan;
            setLimits(resolveLimits({ planType, role }));

            const fetchedVolumes = volRes.data || [];
            setVolumes(fetchedVolumes);

            // Calculate usage
            const totalBytes = fetchedVolumes.reduce((acc, vol) => acc + (vol.sizeBytes || 0), 0);
            setCurrentUsage({
                count: fetchedVolumes.length,
                bytes: totalBytes
            });

        } catch (err) {
            setError(err.response?.data?.message || 'Failed to load volumes. Is the server running?');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchVolumes();
    }, [activeOrg]);

    const handleCreate = async (e) => {
        e.preventDefault();
        setError('');
        setActionLoading(true);
        try {
            await axios.post('/api/volumes', { name: newVolumeName });
            setNewVolumeName('');
            await fetchVolumes();
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to create volume');
        } finally {
            setActionLoading(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to delete this persistent disk? Any containers using it WILL lose data.')) return;

        setError('');
        setActionLoading(true);
        try {
            await axios.delete(`/api/volumes/${id}`);
            await fetchVolumes();
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to delete volume. It might be currently attached to a running container.');
        } finally {
            setActionLoading(false);
        }
    };

    const formatBytes = (bytes) => {
        if (!bytes || bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const isExceedingCount = currentUsage.count >= limits.maxVolumes;
    const currentMb = currentUsage.bytes / 1024 / 1024;
    const isExceedingSpace = currentMb >= limits.maxVolumeSizeMb;

    return (
        <div className="p-4 sm:p-8 pb-20 text-slate-900 dark:text-white max-w-5xl mx-auto space-y-8">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <div className="inline-flex items-center justify-center p-3 bg-brand-100 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400 rounded-sm mb-4">
                        <HardDrive size={32} />
                    </div>
                    <h1 className="text-3xl font-extrabold tracking-tight">Volumes (Disks)</h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-2">Manage persistent storage mounted to your containers.</p>
                </div>
                <button
                    onClick={fetchVolumes}
                    disabled={loading}
                    className="flex justify-center items-center px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                >
                    <RefreshCw size={18} className={`mr-2 ${loading ? 'animate-spin' : ''}`} /> Refresh
                </button>
            </div>

            {/* Quotas Visualization */}
            <div className="panel p-6">
                <h4 className="text-sm font-bold flex items-center mb-4">
                    <ShieldAlert size={18} className="mr-2 text-brand-500" /> Storage Quotas - <span className="ml-1 font-normal text-slate-500">{activeOrg ? activeOrg.name : 'Personal Workspace'}</span>
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div>
                        <div className="flex justify-between text-xs mb-2">
                            <span className="text-slate-500 font-medium">Disks Count</span>
                            <span className={`font-bold ${isExceedingCount ? 'text-red-500' : ''}`}>
                                {currentUsage.count} / {limits.maxVolumes}
                            </span>
                        </div>
                        <div className="h-2 w-full bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                            <div className={`h-full ${isExceedingCount ? 'bg-red-500' : 'bg-brand-500'}`} style={{ width: `${Math.min((currentUsage.count / limits.maxVolumes) * 100, 100)}%` }}></div>
                        </div>
                    </div>
                    <div>
                        <div className="flex justify-between text-xs mb-2">
                            <span className="text-slate-500 font-medium">Total Volume Capacity</span>
                            <span className={`font-bold ${isExceedingSpace ? 'text-red-500' : ''}`}>
                                {formatBytes(currentUsage.bytes)} / {limits.maxVolumeSizeMb} MB
                            </span>
                        </div>
                        <div className="h-2 w-full bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                            <div className={`h-full ${isExceedingSpace ? 'bg-red-500' : 'bg-blue-500'}`} style={{ width: `${Math.min((currentMb / limits.maxVolumeSizeMb) * 100, 100)}%` }}></div>
                        </div>
                    </div>
                </div>
            </div>

            {error && (
                <div className="bg-red-500/10 border border-red-500/50 text-red-500 text-sm py-4 px-4 rounded-sm flex items-start space-x-3">
                    <AlertCircle size={20} className="shrink-0 mt-0.5" />
                    <span>{error}</span>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                {/* Create Volume */}
                <div className="lg:col-span-1 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-sm p-6 shadow-sm h-fit">
                    <h3 className="font-bold text-lg mb-4">Create New Disk</h3>
                    <form onSubmit={handleCreate} className="space-y-4">
                        <div>
                            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Internal Name</label>
                            <input
                                type="text"
                                required
                                value={newVolumeName}
                                onChange={(e) => setNewVolumeName(e.target.value)}
                                placeholder="E.g. database-storage"
                                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-sm focus:ring-1 focus:ring-brand-500 outline-none text-sm"
                            />
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                            Crear un volumen puede tardar unos segundos. Por favor ten paciencia.
                        </p>
                        <button
                            type="submit"
                            disabled={actionLoading || isExceedingCount || isExceedingSpace}
                            className={`w-full py-2.5 rounded-sm font-bold text-white transition-all flex items-center justify-center ${actionLoading || isExceedingCount || isExceedingSpace ? 'bg-slate-600 opacity-70 cursor-not-allowed' : 'btn-primary'
                                }`}
                        >
                            <Plus size={18} className="mr-2" />
                            Create Volume
                        </button>
                    </form>
                </div>

                {/* List Volumes */}
                <div className="lg:col-span-2 space-y-4">
                    <h3 className="font-bold text-lg mb-2">Attached Volumes ({volumes.length})</h3>

                    {loading && volumes.length === 0 ? (
                        <div className="text-center text-slate-500 py-10 opacity-70 animate-pulse">Loading persistent disks...</div>
                    ) : volumes.length === 0 ? (
                        <div className="text-center py-12 border border-dashed border-slate-300 dark:border-slate-700 rounded-sm text-slate-500">
                            <HardDrive size={40} className="mx-auto mb-3 opacity-20" />
                            <p>You haven't created any persistent volumes.</p>
                        </div>
                    ) : (
                        volumes.map((vol) => (
                            <div key={vol._id} className="flex flex-col sm:flex-row items-center justify-between p-5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-sm shadow-sm transition-shadow">
                                <div className="flex items-center w-full mb-4 sm:mb-0">
                                    <div className="bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 p-3 rounded-full mr-4 shrink-0">
                                        <HardDrive size={24} />
                                    </div>
                                    <div className="truncate pr-4 w-full">
                                        <h4 className="font-bold text-sm sm:text-base truncate">{vol.name}</h4>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                            Size on server: <span className="font-mono text-slate-700 dark:text-slate-300">{formatBytes(vol.sizeBytes)}</span>
                                        </p>
                                    </div>
                                </div>
                                <div className="flex space-x-2 shrink-0 self-end sm:self-auto">
                                    <button
                                        onClick={() => handleDelete(vol._id)}
                                        disabled={actionLoading}
                                        className="p-2 border border-slate-200 dark:border-slate-700 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-sm transition-colors"
                                        title="Delete Volume"
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};

export default Volumes;
