import React, { useState, useEffect } from 'react';
import { GitBranch, Globe, HardDrive, Play, ShieldAlert, AlertCircle, Plus, Trash2 } from 'lucide-react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const GitDeploy = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [limits, setLimits] = useState({ maxContainers: 2, maxDomains: 0 });
    const [currentUsage, setCurrentUsage] = useState({ containers: 0, domains: 0 });

    const [form, setForm] = useState({
        name: '',
        gitUrl: '',
        branch: 'main',
        domain: '',
        domainPort: '80',
        env: [{ key: '', value: '' }]
    });

    useEffect(() => {
        const fetchContext = async () => {
            try {
                const token = localStorage.getItem('token');
                if (!token) return;
                const [meRes, containersRes] = await Promise.all([
                    axios.get('http://localhost:5000/api/auth/me', { headers: { Authorization: `Bearer ${token}` } }),
                    axios.get('http://localhost:5000/api/containers', { headers: { Authorization: `Bearer ${token}` } })
                ]);

                if (meRes.data.limits) setLimits(meRes.data.limits);

                const activeContainers = containersRes.data;
                const activeDomains = activeContainers.filter(c => c.domain && c.domain.trim() !== '').length;

                setCurrentUsage({
                    containers: activeContainers.length,
                    domains: activeDomains
                });
            } catch (err) {
                console.error("Failed to fetch context:", err);
            }
        };
        fetchContext();
    }, []);

    const handleChange = (e) => {
        setForm({ ...form, [e.target.name]: e.target.value });
    };

    const updateEnvVar = (index, field, value) => {
        const newEnv = [...form.env];
        newEnv[index][field] = value;
        setForm({ ...form, env: newEnv });
    };

    const addEnvVar = () => setForm({ ...form, env: [...form.env, { key: '', value: '' }] });
    const removeEnvVar = (index) => {
        const newEnv = form.env.filter((_, i) => i !== index);
        if (newEnv.length === 0) newEnv.push({ key: '', value: '' });
        setForm({ ...form, env: newEnv });
    };

    const isExceedingContainers = currentUsage.containers + 1 > limits.maxContainers;
    const isExceedingDomains = form.domain.trim() !== '' && (currentUsage.domains + 1 > limits.maxDomains);
    const isExceedingLimits = isExceedingContainers || isExceedingDomains;

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const token = localStorage.getItem('token');
            await axios.post('http://localhost:5000/api/git/deploy', form, {
                headers: { Authorization: `Bearer ${token}` }
            });
            navigate('/app/containers');
        } catch (err) {
            setError(err.response?.data?.message || 'Error deploying from Git');
            setLoading(false);
        }
    };

    return (
        <div className="p-4 sm:p-8 pb-20 text-slate-900 dark:text-white max-w-4xl mx-auto">
            <div className="mb-10 text-center">
                <div className="inline-flex items-center justify-center p-4 bg-brand-100 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400 rounded-2xl mb-4">
                    <GitBranch size={40} />
                </div>
                <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-2">Deploy from Git</h1>
                <p className="text-slate-600 dark:text-slate-400 text-base sm:text-lg">Paste a repository URL. We'll clone, build the Dockerfile in a secure sandbox, and deploy it globally.</p>
            </div>

            {/* Quotas Visualization */}
            <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-2xl p-6 shadow-sm mb-8">
                <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-4 flex items-center">
                    <ShieldAlert size={18} className="mr-2 text-brand-500" /> Current Plan Quotas
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div>
                        <div className="flex justify-between text-xs mb-1">
                            <span className="text-slate-500">Current Containers</span>
                            <span className={`font-bold ${isExceedingContainers ? 'text-red-500' : 'text-slate-700 dark:text-slate-300'}`}>
                                {currentUsage.containers} / {limits.maxContainers}
                            </span>
                        </div>
                        <div className="w-full bg-slate-200 dark:bg-slate-700/50 rounded-full h-1.5 flex">
                            <div className={`h-1.5 rounded-full ${isExceedingContainers ? 'bg-red-500' : 'bg-brand-500'}`} style={{ width: `${Math.min((currentUsage.containers / limits.maxContainers) * 100, 100)}%` }}></div>
                        </div>
                    </div>
                    <div>
                        <div className="flex justify-between text-xs mb-1">
                            <span className="text-slate-500">Current Custom Domains</span>
                            <span className={`font-bold ${isExceedingDomains ? 'text-red-500' : 'text-slate-700 dark:text-slate-300'}`}>
                                {currentUsage.domains} / {limits.maxDomains}
                            </span>
                        </div>
                        <div className="w-full bg-slate-200 dark:bg-slate-700/50 rounded-full h-1.5 flex">
                            <div className={`h-1.5 rounded-full ${isExceedingDomains ? 'bg-red-500' : 'bg-brand-500'}`} style={{ width: `${Math.min((currentUsage.domains / (limits.maxDomains || 1)) * 100, 100)}%` }}></div>
                        </div>
                    </div>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-3xl p-8 shadow-xl">
                {error && (
                    <div className="bg-red-500/10 border border-red-500/50 text-red-500 text-sm py-4 px-4 rounded-xl flex items-start space-x-3">
                        <AlertCircle size={20} className="shrink-0 mt-0.5" />
                        <span>{error}</span>
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">App Name</label>
                        <input
                            type="text"
                            required
                            name="name"
                            value={form.name}
                            onChange={handleChange}
                            placeholder="e.g. my-awesome-app"
                            className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Repository URL</label>
                        <input
                            type="url"
                            required
                            name="gitUrl"
                            value={form.gitUrl}
                            onChange={handleChange}
                            placeholder="https://github.com/user/repo.git"
                            className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none"
                        />
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Branch</label>
                        <input
                            type="text"
                            name="branch"
                            value={form.branch}
                            onChange={handleChange}
                            placeholder="main"
                            className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none"
                        />
                    </div>
                </div>

                <div className="p-6 bg-purple-50 dark:bg-purple-900/10 border border-purple-200 dark:border-purple-500/20 rounded-2xl space-y-4">
                    <h4 className="font-bold flex items-center text-purple-900 dark:text-purple-300">
                        <Globe className="mr-2" size={20} /> Domain Routing (Traefik)
                    </h4>
                    <p className="text-sm text-purple-700/80 dark:text-purple-400/80">
                        Attach a custom domain to this application. Ensure your DNS A Records point to this server's IP.
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-xs font-medium text-purple-800 dark:text-purple-300 mb-1">Domain Name</label>
                            <input
                                type="text"
                                name="domain"
                                value={form.domain}
                                onChange={handleChange}
                                placeholder="api.myapp.com"
                                className="w-full px-4 py-2.5 bg-white dark:bg-slate-900 border border-purple-200 dark:border-purple-500/30 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none text-sm"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-purple-800 dark:text-purple-300 mb-1">Internal Container Port</label>
                            <input
                                type="number"
                                name="domainPort"
                                value={form.domainPort}
                                onChange={handleChange}
                                placeholder="e.g. 3000"
                                className="w-full px-4 py-2.5 bg-white dark:bg-slate-900 border border-purple-200 dark:border-purple-500/30 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none text-sm"
                            />
                        </div>
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Build Environment Variables</label>
                    <div className="space-y-3 mb-3">
                        {form.env.map((env, eIdx) => (
                            <div key={eIdx} className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:items-center sm:space-x-3">
                                <input
                                    type="text"
                                    placeholder="KEY"
                                    value={env.key}
                                    onChange={(e) => updateEnvVar(eIdx, 'key', e.target.value)}
                                    className="flex-1 px-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl font-mono text-sm outline-none"
                                />
                                <span className="text-slate-400 font-bold">=</span>
                                <input
                                    type="text"
                                    placeholder="VALUE"
                                    value={env.value}
                                    onChange={(e) => updateEnvVar(eIdx, 'value', e.target.value)}
                                    className="flex-1 px-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl font-mono text-sm outline-none"
                                />
                                <button
                                    type="button"
                                    onClick={() => removeEnvVar(eIdx)}
                                    className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                                >
                                    <Trash2 size={18} />
                                </button>
                            </div>
                        ))}
                    </div>
                    <button
                        type="button"
                        onClick={addEnvVar}
                        className="text-sm font-bold text-brand-500 hover:text-brand-600 flex items-center"
                    >
                        <Plus size={16} className="mr-1" /> Add Variable
                    </button>
                </div>

                <div className="pt-6 border-t border-slate-200 dark:border-slate-700">
                    <button
                        type="submit"
                        disabled={loading || isExceedingLimits}
                        className={`w-full flex justify-center items-center py-4 rounded-xl shadow-lg font-bold text-white transition-all ${loading || isExceedingLimits ? 'bg-slate-600 opacity-70 cursor-not-allowed' : 'bg-brand-500 hover:bg-brand-600'
                            }`}
                    >
                        {loading ? (
                            <span className="flex items-center">
                                <span className="animate-spin w-5 h-5 border-2 border-white/20 border-t-white rounded-full mr-2"></span>
                                Cloning & Building... (this may take a few minutes)
                            </span>
                        ) : (
                            <span className="flex items-center">
                                Build & Deploy <Play className="ml-2" size={20} />
                            </span>
                        )}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default GitDeploy;
