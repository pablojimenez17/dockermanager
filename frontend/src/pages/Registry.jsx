import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { ShieldCheck, Plus, Trash2, Globe, ShieldAlert, Eye, EyeOff, Lock, ArrowUpRight } from 'lucide-react';
import { useToast } from '../components/ToastContext';
import { Link } from 'react-router-dom';
import { useOrg } from '../context/OrgContext';

const Registries = () => {
    const { activeOrg } = useOrg();
    const [registries, setRegistries] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isEnterprise, setIsEnterprise] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [newRegistry, setNewRegistry] = useState({ name: '', url: '', username: '', password: '' });
    const [submitting, setSubmitting] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const { addToast } = useToast();

    const fetchRegistries = async () => {
        try {
            const res = await axios.get('/api/registries');
            setRegistries(res.data);
            setIsEnterprise(true);
        } catch (error) {
            if (error.response?.status === 403) {
                setIsEnterprise(false);
            } else {
                console.error('Failed to fetch registries:', error);
                addToast('Error', 'Failed to load private registries', 'error');
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRegistries();
    }, [activeOrg]);

    const handleCreateRegistry = async (e) => {
        e.preventDefault();
        if (!newRegistry.name || !newRegistry.url || !newRegistry.username || !newRegistry.password) return;

        if (!/^[A-Za-z0-9_]+$/.test(newRegistry.name)) {
            addToast('Invalid Name', 'Registry names can only contain letters, numbers, and underscores.', 'error');
            return;
        }

        setSubmitting(true);
        try {
            await axios.post('/api/registries', newRegistry);
            addToast('Success', 'Registry credentials stored securely', 'success');
            setNewRegistry({ name: '', url: '', username: '', password: '' });
            setShowForm(false);
            fetchRegistries();
        } catch (error) {
            addToast('Error', error.response?.data?.message || 'Failed to add registry', 'error');
        } finally {
            setSubmitting(false);
        }
    };

    const handleDeleteRegistry = async (id, name) => {
        if (!window.confirm(`Are you sure you want to delete the registry "${name}"?\nYou won't be able to pull new images from here until you re-authenticate.`)) {
            return;
        }

        try {
            await axios.delete(`/api/registries/${id}`);
            addToast('Deleted', `Registry ${name} removed`, 'success');
            fetchRegistries();
        } catch (error) {
            addToast('Error', 'Failed to delete registry', 'error');
        }
    };

    if (loading) return <div className="p-8 text-center animate-pulse text-slate-500">Connecting to Vault...</div>;

    // Enterprise Locked View
    if (!isEnterprise) {
        return (
            <div className="p-4 md:p-8 pb-20 max-w-4xl mx-auto flex flex-col items-center justify-center min-h-[70vh] text-center">
                <div className="w-24 h-24 bg-brand-600 hover:bg-brand-700 rounded-sm flex items-center justify-center mb-8 shadow-sm border border-amber-300">
                    <Lock size={48} className="text-white" />
                </div>
                <h1 className="text-4xl font-extrabold text-slate-900 dark:text-white mb-4 tracking-tight">Enterprise Exclusive Feature</h1>
                <p className="text-lg text-slate-600 dark:text-slate-400 mb-8 max-w-2xl leading-relaxed">
                    Private Registries allow you to connect securely to your locked <b>DockerHub Pro, AWS ECR, or GitHub Container Registry</b> repositories. Upgrade to the Enterprise plan to unlock this military-grade encrypted vault.
                </p>
                <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-sm border border-slate-200 dark:border-slate-700 w-full max-w-lg mb-8 text-left">
                    <ul className="space-y-4">
                        <li className="flex items-center text-slate-700 dark:text-slate-300"><ShieldCheck className="text-green-500 mr-3 shrink-0" /> AES-256 Military Grade Encryption</li>
                        <li className="flex items-center text-slate-700 dark:text-slate-300"><Globe className="text-blue-500 mr-3 shrink-0" /> Support for all Docker v2 API Registries</li>
                        <li className="flex items-center text-slate-700 dark:text-slate-300"><Lock className="text-amber-500 mr-3 shrink-0" /> Pull private proprietary code securely</li>
                    </ul>
                </div>
                <Link to="/app/plans" className="bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 px-8 py-4 rounded-sm font-bold text-lg transition-all shadow-sm flex items-center space-x-2">
                    <span>Upgrade to Enterprise</span>
                    <ArrowUpRight size={20} />
                </Link>
            </div>
        );
    }

    // Unlocked Enterprise View
    return (
        <div className="p-4 md:p-8 pb-20 max-w-7xl mx-auto space-y-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center space-x-3">
                        <div className="p-2.5 bg-amber-500/10 rounded-sm text-amber-500 border border-amber-500/20">
                            <ShieldCheck size={28} />
                        </div>
                        <span>Private Registries</span>
                        <span className="bg-brand-600 hover:bg-brand-700 text-white text-[10px] uppercase font-bold px-2 py-0.5 rounded-sm tracking-wider shadow-sm ml-2">Enterprise</span>
                    </h1>
                    <p className="text-slate-600 dark:text-slate-400 mt-2 max-w-2xl leading-relaxed">
                        Securely store authentication credentials for your private Docker registries (DockerHub, GHCR, AWS ECR). Passwords are encrypted with AES-256 and never readable via the API.
                    </p>
                </div>
                <button
                    onClick={() => setShowForm(!showForm)}
                    className="shrink-0 bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 px-5 py-2.5 rounded-sm font-medium transition-all shadow-sm flex items-center justify-center space-x-2"
                >
                    <Plus size={20} />
                    <span>Add Registry</span>
                </button>
            </div>

            {showForm && (
                <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-sm p-6 shadow-sm animate-in fade-in slide-in-from-top-4">
                    <div className="flex items-center space-x-3 text-amber-600 dark:text-amber-500 mb-6 bg-amber-50 dark:bg-amber-500/10 p-4 rounded-sm border border-amber-200 dark:border-amber-500/20">
                        <ShieldAlert size={24} className="shrink-0" />
                        <span className="text-sm font-medium">Your password or access token will be encrypted and hidden forever once saved. Ensure you have a backup of the token before saving.</span>
                    </div>

                    <form onSubmit={handleCreateRegistry} className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Short Name (Identifier)</label>
                                <input
                                    type="text"
                                    required
                                    value={newRegistry.name}
                                    onChange={(e) => setNewRegistry({ ...newRegistry, name: e.target.value.replace(/[^A-Za-z0-9_]/g, '') })}
                                    placeholder="e.g. Github_Packages"
                                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500 dark:text-white transition-all font-mono"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Registry URL</label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <Globe className="h-5 w-5 text-slate-400" />
                                    </div>
                                    <input
                                        type="text"
                                        required
                                        value={newRegistry.url}
                                        onChange={(e) => setNewRegistry({ ...newRegistry, url: e.target.value })}
                                        placeholder="ghcr.io or index.docker.io/v1/"
                                        className="pl-10 w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500 dark:text-white transition-all font-mono"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Username</label>
                                <input
                                    type="text"
                                    required
                                    value={newRegistry.username}
                                    onChange={(e) => setNewRegistry({ ...newRegistry, username: e.target.value })}
                                    placeholder="docker_user or AWS Access Key"
                                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500 dark:text-white transition-all font-mono"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Password / Access Token</label>
                                <div className="relative">
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        required
                                        value={newRegistry.password}
                                        onChange={(e) => setNewRegistry({ ...newRegistry, password: e.target.value })}
                                        placeholder="Paste your secret token here"
                                        className="w-full px-4 py-3 pr-12 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500 dark:text-white transition-all font-mono"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                                    >
                                        {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-end space-x-4 pt-4">
                            <button
                                type="button"
                                onClick={() => setShowForm(false)}
                                className="px-6 py-2.5 rounded-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={submitting}
                                className="bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 dark:text-slate-900 disabled:opacity-50 text-white px-8 py-2.5 rounded-sm font-bold transition-all shadow-md flex items-center space-x-2"
                            >
                                {submitting ? <span className="animate-pulse">Encrypting...</span> : (
                                    <>
                                        <Lock size={18} />
                                        <span>Save to Vault</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            <div className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-sm overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider">
                                <th className="p-5 font-bold">Identifier</th>
                                <th className="p-5 font-bold">Registry URL</th>
                                <th className="p-5 font-bold">Username</th>
                                <th className="p-5 font-bold">Added On</th>
                                <th className="p-5 font-bold text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                            {registries.length === 0 ? (
                                <tr>
                                    <td colSpan="5" className="p-12 text-center text-slate-500 dark:text-slate-400">
                                        <div className="mx-auto w-16 h-16 bg-slate-100 dark:bg-slate-800 flex items-center justify-center rounded-sm mb-4">
                                            <ShieldCheck size={32} className="opacity-50 text-slate-400" />
                                        </div>
                                        <p className="text-lg font-medium">No registries added</p>
                                        <p className="text-sm mt-1">Connect your first private container registry to deploy proprietary code.</p>
                                    </td>
                                </tr>
                            ) : (
                                registries.map(reg => (
                                    <tr key={reg._id} className="hover:bg-slate-50 dark:hover:bg-slate-700/20 transition-colors group">
                                        <td className="p-5 font-medium text-slate-900 dark:text-white">{reg.name}</td>
                                        <td className="p-5">
                                            <div className="flex items-center space-x-2 font-mono text-sm text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-2 py-1 inline-flex rounded-sm border border-blue-100 dark:border-blue-800">
                                                <Globe size={14} />
                                                <span>{reg.url}</span>
                                            </div>
                                        </td>
                                        <td className="p-5 text-sm text-slate-600 dark:text-slate-300">{reg.username}</td>
                                        <td className="p-5 text-sm whitespace-nowrap text-slate-500">{new Date(reg.createdAt).toLocaleDateString()}</td>
                                        <td className="p-5 text-right whitespace-nowrap">
                                            <button
                                                onClick={() => handleDeleteRegistry(reg._id, reg.name)}
                                                className="text-red-500 hover:text-red-700 p-2 rounded-sm hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors opacity-0 group-hover:opacity-100"
                                                title="Delete Registry"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default Registries;
