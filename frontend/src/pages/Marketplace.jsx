import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Search, Server, Play, ShieldAlert, Trash2 } from 'lucide-react';
import { useToast } from '../components/ToastContext';

const Marketplace = () => {
    const [templates, setTemplates] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedTemplate, setSelectedTemplate] = useState(null);
    const [deploying, setDeploying] = useState(false);
    const [availableSecrets, setAvailableSecrets] = useState([]);

    // Deployment state
    const [domainBase, setDomainBase] = useState('');
    const [customAppName, setCustomAppName] = useState('');

    // Unified env inputs: { KEY: { type: 'raw'|'secret', value: '' } }
    const [envFields, setEnvFields] = useState({});

    // Plan Limits
    const [limits, setLimits] = useState({ maxContainers: 2, maxRamMb: 1024, maxCpuCores: 1 });
    const [currentContainerCount, setCurrentContainerCount] = useState(0);
    const [currentRamMb, setCurrentRamMb] = useState(0);
    const [currentCpu, setCurrentCpu] = useState(0);

    const { addToast } = useToast();

    useEffect(() => {
        const fetchData = async () => {
            try {
                const token = localStorage.getItem('token');
                const authOptions = token ? { headers: { Authorization: `Bearer ${token}` } } : {};

                const [tplRes, secRes, meRes, myContainersRes, snapRes] = await Promise.all([
                    axios.get('http://localhost:5000/api/templates', authOptions),
                    axios.get('http://localhost:5000/api/secrets', authOptions),
                    axios.get('http://localhost:5000/api/auth/me', authOptions),
                    axios.get('http://localhost:5000/api/containers', authOptions),
                    // Catch snapshot fetch errors (e.g., Free tier users) so it doesn't break the marketplace loader
                    axios.get('http://localhost:5000/api/snapshots', authOptions).catch(() => ({ data: [] }))
                ]);

                // Map snapshots into the expected "Template" format
                const mappedSnapshots = (snapRes.data || []).map(snap => ({
                    id: snap._id,
                    name: snap.snapshotName,
                    description: `Custom backup snapshot taken from ${snap.containerName}. Contains all modified files and configurations.`,
                    category: 'My Snapshots',
                    // Default snapshot/backup icon
                    icon: 'https://cdn-icons-png.flaticon.com/512/3208/3208726.png',
                    containers: [
                        {
                            name_prefix: snap.snapshotName.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase(),
                            image: snap.imageId,
                            // Default port 80 to allow domain exposure if the original image used web ports
                            ports: [{ host: "", container: 80 }],
                            env: [] // Existing envs are baked into the snapshot image automatically
                        }
                    ]
                }));

                setTemplates([...tplRes.data, ...mappedSnapshots]);
                setAvailableSecrets(secRes.data || []);

                if (meRes.data.limits) setLimits(meRes.data.limits);
                setCurrentContainerCount(myContainersRes.data.length);

                let totalRam = 0;
                let totalCpu = 0;
                myContainersRes.data.forEach(c => {
                    if (c.hostConfig) {
                        totalRam += (c.hostConfig.Memory || 0) / (1024 * 1024);
                        totalCpu += (c.hostConfig.NanoCPUs || 0) / 1e9;
                    }
                });
                setCurrentRamMb(Math.round(totalRam));
                setCurrentCpu(Math.round(totalCpu * 10) / 10);
            } catch (err) {
                console.error(err);
                addToast('Failed to load marketplace data', 'error');
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [addToast]);

    // When a template is selected, initialize the envFields state with defaults
    const openTemplate = (template) => {
        const initial = {};
        // Collect all unique env vars that need user input (type: secret or input, excluding internal 'url')
        const allEnvs = [...new Map(
            template.containers
                .flatMap(c => c.env?.filter(e => (e.type === 'secret' || e.type === 'input') && e.key !== 'url') || [])
                .map(e => [e.key, e])
        ).values()];

        allEnvs.forEach(e => {
            initial[e.key] = {
                type: e.type === 'secret' ? 'secret' : 'raw',
                value: e.value || '',
                label: e.label || e.key,
                required: e.type === 'secret'
            };
        });

        setEnvFields(initial);
        setSelectedTemplate(template);
        setCustomAppName('');
        setDomainBase('');
    };

    const closeModal = () => {
        setSelectedTemplate(null);
        setCustomAppName('');
        setEnvFields({});
        setDomainBase('');
    };

    const updateEnvField = (key, field, value) => {
        setEnvFields(prev => ({
            ...prev,
            [key]: { ...prev[key], [field]: value }
        }));
    };

    const handleDeploy = async (e) => {
        e.preventDefault();
        setDeploying(true);
        try {
            // Transform the template containers into the precise format expected by POST /api/containers (the "CreateContainer" style)
            const stack = selectedTemplate.containers.map(cDef => {
                // Generate a unique name for this node
                let nodeName = `${cDef.name_prefix}-${Math.random().toString(36).substring(7)}`;
                if (customAppName && customAppName.trim() !== '') {
                    nodeName = selectedTemplate.containers.length > 1
                        ? `${customAppName.trim()}-${cDef.name_prefix}`
                        : customAppName.trim();
                }

                // Compile env vars from the UI state + raw template envs
                const finalEnv = [];
                if (cDef.env) {
                    cDef.env.forEach(e => {
                        if (e.type === 'secret') {
                            // If the user selected a secret in the UI, grab it and format as {{SECRET:name}}
                            const vaultSecretName = envFields[e.key]?.value;
                            if (vaultSecretName) {
                                finalEnv.push(`${e.key}={{SECRET:${vaultSecretName}}}`);
                            }
                        } else if (e.type === 'input') {
                            if (e.key === 'url' && domainBase) {
                                finalEnv.push(`${e.key}=https://${domainBase}`);
                            } else {
                                const rawValue = envFields[e.key]?.value || e.value;
                                if (rawValue !== undefined) finalEnv.push(`${e.key}=${rawValue}`);
                            }
                        } else if (e.value) {
                            finalEnv.push(`${e.key}=${e.value}`);
                        }
                    });
                }

                // If this is the primary web app, apply domain specifics
                const isWebApp = cDef.ports?.some(p => p.container === 80 || p.container === 2368 || p.container === 8080);

                return {
                    name: nodeName,
                    image: cDef.image,
                    replicas: 1, // templates don't define replicas yet
                    ports: cDef.ports?.map(p => `${p.host || ''}:${p.container}`),
                    env: finalEnv,
                    memory: "512", // Default for templates context, auto-adjusts logic in backend
                    cpu: "1",
                    networkMode: "bridge",
                    restartPolicy: "unless-stopped",
                    exposeDomain: isWebApp && domainBase ? true : false,
                    domain: (isWebApp && domainBase) ? domainBase : undefined,
                    domainPort: (isWebApp && domainBase) ? cDef.ports[0].container.toString() : undefined,
                };
            });

            // Post as a full stack using the working, reliable endpoint
            await axios.post('http://localhost:5000/api/containers', { stack });

            addToast(`${selectedTemplate.name} deployed successfully!`, 'success');
            closeModal();
        } catch (err) {
            addToast(err.response?.data?.message || 'Deployment failed', 'error');
        } finally {
            setDeploying(false);
        }
    };

    const configuredEnvFields = Object.entries(envFields);

    return (
        <div className="p-8 max-w-7xl mx-auto w-full">
            <div className="flex justify-between items-end mb-8">
                <div>
                    <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white mb-2">Templates <span className="text-sm bg-brand-500/10 text-brand-500 px-2.5 py-1 rounded-full ml-2 align-middle">Beta</span></h1>
                    <p className="text-slate-600 dark:text-slate-400">Launch powerful pre-configured stacks in a single click without writing compose files.</p>
                </div>
            </div>

            <div className="mb-8 relative">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400" size={20} />
                <input
                    type="text"
                    placeholder="Search apps (e.g. WordPress, Database, Redis...)"
                    className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl pl-12 pr-4 py-4 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/50 shadow-sm"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>

            {/* Quotas Visualization */}
            {!loading && (
                <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/80 rounded-2xl p-6 shadow-sm mb-8">
                    <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-4 flex items-center">
                        <ShieldAlert size={18} className="mr-2 text-brand-500" /> Plan Resource Quotas
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                        <div>
                            <div className="flex justify-between text-xs mb-1">
                                <span className="text-slate-500">Current Containers</span>
                                <span className={`font-bold ${currentContainerCount > limits.maxContainers ? 'text-red-500' : 'text-slate-700 dark:text-slate-300'}`}>
                                    {currentContainerCount} / {limits.maxContainers}
                                </span>
                            </div>
                            <div className="w-full bg-slate-200 dark:bg-slate-700/50 rounded-full h-1.5">
                                <div className={`h-1.5 rounded-full ${currentContainerCount > limits.maxContainers ? 'bg-red-500' : 'bg-brand-500'}`} style={{ width: `${Math.min((currentContainerCount / limits.maxContainers) * 100, 100)}%` }}></div>
                            </div>
                        </div>
                        <div>
                            <div className="flex justify-between text-xs mb-1">
                                <span className="text-slate-500">Current RAM Use</span>
                                <span className={`font-bold ${currentRamMb > limits.maxRamMb ? 'text-red-500' : 'text-slate-700 dark:text-slate-300'}`}>
                                    {currentRamMb}MB / {limits.maxRamMb}MB
                                </span>
                            </div>
                            <div className="w-full bg-slate-200 dark:bg-slate-700/50 rounded-full h-1.5">
                                <div className={`h-1.5 rounded-full ${currentRamMb > limits.maxRamMb ? 'bg-red-500' : 'bg-emerald-500'}`} style={{ width: `${Math.min((currentRamMb / limits.maxRamMb) * 100, 100)}%` }}></div>
                            </div>
                        </div>
                        <div>
                            <div className="flex justify-between text-xs mb-1">
                                <span className="text-slate-500">Current CPU Use</span>
                                <span className={`font-bold ${currentCpu > limits.maxCpuCores ? 'text-red-500' : 'text-slate-700 dark:text-slate-300'}`}>
                                    {currentCpu} / {limits.maxCpuCores} vCPU
                                </span>
                            </div>
                            <div className="w-full bg-slate-200 dark:bg-slate-700/50 rounded-full h-1.5">
                                <div className={`h-1.5 rounded-full ${currentCpu > limits.maxCpuCores ? 'bg-red-500' : 'bg-indigo-500'}`} style={{ width: `${Math.min((currentCpu / limits.maxCpuCores) * 100, 100)}%` }}></div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {loading ? (
                <div className="flex justify-center p-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500"></div>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {templates.filter(t => t.name.toLowerCase().includes(searchTerm.toLowerCase()) || t.category.toLowerCase().includes(searchTerm.toLowerCase())).map(template => (
                        <div key={template.id} className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1 flex flex-col cursor-pointer group" onClick={() => openTemplate(template)}>
                            <div className="p-6 flex-1">
                                <div className="w-14 h-14 bg-slate-50 dark:bg-slate-900 rounded-xl flex items-center justify-center p-3 mb-4 border border-slate-100 dark:border-slate-800 group-hover:scale-110 transition-transform">
                                    <img
                                        src={template.icon}
                                        alt={template.name}
                                        className="w-full h-full object-contain"
                                        onError={e => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }}
                                    />
                                    <div className="w-full h-full items-center justify-center text-2xl font-bold text-slate-400 hidden">{template.name[0]}</div>
                                </div>
                                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">{template.name}</h3>
                                <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-2 mb-4">{template.description}</p>
                                <span className="inline-block px-3 py-1 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-semibold rounded-full">
                                    {template.category}
                                </span>
                            </div>
                            <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-700/50 bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 text-sm flex items-center justify-between">
                                <span className="flex items-center"><Server size={14} className="mr-1.5" /> {template.containers.length} Node{template.containers.length > 1 ? 's' : ''}</span>
                                <span className="text-brand-500 font-medium group-hover:text-brand-600">Deploy &rarr;</span>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Deployment Modal */}
            {selectedTemplate && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 dark:bg-black/80 backdrop-blur-sm p-4">
                    <div className="bg-white dark:bg-slate-800 w-full max-w-xl rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col max-h-[90vh]">
                        {/* Header */}
                        <div className="p-6 border-b border-slate-200 dark:border-slate-700 flex justify-between items-start bg-slate-50 dark:bg-slate-900/50">
                            <div className="flex items-center space-x-4">
                                <div className="w-12 h-12 bg-white dark:bg-slate-800 rounded-xl flex items-center justify-center p-2.5 shadow-sm border border-slate-200 dark:border-slate-700">
                                    <img
                                        src={selectedTemplate.icon}
                                        alt="icon"
                                        onError={e => { e.target.style.display = 'none'; }}
                                    />
                                </div>
                                <div>
                                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white">{selectedTemplate.name}</h2>
                                    <p className="text-sm text-slate-500 dark:text-slate-400">{selectedTemplate.category} Stack</p>
                                </div>
                            </div>
                            <button onClick={closeModal} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>

                        {/* Body */}
                        <div className="p-6 overflow-y-auto">
                            <form onSubmit={handleDeploy} id="deployForm" className="space-y-6">

                                {/* Section 1: App config */}
                                <div>
                                    <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">1. App Configuration</h3>
                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Custom App Name (Optional)</label>
                                            <input
                                                type="text"
                                                value={customAppName}
                                                onChange={e => setCustomAppName(e.target.value)}
                                                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500/50"
                                                placeholder={`e.g. my-${selectedTemplate.id}`}
                                            />
                                            <p className="text-xs text-slate-500 mt-2">Used as a prefix for your deployed containers.</p>
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Base Domain (Optional)</label>
                                            <div className="flex rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden focus-within:ring-2 focus-within:ring-brand-500/50 transition-all">
                                                <span className="inline-flex items-center px-4 rounded-l-md border-r bg-slate-50 dark:bg-slate-800 dark:border-slate-700 text-slate-500 dark:text-slate-400 sm:text-sm">
                                                    https://
                                                </span>
                                                <input
                                                    type="text"
                                                    value={domainBase}
                                                    onChange={e => setDomainBase(e.target.value)}
                                                    className="flex-1 block w-full min-w-0 sm:text-sm px-3 py-2.5 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none"
                                                    placeholder="app.yourdomain.com"
                                                />
                                            </div>
                                            <p className="text-xs text-slate-500 mt-2">Traefik will automatically route traffic and provision Let's Encrypt certificates if Auto-SSL is enabled.</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Section 2: Env vars (unified raw/secret) */}
                                {configuredEnvFields.length > 0 && (
                                    <div>
                                        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">2. Environment Variables</h3>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">Configure the app's required variables. Use <strong>Secret</strong> to link to your Vault.</p>
                                        <div className="space-y-3">
                                            {configuredEnvFields.map(([key, field]) => (
                                                <div key={key} className="flex flex-col space-y-2 sm:flex-row sm:space-y-0 sm:items-center sm:space-x-3">
                                                    {/* KEY */}
                                                    <input
                                                        type="text"
                                                        value={key}
                                                        readOnly
                                                        className="flex-1 px-4 py-2 bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl text-slate-500 dark:text-slate-400 font-mono text-sm cursor-default"
                                                    />
                                                    <span className="text-slate-400 dark:text-slate-500 font-bold hidden sm:inline">=</span>
                                                    {/* Type + Value */}
                                                    <div className="flex flex-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl overflow-hidden focus-within:ring-1 focus-within:ring-brand-500">
                                                        <select
                                                            value={field.type}
                                                            onChange={e => updateEnvField(key, 'type', e.target.value)}
                                                            className="bg-slate-100 dark:bg-slate-800 border-none px-3 py-2 text-sm text-slate-700 dark:text-slate-300 focus:ring-0 outline-none w-24 border-r dark:border-slate-700 font-medium shrink-0"
                                                        >
                                                            <option value="raw">Raw</option>
                                                            <option value="secret">Secret</option>
                                                        </select>
                                                        {field.type === 'raw' ? (
                                                            <input
                                                                type="text"
                                                                value={field.value}
                                                                onChange={e => updateEnvField(key, 'value', e.target.value)}
                                                                placeholder={`e.g. ${field.value || field.label}`}
                                                                className="flex-1 px-3 py-2 bg-transparent border-none text-slate-900 dark:text-white font-mono text-sm focus:ring-0 outline-none"
                                                            />
                                                        ) : (
                                                            <select
                                                                value={field.value}
                                                                onChange={e => updateEnvField(key, 'value', e.target.value)}
                                                                className="flex-1 px-3 py-2 bg-transparent border-none text-slate-900 dark:text-white font-mono text-sm focus:ring-0 outline-none"
                                                            >
                                                                <option value="">-- Select Secret --</option>
                                                                {availableSecrets.map(sec => (
                                                                    <option key={sec._id} value={sec.name}>{sec.name}</option>
                                                                ))}
                                                            </select>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                        <p className="text-xs text-amber-700 dark:text-amber-400 flex items-start mt-4">
                                            <ShieldAlert size={14} className="mr-1.5 shrink-0 mt-0.5" />
                                            Secret values are fetched from your Vault. Raw values are injected as plain-text env vars.
                                        </p>
                                    </div>
                                )}

                            </form>
                        </div>

                        {/* Footer */}
                        <div className="p-6 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 flex justify-end space-x-3">
                            <button
                                type="button"
                                onClick={closeModal}
                                className="px-5 py-2.5 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white rounded-xl font-medium transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                form="deployForm"
                                disabled={deploying}
                                className="px-6 py-2.5 bg-brand-500 hover:bg-brand-600 text-white rounded-xl font-bold shadow-lg shadow-brand-500/30 transition-transform active:scale-95 disabled:opacity-50 disabled:pointer-events-none flex items-center"
                            >
                                {deploying ? (
                                    <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div> Deploying Stack...</>
                                ) : (
                                    <><Play size={18} className="mr-2 fill-current" /> Deploy {selectedTemplate.name}</>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Marketplace;
