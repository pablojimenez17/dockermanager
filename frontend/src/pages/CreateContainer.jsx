import React, { useState, useEffect } from 'react';
import { Box, Code, Database, Globe, Lock, Play, Server, AlertCircle, Settings2, Cpu, HardDrive, Network, ChevronDown, ChevronUp, Plus, Trash2, Layers, Zap, ShieldAlert, Info } from 'lucide-react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const getEmptyContainer = () => ({
    id: crypto.randomUUID(),
    name: '',
    image: '',
    portBinding: '',
    memory: '512',
    cpu: '1',
    restartPolicy: 'no',
    networkMode: 'bridge',
    enableInternet: false,
    ipv4Address: '',
    envVars: [{ key: '', value: '', type: 'raw' }],
    showAdvanced: false,
    exposeDomain: false,
    domain: '',
    domainPort: '',
    volumeName: '',
    volumeMountPath: ''
});

const CreateContainer = () => {
    const [containers, setContainers] = useState([getEmptyContainer()]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [availableNetworks, setAvailableNetworks] = useState([]);
    const [availableVolumes, setAvailableVolumes] = useState([]);
    const [availableSecrets, setAvailableSecrets] = useState([]);
    const [limits, setLimits] = useState({ maxContainers: 2, maxRamMb: 1024, maxCpuCores: 1 });
    const [currentContainerCount, setCurrentContainerCount] = useState(0);
    const [currentRamMb, setCurrentRamMb] = useState(0);
    const [currentCpu, setCurrentCpu] = useState(0);

    const navigate = useNavigate();

    useEffect(() => {
        const fetchContext = async () => {
            try {
                const [netRes, meRes, myContainersRes, volRes, secRes] = await Promise.all([
                    axios.get('/api/networks'),
                    axios.get('/api/auth/me'),
                    axios.get('/api/containers'),
                    axios.get('/api/volumes'),
                    axios.get('/api/secrets')
                ]);
                setAvailableNetworks(netRes.data);
                setAvailableVolumes(volRes.data || []);
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
                console.error("Failed to fetch context:", err);
            }
        };
        fetchContext();
    }, []);

    const handleAddContainer = () => {
        setContainers([...containers, getEmptyContainer()]);
    };

    const handleRemoveContainer = (id) => {
        if (containers.length === 1) return;
        setContainers(containers.filter(c => c.id !== id));
    };

    const updateContainer = (id, field, value) => {
        setContainers(containers.map(c =>
            c.id === id ? { ...c, [field]: value } : c
        ));
    };

    const toggleAdvanced = (id) => {
        setContainers(containers.map(c =>
            c.id === id ? { ...c, showAdvanced: !c.showAdvanced } : c
        ));
    };

    const updateEnvVar = (containerId, envIndex, field, value) => {
        setContainers(containers.map(c => {
            if (c.id === containerId) {
                const newEnvVars = [...c.envVars];
                newEnvVars[envIndex] = { ...newEnvVars[envIndex], [field]: value };
                return { ...c, envVars: newEnvVars };
            }
            return c;
        }));
    };

    const addEnvVar = (containerId) => {
        setContainers(containers.map(c => {
            if (c.id === containerId) {
                return { ...c, envVars: [...c.envVars, { key: '', value: '', type: 'raw' }] };
            }
            return c;
        }));
    };

    const removeEnvVar = (containerId, envIndex) => {
        setContainers(containers.map(c => {
            if (c.id === containerId) {
                const newEnvVars = c.envVars.filter((_, idx) => idx !== envIndex);
                if (newEnvVars.length === 0) newEnvVars.push({ key: '', value: '', type: 'raw' });
                return { ...c, envVars: newEnvVars };
            }
            return c;
        }));
    };

    const IMAGE_PRESETS = {
        'mysql': [
            { key: 'MYSQL_ROOT_PASSWORD', value: '', type: 'secret' },
            { key: 'MYSQL_DATABASE', value: 'mydb', type: 'raw' },
            { key: 'MYSQL_USER', value: 'admin', type: 'raw' },
            { key: 'MYSQL_PASSWORD', value: '', type: 'secret' },
        ],
        'mariadb': [
            { key: 'MYSQL_ROOT_PASSWORD', value: '', type: 'secret' },
            { key: 'MYSQL_DATABASE', value: 'mydb', type: 'raw' },
            { key: 'MYSQL_USER', value: 'admin', type: 'raw' },
            { key: 'MYSQL_PASSWORD', value: '', type: 'secret' },
        ],
        'postgres': [
            { key: 'POSTGRES_USER', value: 'admin', type: 'raw' },
            { key: 'POSTGRES_PASSWORD', value: '', type: 'secret' },
            { key: 'POSTGRES_DB', value: 'mydb', type: 'raw' },
        ],
        'mongo': [
            { key: 'MONGO_INITDB_ROOT_USERNAME', value: 'admin', type: 'raw' },
            { key: 'MONGO_INITDB_ROOT_PASSWORD', value: '', type: 'secret' },
        ],
        'redis': [
            { key: 'REDIS_PASSWORD', value: '', type: 'secret' },
        ],
        'wordpress': [
            { key: 'WORDPRESS_DB_HOST', value: 'db:3306', type: 'raw' },
            { key: 'WORDPRESS_DB_USER', value: 'wordpress', type: 'raw' },
            { key: 'WORDPRESS_DB_PASSWORD', value: '', type: 'secret' },
            { key: 'WORDPRESS_DB_NAME', value: 'wordpress', type: 'raw' },
        ],
        'ghost': [
            { key: 'url', value: 'http://localhost:2368', type: 'raw' },
            { key: 'database__client', value: 'mysql', type: 'raw' },
            { key: 'database__connection__host', value: 'db', type: 'raw' },
            { key: 'database__connection__user', value: 'root', type: 'raw' },
            { key: 'database__connection__password', value: '', type: 'secret' },
            { key: 'database__connection__database', value: 'ghost', type: 'raw' },
        ],
        'nginx': [],
        'node': [
            { key: 'NODE_ENV', value: 'production', type: 'raw' },
            { key: 'PORT', value: '3000', type: 'raw' },
        ],
        'nextcloud': [
            { key: 'MYSQL_HOST', value: 'db', type: 'raw' },
            { key: 'MYSQL_DATABASE', value: 'nextcloud', type: 'raw' },
            { key: 'MYSQL_USER', value: 'nextcloud', type: 'raw' },
            { key: 'MYSQL_PASSWORD', value: '', type: 'secret' },
            { key: 'NEXTCLOUD_ADMIN_USER', value: 'admin', type: 'raw' },
            { key: 'NEXTCLOUD_ADMIN_PASSWORD', value: '', type: 'secret' },
        ],
        'n8n': [
            { key: 'N8N_BASIC_AUTH_ACTIVE', value: 'true', type: 'raw' },
            { key: 'N8N_BASIC_AUTH_USER', value: 'admin', type: 'raw' },
            { key: 'N8N_BASIC_AUTH_PASSWORD', value: '', type: 'secret' },
        ],
    };

    const handleImageChange = (containerId, imageValue) => {
        updateContainer(containerId, 'image', imageValue);
        const imageName = imageValue.split(':')[0].split('/').pop().toLowerCase();
        const preset = Object.entries(IMAGE_PRESETS).find(([key]) => imageName.startsWith(key));
        if (preset) {
            const presetEnvVars = preset[1];
            if (presetEnvVars.length > 0) {
                setContainers(prev => prev.map(c =>
                    c.id === containerId ? { ...c, envVars: presetEnvVars } : c
                ));
            }
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const payload = containers.map(c => {
                const validEnvVars = c.envVars
                    .filter(env => env.key.trim() !== '')
                    .map(env => env.type === 'secret' ? `${env.key.trim()}={{SECRET:${env.value.trim()}}}` : `${env.key.trim()}=${env.value.trim()}`);

                return {
                    name: c.name,
                    image: c.image,
                    ports: c.portBinding ? [c.portBinding] : [],
                    env: validEnvVars,
                    memory: c.memory,
                    cpu: c.cpu,
                    restartPolicy: c.restartPolicy,
                    networkMode: c.networkMode,
                    enableInternet: c.enableInternet === true,
                    ipv4Address: (c.networkMode !== 'bridge' && c.networkMode !== 'host' && c.networkMode !== 'none') ? c.ipv4Address : undefined,
                    domain: c.exposeDomain ? c.domain : undefined,
                    domainPort: c.exposeDomain ? c.domainPort : undefined,
                    volumeName: c.volumeName && c.volumeMountPath ? c.volumeName : undefined,
                    volumeMountPath: c.volumeName && c.volumeMountPath ? c.volumeMountPath : undefined
                };
            });

            await axios.post('/api/containers', { stack: payload });
            navigate('/app/containers');
        } catch (err) {
            const specificError = err.response?.data?.error;
            const generalMessage = err.response?.data?.message;
            setError(specificError || generalMessage || 'Error deploying stack');
            setLoading(false);
        }
    };

    const requestedContainers = containers.length;
    const requestedRamMb = containers.reduce((acc, curr) => acc + (curr.memory ? parseInt(curr.memory) : 512), 0);
    const requestedCpu = containers.reduce((acc, curr) => acc + (curr.cpu ? parseFloat(curr.cpu) : 1), 0);

    const isExceedingLimits = (currentContainerCount + requestedContainers > limits.maxContainers) ||
        (currentRamMb + requestedRamMb > limits.maxRamMb) ||
        (currentCpu + requestedCpu > limits.maxCpuCores);

    return (
        <div className="p-4 sm:p-8 pb-20 text-slate-200 max-w-6xl mx-auto">
            <div className="mb-14 reveal">
                <h1 className="text-3xl sm:text-5xl font-display font-bold tracking-tighter mb-3 uppercase text-white drop-shadow-md">Deploy <span className="text-brand-500">Stack</span></h1>
                <p className="text-slate-400 text-base sm:text-lg uppercase tracking-widest font-semibold">Configure high-performance environments.</p>
            </div>

            <div className="w-full reveal" style={{ animationDelay: '0.1s' }}>
                <form onSubmit={handleSubmit} className="space-y-10">
                    {error && (
                        <div className="panel-glass bg-rose-500/10 border-rose-500/50 text-rose-400 text-sm p-4 rounded-sm flex items-start space-x-3 shadow-inner">
                            <AlertCircle size={20} className="shrink-0 mt-0.5" />
                            <span className="font-mono uppercase tracking-widest text-[10px]">{error}</span>
                        </div>
                    )}

                    {/* Quotas Visualization */}
                    <div className="panel-glass rounded-sm p-8 hover:border-brand-500/30 transition-aero shadow-inner">
                        <h4 className="text-[10px] font-display font-bold text-white mb-6 flex items-center uppercase tracking-[0.2em]">
                            <ShieldAlert size={14} className="mr-3 text-brand-500" /> Infrastructure Quotas
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-10">
                            <div>
                                <div className="flex justify-between text-[10px] uppercase tracking-widest font-display mb-3">
                                    <span className="text-slate-500">Instance Count</span>
                                    <span className={`font-bold ${currentContainerCount > limits.maxContainers ? 'text-rose-500' : 'text-slate-300'}`}>
                                        {currentContainerCount} / {limits.maxContainers}
                                    </span>
                                </div>
                                <div className="w-full bg-[#030305] border border-surface-border rounded-sm h-1.5 overflow-hidden">
                                    <div className={`h-1.5 transition-all duration-1000 ${currentContainerCount > limits.maxContainers ? 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.8)]' : 'bg-brand-500 shadow-[0_0_8px_rgba(220,38,38,0.8)]'}`} style={{ width: `${Math.min((currentContainerCount / limits.maxContainers) * 100, 100)}%` }}></div>
                                </div>
                            </div>
                            <div>
                                <div className="flex justify-between text-[10px] uppercase tracking-widest font-display mb-3">
                                    <span className="text-slate-500">Memory Matrix</span>
                                    <span className={`font-bold ${currentRamMb > limits.maxRamMb ? 'text-rose-500' : 'text-slate-300'}`}>
                                        {currentRamMb}MB / {limits.maxRamMb}MB
                                    </span>
                                </div>
                                <div className="w-full bg-[#030305] border border-surface-border rounded-sm h-1.5 overflow-hidden">
                                    <div className={`h-1.5 transition-all duration-1000 ${currentRamMb > limits.maxRamMb ? 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.8)]' : 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]'}`} style={{ width: `${Math.min((currentRamMb / limits.maxRamMb) * 100, 100)}%` }}></div>
                                </div>
                            </div>
                            <div>
                                <div className="flex justify-between text-[10px] uppercase tracking-widest font-display mb-3">
                                    <span className="text-slate-500">Core Threads</span>
                                    <span className={`font-bold ${currentCpu > limits.maxCpuCores ? 'text-rose-500' : 'text-slate-300'}`}>
                                        {currentCpu} / {limits.maxCpuCores} vCPU
                                    </span>
                                </div>
                                <div className="w-full bg-[#030305] border border-surface-border rounded-sm h-1.5 overflow-hidden">
                                    <div className={`h-1.5 transition-all duration-1000 ${currentCpu > limits.maxCpuCores ? 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.8)]' : 'bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.8)]'}`} style={{ width: `${Math.min((currentCpu / limits.maxCpuCores) * 100, 100)}%` }}></div>
                                </div>
                            </div>
                        </div>
                        {isExceedingLimits && (
                            <p className="text-[10px] font-display uppercase tracking-widest text-rose-500 mt-6 flex items-center border border-rose-500/20 bg-rose-500/5 p-3 rounded-sm shadow-inner">
                                <AlertCircle size={14} className="mr-2 shrink-0" /> Payload exceeds authorized limits ({requestedContainers} units, {requestedRamMb}MB mem, {requestedCpu} threads).
                            </p>
                        )}
                    </div>

                    <div className="space-y-10">
                        {containers.map((c, index) => (
                            <div key={c.id} className="panel-glass rounded-sm overflow-hidden group hover:border-brand-500/30 transition-aero duration-500 shadow-hud relative">
                                <div className="absolute top-0 left-0 w-1 h-full bg-surface-border group-hover:bg-brand-500 transition-colors"></div>
                                
                                <div className="p-8 pb-4 flex justify-between items-center border-b border-surface-border bg-surface/30">
                                    <div className="flex items-center space-x-4">
                                        <div className="font-display font-bold text-2xl text-brand-500/50 group-hover:text-brand-500 transition-colors">
                                            0{index + 1}
                                        </div>
                                        <h4 className="text-[10px] uppercase tracking-[0.2em] font-display text-white">Engine Specifications</h4>
                                    </div>
                                    {containers.length > 1 && (
                                        <button
                                            type="button"
                                            onClick={() => handleRemoveContainer(c.id)}
                                            className="text-slate-500 hover:text-rose-400 transition-aero p-2 hover:bg-rose-500/10 rounded-sm shadow-inner border border-transparent hover:border-rose-500/20"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    )}
                                </div>

                                <div className="p-8">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                                        <div>
                                            <label className="block text-[10px] font-display uppercase tracking-widest text-slate-500 mb-3">Instance Name</label>
                                            <input
                                                type="text"
                                                required
                                                value={c.name}
                                                onChange={(e) => updateContainer(c.id, 'name', e.target.value)}
                                                placeholder="e.g. telemetry-node"
                                                className="w-full px-4 py-3 bg-[#030305] border border-surface-border rounded-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none text-white transition-aero font-mono text-sm shadow-inner"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-[10px] font-display uppercase tracking-widest text-slate-500 mb-3">Docker Image Blueprint</label>
                                            <input
                                                type="text"
                                                required
                                                value={c.image}
                                                onChange={(e) => handleImageChange(c.id, e.target.value)}
                                                placeholder="e.g. nginx:alpine"
                                                className="w-full px-4 py-3 bg-[#030305] border border-surface-border rounded-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none text-brand-300 font-mono text-sm shadow-inner"
                                            />
                                            {c.image && Object.keys(IMAGE_PRESETS).some(k => c.image.toLowerCase().includes(k)) && (
                                                <p className="text-[10px] font-display text-emerald-400 mt-2 flex items-center tracking-widest uppercase">
                                                    <Zap size={10} className="mr-2" /> Preset Calibration Applied
                                                </p>
                                            )}
                                        </div>
                                    </div>

                                    <div className="mb-10">
                                        <label className="flex items-center space-x-2 text-[10px] font-display uppercase tracking-widest text-slate-500 mb-3">
                                            <span>Manual Port Override (Optional)</span>
                                            <Info size={14} className="text-slate-600" />
                                        </label>
                                        <input
                                            type="text"
                                            value={c.portBinding}
                                            onChange={(e) => updateContainer(c.id, 'portBinding', e.target.value)}
                                            placeholder="e.g. 8080:80"
                                            disabled={c.exposeDomain}
                                            className={`w-full px-4 py-3 bg-[#030305] border border-surface-border rounded-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none text-white font-mono text-sm shadow-inner ${c.exposeDomain ? 'opacity-30 cursor-not-allowed' : ''}`}
                                        />
                                        {c.exposeDomain && (
                                            <p className="mt-3 text-[10px] text-amber-500/80 font-display uppercase tracking-widest flex items-center">
                                                <AlertCircle size={12} className="mr-2" />
                                                Overridden by Traefik Ingress.
                                            </p>
                                        )}
                                    </div>

                                    {/* Domain Exposer */}
                                    <div className="mb-8 bg-purple-500/5 border border-purple-500/20 rounded-sm p-6 shadow-inner hover:border-purple-500/40 transition-aero">
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center space-x-3 text-purple-400">
                                                <Globe size={18} />
                                                <h5 className="font-display text-[10px] font-bold uppercase tracking-[0.2em]">Traefik Ingress Routing</h5>
                                            </div>
                                            <label className="relative inline-flex items-center cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={c.exposeDomain || false}
                                                    onChange={(e) => updateContainer(c.id, 'exposeDomain', e.target.checked)}
                                                    className="sr-only peer"
                                                />
                                                <div className="w-10 h-5 bg-[#030305] border border-surface-border peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-400 after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-purple-600/50 peer-checked:border-purple-500/50"></div>
                                            </label>
                                        </div>

                                        {c.exposeDomain && (
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 mt-4 border-t border-purple-500/20 animate-in fade-in slide-in-from-top-2">
                                                <div>
                                                    <label className="block text-[10px] font-display uppercase tracking-widest text-purple-400 mb-2">Target Domain</label>
                                                    <input
                                                        type="text"
                                                        value={c.domain || ''}
                                                        onChange={(e) => updateContainer(c.id, 'domain', e.target.value)}
                                                        placeholder="e.g. app.domain.com"
                                                        required={c.exposeDomain}
                                                        className="w-full px-4 py-3 bg-[#030305] border border-purple-500/30 rounded-sm focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none text-white font-mono text-sm shadow-inner"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] font-display uppercase tracking-widest text-purple-400 mb-2">Internal Payload Port</label>
                                                    <input
                                                        type="number"
                                                        value={c.domainPort || ''}
                                                        onChange={(e) => updateContainer(c.id, 'domainPort', e.target.value)}
                                                        placeholder="e.g. 80"
                                                        required={c.exposeDomain}
                                                        className="w-full px-4 py-3 bg-[#030305] border border-purple-500/30 rounded-sm focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none text-white font-mono text-sm shadow-inner"
                                                    />
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Advanced Options Accordion */}
                                    <div className="border border-surface-border bg-surface/30 rounded-sm overflow-hidden transition-aero shadow-inner">
                                        <button
                                            type="button"
                                            onClick={() => toggleAdvanced(c.id)}
                                            className="w-full flex items-center justify-between p-6 bg-surface hover:bg-surface-hover transition-colors border-b border-surface-border/50"
                                        >
                                            <div className="flex items-center space-x-3">
                                                <Settings2 size={16} className={c.showAdvanced ? "text-brand-500" : "text-slate-500"} />
                                                <span className={`font-display text-[10px] font-bold uppercase tracking-widest ${c.showAdvanced ? 'text-white' : 'text-slate-400'}`}>Performance Tuning</span>
                                            </div>
                                            {c.showAdvanced ? <ChevronUp size={16} className="text-brand-500" /> : <ChevronDown size={16} className="text-slate-500" />}
                                        </button>

                                        {c.showAdvanced && (
                                            <div className="p-8 space-y-10 animate-in fade-in duration-300 bg-[#050508]/50">
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                                    <div>
                                                        <label className="flex items-center space-x-3 text-[10px] font-display uppercase tracking-widest text-slate-500 mb-3">
                                                            <HardDrive size={14} className="text-brand-500/50" />
                                                            <span>Memory Allocation (MB)</span>
                                                        </label>
                                                        <input
                                                            type="number"
                                                            value={c.memory}
                                                            onChange={(e) => updateContainer(c.id, 'memory', e.target.value)}
                                                            placeholder="512"
                                                            className="w-full px-4 py-3 bg-[#030305] border border-surface-border rounded-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none text-white font-mono text-sm shadow-inner"
                                                        />
                                                    </div>

                                                    <div>
                                                        <label className="flex items-center space-x-3 text-[10px] font-display uppercase tracking-widest text-slate-500 mb-3">
                                                            <Cpu size={14} className="text-brand-500/50" />
                                                            <span>CPU Allocation (Cores)</span>
                                                        </label>
                                                        <input
                                                            type="number"
                                                            step="0.1"
                                                            value={c.cpu}
                                                            onChange={(e) => updateContainer(c.id, 'cpu', e.target.value)}
                                                            placeholder="1"
                                                            className="w-full px-4 py-3 bg-[#030305] border border-surface-border rounded-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none text-white font-mono text-sm shadow-inner"
                                                        />
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                                    <div>
                                                        <label className="flex items-center space-x-3 text-[10px] font-display uppercase tracking-widest text-slate-500 mb-3">
                                                            <Settings2 size={14} className="text-brand-500/50" />
                                                            <span>Recovery Protocol</span>
                                                        </label>
                                                        <select
                                                            value={c.restartPolicy}
                                                            onChange={(e) => updateContainer(c.id, 'restartPolicy', e.target.value)}
                                                            className="w-full px-4 py-3 bg-[#030305] border border-surface-border rounded-sm focus:border-brand-500 outline-none text-slate-300 font-mono text-sm shadow-inner"
                                                        >
                                                            <option value="no">Manual (Default)</option>
                                                            <option value="always">Always Auto-Recover</option>
                                                            <option value="unless-stopped">Unless User Stopped</option>
                                                            <option value="on-failure">On Fault Failure</option>
                                                        </select>
                                                    </div>

                                                    <div>
                                                        <label className="flex items-center space-x-3 text-[10px] font-display uppercase tracking-widest text-slate-500 mb-3">
                                                            <Network size={14} className="text-brand-500/50" />
                                                            <span>VPC Architecture</span>
                                                        </label>
                                                        <select
                                                            value={c.networkMode}
                                                            onChange={(e) => updateContainer(c.id, 'networkMode', e.target.value)}
                                                            className="w-full px-4 py-3 bg-[#030305] border border-surface-border rounded-sm focus:border-brand-500 outline-none text-slate-300 font-mono text-sm shadow-inner"
                                                        >
                                                            <option value="bridge">🛡️ Private VPC</option>
                                                            <option value="none">🔒 Total Isolation (Air-gapped)</option>
                                                            {availableNetworks.filter(n => !['bridge', 'host', 'none'].includes(n.Name)).map(net => (
                                                                <option key={net.Id} value={net.Name}>{net.Name}</option>
                                                            ))}
                                                        </select>
                                                    </div>

                                                    {c.networkMode !== 'none' && (
                                                        <div className={`col-span-1 md:col-span-2 flex items-center justify-between p-5 rounded-sm border shadow-inner transition-aero ${c.enableInternet
                                                            ? 'bg-amber-500/10 border-amber-500/30'
                                                            : 'bg-[#030305] border-surface-border'
                                                            }`}>
                                                            <div className="flex items-center space-x-4">
                                                                {c.enableInternet
                                                                    ? <Globe size={20} className="text-amber-500 shrink-0" />
                                                                    : <Lock size={20} className="text-slate-600 shrink-0" />
                                                                }
                                                                <div>
                                                                    <p className="text-[10px] font-display font-bold uppercase tracking-widest text-slate-300 mb-1">
                                                                        {c.enableInternet ? 'External Uplink Established' : 'Secure Internal Routing'}
                                                                    </p>
                                                                    <p className="text-[10px] text-slate-500 font-mono leading-relaxed">
                                                                        {c.enableInternet
                                                                            ? 'WARNING: Container can transmit data to the public internet.'
                                                                            : 'Container network traffic is restricted to internal VPC only.'
                                                                        }
                                                                    </p>
                                                                </div>
                                                            </div>
                                                            <button
                                                                type="button"
                                                                onClick={() => updateContainer(c.id, 'enableInternet', !c.enableInternet)}
                                                                className={`relative inline-flex h-5 w-10 shrink-0 items-center rounded-full transition-colors focus:outline-none ${c.enableInternet ? 'bg-amber-500/80' : 'bg-surface border border-surface-border'
                                                                    }`}
                                                            >
                                                                <span className={`inline-block h-3 w-3 transform rounded-full bg-slate-300 shadow transition-transform ${c.enableInternet ? 'translate-x-6 bg-white' : 'translate-x-1'
                                                                    }`} />
                                                            </button>
                                                        </div>
                                                    )}

                                                    {c.networkMode !== 'bridge' && c.networkMode !== 'host' && c.networkMode !== 'none' && (
                                                        <div className="col-span-1 md:col-span-2">
                                                            <label className="flex items-center space-x-3 text-[10px] font-display uppercase tracking-widest text-slate-500 mb-3">
                                                                <Network size={14} className="text-brand-500/50" />
                                                                <span>Static IPv4 (Optional)</span>
                                                            </label>
                                                            <input
                                                                type="text"
                                                                value={c.ipv4Address || ''}
                                                                onChange={(e) => updateContainer(c.id, 'ipv4Address', e.target.value)}
                                                                placeholder="172.18.x.x"
                                                                className="w-full px-4 py-3 bg-[#030305] border border-surface-border rounded-sm focus:border-brand-500 outline-none text-white font-mono text-sm shadow-inner"
                                                            />
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="pt-8 border-t border-surface-border grid grid-cols-1 md:grid-cols-2 gap-8">
                                                    <div>
                                                        <label className="flex items-center space-x-3 text-[10px] font-display uppercase tracking-widest text-slate-500 mb-3">
                                                            <HardDrive size={14} className="text-brand-500/50" />
                                                            <span>Persistent Disk Mount</span>
                                                        </label>
                                                        <select
                                                            value={c.volumeName || ''}
                                                            onChange={(e) => updateContainer(c.id, 'volumeName', e.target.value)}
                                                            className="w-full px-4 py-3 bg-[#030305] border border-surface-border rounded-sm focus:border-brand-500 outline-none text-slate-300 font-mono text-sm shadow-inner"
                                                        >
                                                            <option value="">None (Volatile Memory)</option>
                                                            {availableVolumes.map(v => (
                                                                <option key={v._id || v.name} value={v.name}>{v.name}</option>
                                                            ))}
                                                        </select>
                                                    </div>

                                                    {c.volumeName && (
                                                        <div className="animate-in fade-in">
                                                            <label className="flex items-center space-x-3 text-[10px] font-display uppercase tracking-widest text-slate-500 mb-3">
                                                                <span>Target Directory Path</span>
                                                            </label>
                                                            <input
                                                                type="text"
                                                                value={c.volumeMountPath || ''}
                                                                onChange={(e) => updateContainer(c.id, 'volumeMountPath', e.target.value)}
                                                                placeholder="/var/lib/data"
                                                                required={!!c.volumeName}
                                                                className="w-full px-4 py-3 bg-[#030305] border border-surface-border rounded-sm focus:border-brand-500 outline-none text-brand-300 font-mono text-sm shadow-inner"
                                                            />
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="pt-8 border-t border-surface-border">
                                                    <label className="flex flex-col mb-6">
                                                        <span className="text-[10px] font-display uppercase tracking-widest text-slate-500 mb-1">Environment Variables</span>
                                                        <span className="text-[10px] text-slate-600 font-mono">Injected directly into runtime.</span>
                                                    </label>

                                                    <div className="space-y-4 mb-6">
                                                        {c.envVars.map((env, eIdx) => (
                                                            <div key={eIdx} className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:items-center sm:space-x-4">
                                                                <input
                                                                    type="text"
                                                                    placeholder="KEY"
                                                                    value={env.key}
                                                                    onChange={(e) => updateEnvVar(c.id, eIdx, 'key', e.target.value)}
                                                                    className="flex-1 px-4 py-3 bg-[#030305] border border-surface-border rounded-sm focus:border-brand-500 outline-none text-brand-300 font-mono text-xs shadow-inner"
                                                                />
                                                                <span className="text-slate-600 font-bold hidden sm:block">=</span>

                                                                <div className="flex bg-[#030305] border border-surface-border rounded-sm overflow-hidden focus-within:border-brand-500 shadow-inner">
                                                                    <select
                                                                        value={env.type || 'raw'}
                                                                        onChange={(e) => updateEnvVar(c.id, eIdx, 'type', e.target.value)}
                                                                        className="bg-surface/50 border-none px-3 py-3 text-[10px] font-display uppercase tracking-widest text-slate-400 outline-none w-28 border-r border-surface-border"
                                                                    >
                                                                        <option value="raw">Raw</option>
                                                                        <option value="secret">Secret</option>
                                                                    </select>

                                                                    {(!env.type || env.type === 'raw') ? (
                                                                        <input
                                                                            type="text"
                                                                            placeholder="VALUE"
                                                                            value={env.value}
                                                                            onChange={(e) => updateEnvVar(c.id, eIdx, 'value', e.target.value)}
                                                                            className="flex-1 px-4 py-3 bg-transparent border-none text-slate-300 font-mono text-xs outline-none w-full"
                                                                        />
                                                                    ) : (
                                                                        <select
                                                                            value={env.value}
                                                                            onChange={(e) => updateEnvVar(c.id, eIdx, 'value', e.target.value)}
                                                                            className="flex-1 px-4 py-3 bg-transparent border-none text-amber-400 font-mono text-xs outline-none w-full"
                                                                        >
                                                                            <option value="">-- SELECT VAULT KEY --</option>
                                                                            {availableSecrets.map(sec => (
                                                                                <option key={sec._id} value={sec.name}>{sec.name}</option>
                                                                            ))}
                                                                        </select>
                                                                    )}
                                                                </div>

                                                                <button
                                                                    type="button"
                                                                    onClick={() => removeEnvVar(c.id, eIdx)}
                                                                    className="p-3 text-slate-600 hover:text-rose-500 bg-surface border border-surface-border hover:border-rose-500/30 rounded-sm transition-aero shadow-inner"
                                                                >
                                                                    <Trash2 size={16} />
                                                                </button>
                                                            </div>
                                                        ))}
                                                    </div>

                                                    <button
                                                        type="button"
                                                        onClick={() => addEnvVar(c.id)}
                                                        className="text-[10px] font-display font-bold uppercase tracking-widest text-brand-500 hover:text-brand-400 flex items-center transition-colors"
                                                    >
                                                        <Plus size={14} className="mr-2" />
                                                        Append Variable
                                                    </button>
                                                </div>

                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    <p className="text-[10px] font-mono text-slate-600 leading-relaxed uppercase tracking-wider text-center mt-8">
                        <span className="text-brand-500/80">Security Protocol:</span> Container runtime isolation active. Internal configuration remains user liability.
                    </p>

                    <div className="flex flex-col sm:flex-row gap-6 mt-10">
                        <button
                            type="button"
                            onClick={handleAddContainer}
                            className="flex-1 flex justify-center items-center space-x-3 py-5 px-6 rounded-sm border border-dashed border-surface-border hover:border-brand-500/50 hover:bg-brand-500/5 text-slate-400 hover:text-brand-400 transition-aero font-display text-[10px] font-bold uppercase tracking-widest shadow-inner"
                        >
                            <Plus size={16} />
                            <span>Add Engine to Payload</span>
                        </button>

                        <button
                            type="submit"
                            disabled={loading || isExceedingLimits}
                            className={`flex-1 flex justify-center items-center space-x-3 py-5 px-6 rounded-sm font-display text-[10px] font-bold uppercase tracking-[0.2em] transition-aero
                                ${(loading || isExceedingLimits) ? 'bg-surface border border-surface-border text-slate-600 cursor-not-allowed' : 'bg-brand-600 hover:bg-brand-500 text-white shadow-[0_0_20px_rgba(220,38,38,0.3)]'}
                            `}
                        >
                            {loading ? (
                                <span className="flex items-center space-x-3">
                                    <span className="animate-[spin_2s_linear_infinite] w-4 h-4 border-2 border-transparent border-t-white rounded-full"></span>
                                    <span>Ignition Sequence Active...</span>
                                </span>
                            ) : (
                                <>
                                    <span>Execute Deployment</span>
                                    <Play size={16} className="fill-current" />
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default CreateContainer;
