import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Camera, Trash2, HardDrive, RefreshCw, Cpu, Image as ImageIcon } from 'lucide-react';
import { useToast } from '../components/ToastContext';

const Snapshots = () => {
    const [snapshots, setSnapshots] = useState([]);
    const [loading, setLoading] = useState(true);
    const [userPlan, setUserPlan] = useState('free');
    const { addToast } = useToast();

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            setLoading(true);
            const token = localStorage.getItem('token');
            const userRes = await axios.get('http://localhost:5000/api/auth/me', {
                headers: { Authorization: `Bearer ${token}` }
            });

            const currentPlan = userRes.data?.planType || 'free';
            setUserPlan(currentPlan);
            localStorage.setItem('planType', currentPlan); // sync just in case

            if (currentPlan !== 'free') {
                const snapRes = await axios.get('http://localhost:5000/api/snapshots', {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setSnapshots(snapRes.data || []);
            }
        } catch (error) {
            console.error('Failed to load snapshot dashboard data:', error);
            addToast('Error loading your snapshot gallery.', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id, name) => {
        if (!window.confirm(`Are you sure you want to delete snapshot ${name}? This will remove the Docker Image permanently.`)) return;

        try {
            const token = localStorage.getItem('token');
            await axios.delete(`http://localhost:5000/api/snapshots/${id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            addToast('Snapshot deleted successfully.', 'success');
            setSnapshots(prev => prev.filter(s => s._id !== id));
        } catch (error) {
            console.error('Error deleting snapshot:', error);
            const msg = error.response?.data?.message || 'Error deleting snapshot';
            addToast(msg, 'error');
        }
    };

    if (userPlan === 'free') {
        return (
            <div className="p-4 md:p-8 text-slate-900 dark:text-white max-w-7xl mx-auto flex flex-col items-center justify-center min-h-[60vh]">
                <div className="bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/30 p-10 rounded-3xl max-w-2xl text-center shadow-lg shadow-indigo-500/5">
                    <Camera className="mx-auto h-20 w-20 text-indigo-400 dark:text-indigo-500 mb-6" strokeWidth={1.5} />
                    <h2 className="text-3xl font-extrabold text-slate-900 dark:text-white mb-4">Container Snapshots</h2>
                    <p className="text-lg text-slate-600 dark:text-slate-300 mb-8 leading-relaxed">
                        Freeze your container configurations instantly. Save images as backups and easily spin up identical copies. Available exclusively on Professional and Enterprise plans.
                    </p>
                    <a
                        href="/app/plans"
                        className="inline-flex items-center justify-center px-8 py-4 text-lg font-bold text-white bg-indigo-500 hover:bg-indigo-600 rounded-xl transition-transform active:scale-95 shadow-xl shadow-indigo-500/30"
                    >
                        Upgrade Plan
                    </a>
                </div>
            </div>
        );
    }

    return (
        <div className="p-4 md:p-8 pb-20 text-slate-900 dark:text-white max-w-7xl mx-auto">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-10">
                <div>
                    <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-2 flex items-center gap-3">
                        <Camera className="text-indigo-500" size={36} />
                        Snapshot Gallery
                    </h1>
                    <p className="text-slate-600 dark:text-slate-400 text-base sm:text-lg">
                        Manage your saved container states and custom Docker images.
                    </p>
                </div>
                <button
                    onClick={fetchData}
                    disabled={loading}
                    className="p-3 text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 bg-white hover:bg-indigo-50 border border-slate-200 dark:bg-slate-800 dark:hover:bg-indigo-500/10 dark:border-slate-700 rounded-xl transition-colors disabled:opacity-50"
                    title="Refresh Gallery"
                >
                    <RefreshCw size={24} className={loading ? 'animate-spin' : ''} />
                </button>
            </div>

            {loading ? (
                <div className="flex justify-center items-center py-20">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {snapshots.length === 0 ? (
                        <div className="col-span-1 lg:col-span-2 text-center py-20 bg-white dark:bg-slate-800/50 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm">
                            <ImageIcon className="mx-auto h-16 w-16 text-slate-300 dark:text-slate-600 mb-6" />
                            <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Your gallery is empty</h3>
                            <p className="text-slate-500 dark:text-slate-400 mb-6">Head over to 'My Containers' and click the Camera icon to take your first snapshot.</p>
                        </div>
                    ) : (
                        snapshots.map(snap => (
                            <div key={snap._id} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 shadow-lg hover:border-indigo-400 dark:hover:border-indigo-500 transition-colors flex flex-col group">
                                <div className="flex items-start space-x-4 mb-4">
                                    <div className="p-4 rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400 shrink-0">
                                        <Camera size={28} />
                                    </div>
                                    <div className="flex-1 min-w-0 pt-1">
                                        <h3 className="text-xl font-bold text-slate-900 dark:text-white truncate" title={snap.snapshotName}>
                                            {snap.snapshotName}
                                        </h3>
                                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5 truncate flex items-center gap-1.5 font-mono bg-slate-100 dark:bg-slate-900 px-2 py-0.5 rounded w-max">
                                            from {snap.containerName}
                                        </p>
                                    </div>
                                </div>

                                <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-4 border border-slate-200 dark:border-slate-700/50 mb-6 grid grid-cols-2 gap-4">
                                    <div>
                                        <p className="text-[10px] text-slate-500 uppercase tracking-wider font-bold mb-1">Image ID Hash</p>
                                        <p className="text-xs font-mono truncate text-slate-700 dark:text-slate-300" title={snap.imageId}>
                                            {snap.imageId.replace('sha256:', '').substring(0, 16)}...
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] text-slate-500 uppercase tracking-wider font-bold mb-1">Created On</p>
                                        <p className="text-xs text-slate-700 dark:text-slate-300">
                                            {new Date(snap.createdAt).toLocaleDateString()} {new Date(snap.createdAt).toLocaleTimeString([], { timeStyle: 'short' })}
                                        </p>
                                    </div>
                                </div>

                                <div className="mt-auto border-t border-slate-200 dark:border-slate-700/50 pt-4 flex justify-between items-center">
                                    <span className="text-xs text-slate-400">Can be deployed from the Templates screen</span>
                                    <button
                                        onClick={() => handleDelete(snap._id, snap.snapshotName)}
                                        className="p-2.5 bg-rose-50 hover:bg-rose-100 dark:bg-rose-500/10 dark:hover:bg-rose-500/20 text-rose-500 dark:text-rose-400 rounded-xl transition-colors shrink-0 outline-none"
                                        title="Delete Snapshot Image"
                                    >
                                        <Trash2 size={20} />
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}
        </div>
    );
};

export default Snapshots;
