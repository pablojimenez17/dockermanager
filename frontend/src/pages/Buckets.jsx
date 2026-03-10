import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Database, Plus, Trash2, ArrowRight } from 'lucide-react';
import { useToast } from '../components/ToastContext';
import BucketView from './BucketView';

const Buckets = () => {
    const [buckets, setBuckets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newBucketName, setNewBucketName] = useState('');
    const [selectedBucket, setSelectedBucket] = useState(null);
    const [userLimits, setUserLimits] = useState({ maxBuckets: 1 });
    const { addToast } = useToast();

    useEffect(() => {
        fetchBuckets();
    }, []);

    const fetchBuckets = async () => {
        try {
            setLoading(true);
            const token = localStorage.getItem('token');
            const [bucketRes, userRes] = await Promise.all([
                axios.get('http://localhost:5000/api/buckets', { headers: { Authorization: `Bearer ${token}` } }),
                axios.get('http://localhost:5000/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })
            ]);

            setBuckets(bucketRes.data || []);
            setUserLimits(userRes.data?.limits || { maxBuckets: 1 });
        } catch (error) {
            console.error('Failed to load buckets from MinIO:', error);
            addToast('Error loading buckets.', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleCreateBucket = async (e) => {
        e.preventDefault();
        try {
            const token = localStorage.getItem('token');
            await axios.post('http://localhost:5000/api/buckets', { name: newBucketName }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            addToast(`Bucket ${newBucketName} created successfully!`, 'success');
            setShowCreateModal(false);
            setNewBucketName('');
            fetchBuckets();
        } catch (error) {
            console.error('Failed to create bucket:', error);
            const errMessage = error.response?.data?.message || 'Error creating bucket';
            addToast(errMessage, 'error');
        }
    };

    const handleDeleteBucket = async (bucketName) => {
        if (!window.confirm(`Are you sure you want to delete bucket: ${bucketName}? It must be completely empty first.`)) return;

        try {
            const token = localStorage.getItem('token');
            await axios.delete(`http://localhost:5000/api/buckets/${bucketName}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            addToast(`Bucket ${bucketName} deleted successfully!`, 'success');
            fetchBuckets();
        } catch (error) {
            console.error('Failed to delete bucket:', error);
            const errMessage = error.response?.data?.message || 'Error deleting bucket. Ensure it is empty.';
            addToast(errMessage, 'error');
        }
    };

    return (
        <div className="p-4 md:p-8 pb-20 text-slate-900 dark:text-white max-w-7xl mx-auto">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-10">
                <div>
                    <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-2 flex items-center gap-3">
                        <Database className="text-brand-500" size={36} />
                        Object Storage (Buckets)
                    </h1>
                    <p className="text-slate-600 dark:text-slate-400 text-base sm:text-lg">
                        Manage private object storage buckets automatically backed by MinIO.
                    </p>
                </div>
                <div className="flex w-full sm:w-auto space-x-3 items-center">
                    <div className="text-sm font-semibold bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-lg text-slate-600 dark:text-slate-300">
                        {buckets.length} / {userLimits.maxBuckets >= 999 ? '∞' : userLimits.maxBuckets} Buckets
                    </div>
                    <button
                        onClick={() => {
                            if (buckets.length >= userLimits.maxBuckets) {
                                addToast('Quota Reached', 'You have reached your bucket limit. Please upgrade your plan to create more.', 'warning');
                                return;
                            }
                            setShowCreateModal(true);
                        }}
                        className={`flex items-center space-x-2 px-5 py-2.5 rounded-xl font-medium transition-all duration-200 ${buckets.length >= userLimits.maxBuckets ? 'bg-slate-300 text-slate-500 cursor-not-allowed dark:bg-slate-700 dark:text-slate-500' : 'bg-brand-500 hover:bg-brand-600 text-white shadow-lg shadow-brand-500/30 hover:scale-105 active:scale-95'}`}
                    >
                        <Plus size={20} />
                        <span>Create Bucket</span>
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="flex justify-center items-center py-20">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-500"></div>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {buckets.length === 0 ? (
                        <div className="col-span-1 md:col-span-2 lg:col-span-3 text-center py-16 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                            <Database className="mx-auto h-12 w-12 text-slate-400 dark:text-slate-500 mb-4 opacity-50" />
                            <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">No buckets found</h3>
                            <p className="text-slate-500 dark:text-slate-400 mb-6 max-w-sm mx-auto">Get started by creating your first bucket to store and manage private objects.</p>
                        </div>
                    ) : (
                        buckets.map(bucket => (
                            <div key={bucket.name} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 shadow-lg hover:border-brand-400 transition-colors flex flex-col group h-full">
                                <div className="flex items-start space-x-4 mb-6">
                                    <div className="p-4 rounded-2xl bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400 shrink-0">
                                        <Database size={28} />
                                    </div>
                                    <div className="flex-1 min-w-0 pt-1">
                                        <h3 className="text-xl font-bold text-slate-900 dark:text-white truncate" title={bucket.name}>
                                            {bucket.name}
                                        </h3>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                            Created: {new Date(bucket.creationDate).toLocaleDateString()}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center space-x-3 pt-6 border-t border-slate-200 dark:border-slate-700/50 mt-auto">
                                    <button
                                        onClick={() => setSelectedBucket(bucket.name)}
                                        className="flex-1 bg-brand-50 hover:bg-brand-100 dark:bg-brand-500/10 dark:hover:bg-brand-500/20 text-brand-600 dark:text-brand-400 py-2.5 rounded-xl font-medium transition-colors flex items-center justify-center space-x-2"
                                    >
                                        <span>Browse Objects</span> <ArrowRight size={16} />
                                    </button>
                                    <button
                                        onClick={() => handleDeleteBucket(bucket.name)}
                                        className="p-2.5 bg-rose-50 hover:bg-rose-100 dark:bg-rose-500/10 dark:hover:bg-rose-500/20 text-rose-500 dark:text-rose-400 rounded-xl transition-colors"
                                        title="Delete Empty Bucket"
                                    >
                                        <Trash2 size={20} />
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}

            {/* Create Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md m-auto border border-slate-200 dark:border-slate-700">
                        <div className="p-6 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
                            <h2 className="text-xl font-bold text-slate-800 dark:text-white">Create Bucket</h2>
                            <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                                <Plus size={24} className="rotate-45" />
                            </button>
                        </div>
                        <form onSubmit={handleCreateBucket} className="p-6">
                            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                                Bucket Name <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                required
                                value={newBucketName}
                                onChange={(e) => setNewBucketName(e.target.value)}
                                placeholder="e.g. static-assets"
                                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none text-slate-900 dark:text-white"
                            />
                            <p className="text-xs text-slate-500 mt-2">Names must be lowercase and contain only hyphens and alphanumeric characters.</p>

                            <div className="mt-8 flex justify-end space-x-3">
                                <button type="button" onClick={() => setShowCreateModal(false)} className="px-5 py-2.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl font-medium">Cancel</button>
                                <button type="submit" disabled={!newBucketName} className="px-5 py-2.5 bg-brand-500 text-white rounded-xl font-medium hover:bg-brand-600 disabled:opacity-50">Create Bucket</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Object Viewer */}
            {selectedBucket && (
                <BucketView
                    bucketName={selectedBucket}
                    onClose={() => setSelectedBucket(null)}
                />
            )}
        </div>
    );
};

export default Buckets;
