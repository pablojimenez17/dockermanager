import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Lock, Plus, Trash2, KeyRound, ShieldAlert, Eye, EyeOff } from 'lucide-react';
import { useToast } from '../components/ToastContext';
import { useOrg } from '../context/OrgContext';

const Secrets = () => {
    const { activeOrg } = useOrg();
    const [secrets, setSecrets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [newSecret, setNewSecret] = useState({ name: '', value: '', description: '' });
    const [submitting, setSubmitting] = useState(false);
    const [showValue, setShowValue] = useState(false);
    const { addToast } = useToast();

    const fetchSecrets = async () => {
        try {
            const res = await axios.get('https://localhost:5000/api/secrets');
            setSecrets(res.data);
        } catch (error) {
            console.error('Failed to fetch secrets:', error);
            addToast('Error', 'Failed to load secrets vault', 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSecrets();
    }, [activeOrg]);

    const handleCreateSecret = async (e) => {
        e.preventDefault();
        if (!newSecret.name || !newSecret.value) return;

        // Validation for upper snake case convention usually used in EnvVars
        if (!/^[A-Za-z0-9_]+$/.test(newSecret.name)) {
            addToast('Invalid Name', 'Secret names can only contain letters, numbers, and underscores.', 'error');
            return;
        }

        setSubmitting(true);
        try {
            await axios.post('https://localhost:5000/api/secrets', newSecret);
            addToast('Success', 'Secret encrypted and stored in vault', 'success');
            setNewSecret({ name: '', value: '', description: '' });
            setShowForm(false);
            fetchSecrets();
        } catch (error) {
            addToast('Error', error.response?.data?.message || 'Failed to create secret', 'error');
        } finally {
            setSubmitting(false);
        }
    };

    const handleDeleteSecret = async (id, name) => {
        if (!window.confirm(`Are you sure you want to delete the secret "${name}"?\nAny containers relying on this secret will fail to restart.`)) {
            return;
        }

        try {
            await axios.delete(`https://localhost:5000/api/secrets/${id}`);
            addToast('Deleted', `Secret ${name} removed from vault`, 'success');
            fetchSecrets();
        } catch (error) {
            addToast('Error', 'Failed to delete secret', 'error');
        }
    };

    if (loading) return <div className="p-8 text-center animate-pulse text-slate-500">Decrypting Vault...</div>;

    return (
        <div className="p-4 md:p-8 pb-20 max-w-7xl mx-auto space-y-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center space-x-3">
                        <div className="p-2.5 bg-blue-500/10 rounded-xl text-blue-500 border border-blue-500/20">
                            <Lock size={28} />
                        </div>
                        <span>Secret Manager</span>
                    </h1>
                    <p className="text-slate-600 dark:text-slate-400 mt-2 max-w-2xl leading-relaxed">
                        Store sensitive data like API keys and database passwords here. Secrets are encrypted with AES-256 before saving to the database and are never readable via the API again.
                    </p>
                </div>
                <button
                    onClick={() => setShowForm(!showForm)}
                    className="shrink-0 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-medium transition-all shadow-lg shadow-blue-500/25 flex items-center justify-center space-x-2"
                >
                    <Plus size={20} />
                    <span>New Secret</span>
                </button>
            </div>

            {showForm && (
                <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-3xl p-6 shadow-xl animate-in fade-in slide-in-from-top-4">
                    <div className="flex items-center space-x-3 text-amber-600 dark:text-amber-500 mb-6 bg-amber-50 dark:bg-amber-500/10 p-4 rounded-xl border border-amber-200 dark:border-amber-500/20">
                        <ShieldAlert size={24} className="shrink-0" />
                        <span className="text-sm font-medium">Warning: For your security, the secret value cannot be viewed or retrieved after saving it. Make sure you have it backed up elsewhere if needed.</span>
                    </div>

                    <form onSubmit={handleCreateSecret} className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Secret Name (Uppercase recommended)</label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <KeyRound className="h-5 w-5 text-slate-400" />
                                    </div>
                                    <input
                                        type="text"
                                        required
                                        value={newSecret.name}
                                        onChange={(e) => setNewSecret({ ...newSecret, name: e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '') })}
                                        placeholder="e.g. MYSQL_ROOT_PASSWORD"
                                        className="pl-10 w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:text-white transition-all font-mono"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Secret Value</label>
                                <div className="relative">
                                    <input
                                        type={showValue ? 'text' : 'password'}
                                        required
                                        value={newSecret.value}
                                        onChange={(e) => setNewSecret({ ...newSecret, value: e.target.value })}
                                        placeholder="Paste your sensitive token here"
                                        className="w-full px-4 py-3 pr-12 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:text-white transition-all font-mono"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowValue(!showValue)}
                                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                                    >
                                        {showValue ? <EyeOff size={20} /> : <Eye size={20} />}
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Description (Optional)</label>
                            <input
                                type="text"
                                value={newSecret.description}
                                onChange={(e) => setNewSecret({ ...newSecret, description: e.target.value })}
                                placeholder="What is this used for?"
                                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:text-white transition-all"
                            />
                        </div>

                        <div className="flex justify-end space-x-4 pt-4">
                            <button
                                type="button"
                                onClick={() => setShowForm(false)}
                                className="px-6 py-2.5 rounded-xl font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={submitting}
                                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-8 py-2.5 rounded-xl font-medium transition-all shadow-md flex items-center space-x-2"
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

            <div className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-3xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider">
                                <th className="p-5 font-bold">Secret Name</th>
                                <th className="p-5 font-bold">Description</th>
                                <th className="p-5 font-bold">Created At</th>
                                <th className="p-5 font-bold text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                            {secrets.length === 0 ? (
                                <tr>
                                    <td colSpan="4" className="p-8 text-center text-slate-500 dark:text-slate-400">
                                        <Lock className="mx-auto mb-3 opacity-30" size={48} />
                                        <p className="text-lg font-medium">Vault is empty</p>
                                        <p className="text-sm">Store your first encrypted token to use in containers.</p>
                                    </td>
                                </tr>
                            ) : (
                                secrets.map(secret => (
                                    <tr key={secret._id} className="hover:bg-slate-50 dark:hover:bg-slate-700/20 transition-colors group">
                                        <td className="p-5">
                                            <div className="flex items-center space-x-3">
                                                <div className="p-2 bg-slate-100 dark:bg-slate-700 rounded-lg text-slate-500 dark:text-slate-400">
                                                    <KeyRound size={16} />
                                                </div>
                                                <span className="font-mono text-sm font-semibold text-slate-900 dark:text-white">{'${'}{secret.name}{'}'}</span>
                                            </div>
                                        </td>
                                        <td className="p-5 line-clamp-1">{secret.description || <span className="text-slate-400 italic">No description</span>}</td>
                                        <td className="p-5 text-sm whitespace-nowrap text-slate-500">{new Date(secret.createdAt).toLocaleDateString()}</td>
                                        <td className="p-5 text-right whitespace-nowrap">
                                            <button
                                                onClick={() => handleDeleteSecret(secret._id, secret.name)}
                                                className="text-red-500 hover:text-red-700 p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors opacity-0 group-hover:opacity-100"
                                                title="Delete Secret"
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

export default Secrets;
