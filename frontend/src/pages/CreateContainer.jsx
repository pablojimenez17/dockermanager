import React, { useState, useEffect } from 'react';
import { Box, Code, Database, Globe, Play, Server, AlertCircle, Settings2, Cpu, HardDrive, Network, ChevronDown, ChevronUp, Plus, Trash2, Layers, Zap, ShieldAlert } from 'lucide-react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const predefinedImages = [
    { id: 'custom', name: 'Custom Stack', image: 'custom', icon: <Layers size={24} />, desc: 'Build your own multi-container architecture from scratch' },
    { id: 'ubuntu', name: 'Ubuntu Latest', image: 'ubuntu:latest', icon: <Server size={24} />, desc: 'Base Ubuntu OS image for raw Linux setup' },
    { id: 'node', name: 'Node.js', image: 'node:18-alpine', icon: <Code size={24} />, desc: 'Lightweight Node 18 environment' },
    { id: 'nginx', name: 'Nginx', image: 'nginx:alpine', icon: <Globe size={24} />, desc: 'High-performance web server & reverse proxy' },
    { id: 'postgres', name: 'PostgreSQL', image: 'postgres:15-alpine', icon: <Database size={24} />, desc: 'Advanced open source relational database' },
    { id: 'redis', name: 'Redis', image: 'redis:alpine', icon: <Zap size={24} />, desc: 'In-memory data structure store, used as a database, cache, and message broker' },
    { id: 'minecraft', name: 'Minecraft Server', image: 'itzg/minecraft-server', icon: <Box size={24} />, desc: 'Ready-to-play Minecraft Java Server' },
    { id: 'wp-mysql', name: 'WordPress + MySQL', image: 'wordpress:latest', icon: <Globe size={24} />, desc: 'Full CMS Stack with automatically linked Database' },
];

const APP_ENV_PRESETS = {
    mysql: [
        { key: 'MYSQL_ROOT_PASSWORD', value: 'secret' },
        { key: 'MYSQL_DATABASE', value: 'mydb' },
        { key: 'MYSQL_USER', value: 'user' },
        { key: 'MYSQL_PASSWORD', value: 'password' }
    ],
    postgres: [
        { key: 'POSTGRES_USER', value: 'user' },
        { key: 'POSTGRES_PASSWORD', value: 'secret' },
        { key: 'POSTGRES_DB', value: 'mydb' }
    ],
    wordpress: [
        { key: 'WORDPRESS_DB_HOST', value: 'mysql-container:3306' },
        { key: 'WORDPRESS_DB_USER', value: 'user' },
        { key: 'WORDPRESS_DB_PASSWORD', value: 'password' },
        { key: 'WORDPRESS_DB_NAME', value: 'mydb' }
    ],
    mongo: [
        { key: 'MONGO_INITDB_ROOT_USERNAME', value: 'root' },
        { key: 'MONGO_INITDB_ROOT_PASSWORD', value: 'secret' }
    ],
    minecraft: [
        { key: 'EULA', value: 'TRUE' },
        { key: 'VERSION', value: 'LATEST' },
        { key: 'MEMORY', value: '1G' }
    ]
};

const getSuggestedEnvVars = (imageStr) => {
    if (!imageStr) return null;
    const lower = imageStr.toLowerCase();
    if (lower.includes('mysql') || lower.includes('mariadb')) return { label: 'MySQL / MariaDB', vars: APP_ENV_PRESETS.mysql };
    if (lower.includes('postgres')) return { label: 'PostgreSQL', vars: APP_ENV_PRESETS.postgres };
    if (lower.includes('wordpress')) return { label: 'WordPress', vars: APP_ENV_PRESETS.wordpress };
    if (lower.includes('mongo')) return { label: 'MongoDB', vars: APP_ENV_PRESETS.mongo };
    if (lower.includes('minecraft')) return { label: 'Minecraft', vars: APP_ENV_PRESETS.minecraft };
    return null;
};

const getEmptyContainer = () => ({
    id: crypto.randomUUID(),
    name: '',
    image: '',
    replicas: 1,
    portBinding: '',
    memory: '512',
    cpu: '1',
    restartPolicy: 'no',
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
    // Array of container configs
    const [containers, setContainers] = useState([getEmptyContainer()]);
    const [activePreset, setActivePreset] = useState('custom');
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
                const token = localStorage.getItem('token');
                if (!token) return;
                const [netRes, meRes, myContainersRes, volRes, secRes] = await Promise.all([
                    axios.get('http://localhost:5000/api/networks', { headers: { Authorization: `Bearer ${token}` } }),
                    axios.get('http://localhost:5000/api/auth/me', { headers: { Authorization: `Bearer ${token}` } }),
                    axios.get('http://localhost:5000/api/containers', { headers: { Authorization: `Bearer ${token}` } }),
                    axios.get('http://localhost:5000/api/volumes', { headers: { Authorization: `Bearer ${token}` } }),
                    axios.get('http://localhost:5000/api/secrets', { headers: { Authorization: `Bearer ${token}` } })
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

    const handleSelectPredefined = (preset) => {
        setActivePreset(preset.id);

        if (preset.id === 'custom') {
            setContainers([getEmptyContainer()]);
            return;
        }

        if (preset.id === 'wp-mysql') {
            // Create two containers
            setContainers([
                {
                    ...getEmptyContainer(),
                    name: ``,
                    image: 'wordpress:latest',
                    portBinding: '8000:80',
                    networkMode: 'bridge',
                    envVars: [] // Managed by backend automatically
                },
                {
                    ...getEmptyContainer(),
                    name: ``,
                    image: 'mysql:5.7',
                    portBinding: '', // usually don't need to expose DB to host
                    networkMode: 'bridge',
                    envVars: []
                }
            ]);
            return;
        }

        // Single container presets
        const single = getEmptyContainer();
        single.image = preset.image;
        single.name = '';

        if (preset.id === 'nginx') single.portBinding = '8080:80';
        if (preset.id === 'postgres') single.portBinding = '5432:5432';
        if (preset.id === 'redis') single.portBinding = '6379:6379';
        if (preset.id === 'minecraft') {
            single.portBinding = '25565:25565';
            single.memory = '2048'; // Minecraft needs more RAM
        }

        setContainers([single]);
    };

    const handleAddContainer = () => {
        setContainers([...containers, getEmptyContainer()]);
        setActivePreset('custom'); // User is customizing now
    };

    const handleRemoveContainer = (id) => {
        if (containers.length === 1) return; // Prevent deleting the last one
        setContainers(containers.filter(c => c.id !== id));
        setActivePreset('custom');
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

    // --- Environment Variables Helpers ---
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
                // Ensure at least one empty box
                if (newEnvVars.length === 0) newEnvVars.push({ key: '', value: '', type: 'raw' });
                return { ...c, envVars: newEnvVars };
            }
            return c;
        }));
    };

    const injectEnvVars = (containerId, suggestedVars) => {
        const allPresetKeys = new Set(Object.values(APP_ENV_PRESETS).flat().map(v => v.key));
        setContainers(containers.map(c => {
            if (c.id === containerId) {
                // Filter out any keys that belong to other known presets
                const existingValid = c.envVars.filter(env => env.key.trim() !== '' && !allPresetKeys.has(env.key));
                const existingKeys = new Set(existingValid.map(env => env.key));
                const newVars = suggestedVars.filter(v => !existingKeys.has(v.key)).map(v => ({ ...v, type: 'raw' }));

                const mergedVars = [...existingValid, ...newVars];
                if (mergedVars.length === 0 || mergedVars[mergedVars.length - 1].key !== '') {
                    mergedVars.push({ key: '', value: '', type: 'raw' });
                }
                return { ...c, envVars: mergedVars };
            }
            return c;
        }));
    };
    // -------------------------------------

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const token = localStorage.getItem('token');
            // Format payload
            const payload = containers.map(c => {
                // Filter out empty EnvVars and format as ["KEY=VALUE"] or ["KEY={{SECRET:name}}"]
                const validEnvVars = c.envVars
                    .filter(env => env.key.trim() !== '')
                    .map(env => env.type === 'secret' ? `${env.key.trim()}={{SECRET:${env.value.trim()}}}` : `${env.key.trim()}=${env.value.trim()}`);

                return {
                    name: c.name,
                    image: c.image,
                    replicas: c.replicas ? parseInt(c.replicas) : 1,
                    ports: c.portBinding ? [c.portBinding] : [],
                    env: validEnvVars,
                    memory: c.memory,
                    cpu: c.cpu,
                    restartPolicy: c.restartPolicy,
                    networkMode: c.networkMode,
                    ipv4Address: (c.networkMode !== 'bridge' && c.networkMode !== 'host' && c.networkMode !== 'none') ? c.ipv4Address : undefined,
                    domain: c.exposeDomain ? c.domain : undefined,
                    domainPort: c.exposeDomain ? c.domainPort : undefined,
                    volumeName: c.volumeName && c.volumeMountPath ? c.volumeName : undefined,
                    volumeMountPath: c.volumeName && c.volumeMountPath ? c.volumeMountPath : undefined
                };
            });

            // Since our backend logic was previously updated to handle "host" vs "bridge",
            // we will send the format as { stack: payload }
            await axios.post('http://localhost:5000/api/containers', { stack: payload }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            navigate('/app/containers');
        } catch (err) {
            const specificError = err.response?.data?.error;
            const generalMessage = err.response?.data?.message;
            setError(specificError || generalMessage || 'Error deploying stack');
            setLoading(false);
        }
    };

    // Calculate quotas needed for this stack
    const requestedContainers = containers.length;
    const requestedRamMb = containers.reduce((acc, curr) => acc + (curr.memory ? parseInt(curr.memory) : 512), 0);
    const requestedCpu = containers.reduce((acc, curr) => acc + (curr.cpu ? parseFloat(curr.cpu) : 1), 0);

    const isExceedingLimits = (currentContainerCount + requestedContainers > limits.maxContainers) ||
        (currentRamMb + requestedRamMb > limits.maxRamMb) ||
        (currentCpu + requestedCpu > limits.maxCpuCores);

    return (
        <div className="p-4 sm:p-8 pb-20 text-slate-900 dark:text-white max-w-7xl mx-auto">
            <div className="mb-10">
                <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-2">Deploy a Stack</h1>
                <p className="text-slate-600 dark:text-slate-400 text-base sm:text-lg">Deploy single containers or orchestrate multi-container apps gracefully.</p>
            </div>

            <div className="flex flex-col-reverse lg:grid lg:grid-cols-12 gap-10">

                {/* Left Side: Presets (Moved to left for natural flow) */}
                <div className="lg:col-span-4 space-y-4">
                    <h3 className="text-xl font-bold mb-6 flex items-center space-x-2 text-slate-900 dark:text-white">
                        <Server className="text-purple-600 dark:text-purple-400" />
                        <span>Quick Presets</span>
                    </h3>

                    <div className="grid gap-4">
                        {predefinedImages.map(img => (
                            <div
                                key={img.id}
                                onClick={() => handleSelectPredefined(img)}
                                className={`p-5 rounded-2xl border cursor-pointer transition-all flex items-start space-x-4
                                    ${activePreset === img.id
                                        ? 'bg-brand-50 border-brand-300 shadow-[0_0_15px_rgba(14,165,233,0.05)] dark:bg-brand-500/10 dark:border-brand-500 dark:shadow-[0_0_15px_rgba(14,165,233,0.15)]'
                                        : 'bg-white border-slate-200 hover:border-slate-300 dark:bg-slate-800 dark:border-slate-700 dark:hover:border-slate-500'}
                                `}
                            >
                                <div className={`p-3 rounded-xl shrink-0 ${activePreset === img.id ? 'bg-brand-500 text-white' : 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-300'}`}>
                                    {img.icon}
                                </div>
                                <div>
                                    <h4 className="font-bold text-slate-900 dark:text-white text-lg">{img.name}</h4>
                                    {img.image !== 'custom' && <p className="text-sm font-mono text-brand-600 dark:text-brand-300 my-1">{img.image}</p>}
                                    <p className="text-sm text-slate-600 dark:text-slate-400 leading-snug">{img.desc}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Right Side: Stack Builder */}
                <div className="lg:col-span-8">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-xl font-bold flex items-center space-x-2 text-slate-900 dark:text-white">
                            <Layers className="text-brand-500 dark:text-brand-400" />
                            <span>Stack Builder</span>
                        </h3>
                        <div className="text-sm text-slate-600 bg-white border-slate-200 dark:text-slate-400 dark:bg-slate-800 px-4 py-2 rounded-xl border dark:border-slate-700">
                            {containers.length} Container{containers.length !== 1 ? 's' : ''} Selected
                        </div>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        {error && (
                            <div className="bg-red-500/10 border border-red-500/50 text-red-500 text-sm py-4 px-4 rounded-xl flex items-start space-x-3">
                                <AlertCircle size={20} className="shrink-0 mt-0.5" />
                                <span>{error}</span>
                            </div>
                        )}

                        {/* Quotas Visualization */}
                        <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-2xl p-6 shadow-sm">
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
                            {isExceedingLimits && (
                                <p className="text-xs text-red-500 mt-4 flex items-center">
                                    <AlertCircle size={12} className="mr-1" /> Limits exceeded! Stack requests {requestedContainers} containers, {requestedRamMb}MB RAM, and {requestedCpu} vCPU which pushes you over your plan.
                                </p>
                            )}
                        </div>

                        <div className="space-y-6">
                            {containers.map((c, index) => (
                                <div key={c.id} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-3xl p-8 shadow-xl relative animate-fade-in">
                                    {/* Sub-header for Container index */}
                                    <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-200 dark:border-slate-700/50">
                                        <div className="flex items-center space-x-3">
                                            <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center font-bold text-slate-500 dark:text-slate-300">
                                                {index + 1}
                                            </div>
                                            <h4 className="text-lg font-bold text-slate-900 dark:text-white">Container Configuration</h4>
                                        </div>
                                        {containers.length > 1 && (
                                            <button
                                                type="button"
                                                onClick={() => handleRemoveContainer(c.id)}
                                                className="text-slate-500 hover:text-rose-400 transition-colors p-2 hover:bg-rose-500/10 rounded-lg"
                                                title="Remove container"
                                            >
                                                <Trash2 size={20} />
                                            </button>
                                        )}
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Container Name</label>
                                            <input
                                                type="text"
                                                required
                                                value={c.name}
                                                onChange={(e) => updateContainer(c.id, 'name', e.target.value)}
                                                placeholder="e.g., frontend-app"
                                                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-brand-500 focus:outline-none text-slate-900 dark:text-white transition-shadow"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Docker Image</label>
                                            <input
                                                type="text"
                                                required
                                                value={c.image}
                                                onChange={(e) => updateContainer(c.id, 'image', e.target.value)}
                                                placeholder="e.g., nginx:alpine"
                                                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-brand-500 focus:outline-none text-slate-900 dark:text-white font-mono text-sm"
                                            />
                                        </div>
                                    </div>

                                    <div className="mb-6">
                                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1 flex items-center">
                                            Replicas (High Availability)
                                            <span className="ml-2 text-xs bg-brand-100 text-brand-700 dark:bg-brand-500/20 dark:text-brand-300 px-2 py-0.5 rounded-full font-bold">Auto Load-Balanced</span>
                                        </label>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">Traefik will distribute incoming traffic across all instances automatically.</p>
                                        <div className="relative md:w-1/2">
                                            <input
                                                type="number"
                                                min="1"
                                                max="10"
                                                value={c.replicas || 1}
                                                onChange={(e) => updateContainer(c.id, 'replicas', e.target.value)}
                                                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-brand-500 focus:outline-none text-slate-900 dark:text-white font-bold transition-shadow"
                                            />
                                        </div>
                                    </div>

                                    <div className="mb-6">
                                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Port Binding (Optional)</label>
                                        <input
                                            type="text"
                                            value={c.portBinding}
                                            onChange={(e) => updateContainer(c.id, 'portBinding', e.target.value)}
                                            placeholder="Host_Port:Container_Port (e.g., 8080:80)"
                                            className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-brand-500 focus:outline-none text-slate-900 dark:text-white font-mono text-sm"
                                        />
                                    </div>

                                    {/* Domain Exposer */}
                                    <div className="mb-6 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-2xl p-5">
                                        <div className="flex items-center justify-between mb-4">
                                            <div className="flex items-center space-x-3 text-purple-700 dark:text-purple-300">
                                                <Globe size={20} />
                                                <div>
                                                    <h5 className="font-bold text-sm">Expose to Internet (Traefik Router)</h5>
                                                    <p className="text-xs text-purple-600 dark:text-purple-400 mt-0.5">Attach a custom domain to this container automatically.</p>
                                                </div>
                                            </div>
                                            <label className="relative inline-flex items-center cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={c.exposeDomain || false}
                                                    onChange={(e) => updateContainer(c.id, 'exposeDomain', e.target.checked)}
                                                    className="sr-only peer"
                                                />
                                                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 dark:peer-focus:ring-purple-800 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-purple-600"></div>
                                            </label>
                                        </div>

                                        {c.exposeDomain && (
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-purple-200/50 dark:border-purple-800/50 animate-fade-in text-slate-900 dark:text-white">
                                                <div>
                                                    <label className="block text-xs font-semibold text-purple-700 dark:text-purple-300 mb-1.5">Custom Domain</label>
                                                    <input
                                                        type="text"
                                                        value={c.domain || ''}
                                                        onChange={(e) => updateContainer(c.id, 'domain', e.target.value)}
                                                        placeholder="e.g., api.pablo.dev"
                                                        required={c.exposeDomain}
                                                        className="w-full px-3 py-2.5 bg-white dark:bg-slate-900 border border-purple-300 dark:border-purple-700 rounded-xl focus:ring-2 focus:ring-purple-500 text-sm font-mono placeholder-slate-400"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-semibold text-purple-700 dark:text-purple-300 mb-1.5">Container Internal Port</label>
                                                    <input
                                                        type="number"
                                                        value={c.domainPort || ''}
                                                        onChange={(e) => updateContainer(c.id, 'domainPort', e.target.value)}
                                                        placeholder="e.g., 80 or 3000"
                                                        required={c.exposeDomain}
                                                        className="w-full px-3 py-2.5 bg-white dark:bg-slate-900 border border-purple-300 dark:border-purple-700 rounded-xl focus:ring-2 focus:ring-purple-500 text-sm font-mono placeholder-slate-400"
                                                    />
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Advanced Options Accordion for this specific container */}
                                    <div className="border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 rounded-2xl overflow-hidden transition-all duration-300">
                                        <button
                                            type="button"
                                            onClick={() => toggleAdvanced(c.id)}
                                            className="w-full flex items-center justify-between p-4 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700/50 transition-colors"
                                        >
                                            <div className="flex items-center space-x-2">
                                                <Settings2 size={18} className={c.showAdvanced ? "text-brand-500 dark:text-brand-400" : "text-slate-500 dark:text-slate-400"} />
                                                <span className={`font-semibold ${c.showAdvanced ? 'text-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-300'}`}>Advanced Configuration</span>
                                            </div>
                                            {c.showAdvanced ? <ChevronUp size={20} className="text-slate-500 dark:text-slate-400" /> : <ChevronDown size={20} className="text-slate-500 dark:text-slate-400" />}
                                        </button>

                                        {c.showAdvanced && (
                                            <div className="p-6 space-y-6 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/30">
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                    <div>
                                                        <label className="flex items-center space-x-2 text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                                            <HardDrive size={16} className="text-slate-500 dark:text-slate-400" />
                                                            <span>Memory Limit (MB)</span>
                                                        </label>
                                                        <input
                                                            type="number"
                                                            value={c.memory}
                                                            onChange={(e) => updateContainer(c.id, 'memory', e.target.value)}
                                                            placeholder="Base: 512"
                                                            className="w-full px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl focus:ring-1 focus:ring-brand-500 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500"
                                                        />
                                                    </div>

                                                    <div>
                                                        <label className="flex items-center space-x-2 text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                                            <Cpu size={16} className="text-slate-500 dark:text-slate-400" />
                                                            <span>CPU Limit (Cores)</span>
                                                        </label>
                                                        <input
                                                            type="number"
                                                            step="0.1"
                                                            value={c.cpu}
                                                            onChange={(e) => updateContainer(c.id, 'cpu', e.target.value)}
                                                            placeholder="Base: 1"
                                                            className="w-full px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl focus:ring-1 focus:ring-brand-500 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500"
                                                        />
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                    <div>
                                                        <label className="flex items-center space-x-2 text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                                            <Settings2 size={16} className="text-slate-500 dark:text-slate-400" />
                                                            <span>Restart Policy</span>
                                                        </label>
                                                        <select
                                                            value={c.restartPolicy}
                                                            onChange={(e) => updateContainer(c.id, 'restartPolicy', e.target.value)}
                                                            className="w-full px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl focus:ring-1 focus:ring-brand-500 text-slate-900 dark:text-white"
                                                        >
                                                            <option value="no">No (Default)</option>
                                                            <option value="always">Always</option>
                                                            <option value="unless-stopped">Unless Stopped</option>
                                                            <option value="on-failure">On Failure</option>
                                                        </select>
                                                    </div>

                                                    <div>
                                                        <label className="flex items-center space-x-2 text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                                            <Network size={16} className="text-slate-500 dark:text-slate-400" />
                                                            <span>Network Mode</span>
                                                        </label>
                                                        <select
                                                            value={c.networkMode}
                                                            onChange={(e) => updateContainer(c.id, 'networkMode', e.target.value)}
                                                            className="w-full px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl focus:ring-1 focus:ring-brand-500 text-slate-900 dark:text-white"
                                                        >
                                                            <option value="bridge">Bridge (Secure)</option>
                                                            <option value="none">None (Isolated)</option>
                                                            {availableNetworks.filter(n => !['bridge', 'host', 'none'].includes(n.Name)).map(net => (
                                                                <option key={net.Id} value={net.Name}>Custom: {net.Name}</option>
                                                            ))}
                                                        </select>
                                                    </div>

                                                    {c.networkMode !== 'bridge' && c.networkMode !== 'host' && c.networkMode !== 'none' && (
                                                        <div>
                                                            <label className="flex items-center space-x-2 text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                                                <Network size={16} className="text-slate-500 dark:text-slate-400" />
                                                                <span>IPv4 Address (Optional)</span>
                                                            </label>
                                                            <input
                                                                type="text"
                                                                value={c.ipv4Address || ''}
                                                                onChange={(e) => updateContainer(c.id, 'ipv4Address', e.target.value)}
                                                                placeholder="e.g. 172.18.0.22"
                                                                className="w-full px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl focus:ring-1 focus:ring-brand-500 text-slate-900 dark:text-white"
                                                            />
                                                            <p className="text-xs text-slate-500 mt-1">Leave empty to auto-assign from subnet.</p>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Volume Attachment */}
                                                <div className="pt-4 border-t border-slate-200 dark:border-slate-700/50 mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                                                    <div>
                                                        <label className="flex items-center space-x-2 text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                                            <HardDrive size={16} className="text-slate-500 dark:text-slate-400" />
                                                            <span>Attach Persistent Volume</span>
                                                        </label>
                                                        <select
                                                            value={c.volumeName || ''}
                                                            onChange={(e) => updateContainer(c.id, 'volumeName', e.target.value)}
                                                            className="w-full px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl focus:ring-1 focus:ring-brand-500 text-slate-900 dark:text-white"
                                                        >
                                                            <option value="">None (Ephemeral)</option>
                                                            {availableVolumes.map(v => (
                                                                <option key={v._id || v.name} value={v.name}>{v.name}</option>
                                                            ))}
                                                        </select>
                                                        <p className="text-xs text-slate-500 mt-1">Select a persistent disk to save data.</p>
                                                    </div>

                                                    {c.volumeName && (
                                                        <div>
                                                            <label className="flex items-center space-x-2 text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                                                <span>Container Mount Path</span>
                                                            </label>
                                                            <input
                                                                type="text"
                                                                value={c.volumeMountPath || ''}
                                                                onChange={(e) => updateContainer(c.id, 'volumeMountPath', e.target.value)}
                                                                placeholder="e.g. /data or /var/lib/mysql"
                                                                required={!!c.volumeName}
                                                                className="w-full px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl focus:ring-1 focus:ring-brand-500 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 font-mono text-sm"
                                                            />
                                                            <p className="text-xs text-slate-500 mt-1">Where the volume mounts inside the container.</p>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Environment Variables Section */}
                                                <div className="pt-4 border-t border-slate-200 dark:border-slate-700/50">
                                                    <label className="flex flex-col mb-4">
                                                        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Environment Variables</span>
                                                        <span className="text-xs text-slate-500">Add custom KEY=VALUE pairs injected on runtime.</span>
                                                    </label>

                                                    {getSuggestedEnvVars(c.image) && (
                                                        <div className="mb-4 p-4 bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/20 rounded-xl flex items-center justify-between shadow-sm">
                                                            <div className="flex items-center space-x-3 text-indigo-700 dark:text-indigo-400">
                                                                <Zap size={20} className="animate-pulse" />
                                                                <div>
                                                                    <p className="text-sm font-bold">Smart Configuration</p>
                                                                    <p className="text-xs text-indigo-600/80 dark:text-indigo-400/80 mt-0.5">Missing required configuration for {getSuggestedEnvVars(c.image).label}.</p>
                                                                </div>
                                                            </div>
                                                            <button
                                                                type="button"
                                                                onClick={() => injectEnvVars(c.id, getSuggestedEnvVars(c.image).vars)}
                                                                className="text-xs px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-400 transition-colors font-medium shadow-md hover:shadow-lg whitespace-nowrap"
                                                            >
                                                                Auto-Fill Variables
                                                            </button>
                                                        </div>
                                                    )}

                                                    <div className="space-y-3 mb-3">
                                                        {c.envVars.map((env, eIdx) => (
                                                            <div key={eIdx} className="flex flex-col space-y-2 sm:flex-row sm:space-y-0 sm:items-center sm:space-x-3">
                                                                <input
                                                                    type="text"
                                                                    placeholder="e.g. NODE_ENV"
                                                                    value={env.key}
                                                                    onChange={(e) => updateEnvVar(c.id, eIdx, 'key', e.target.value)}
                                                                    className="flex-1 px-4 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl focus:ring-1 focus:ring-brand-500 text-slate-900 dark:text-white font-mono text-sm"
                                                                />
                                                                <span className="text-slate-400 dark:text-slate-500 font-bold">=</span>

                                                                <div className="flex bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl overflow-hidden focus-within:ring-1 focus-within:ring-brand-500">
                                                                    <select
                                                                        value={env.type || 'raw'}
                                                                        onChange={(e) => updateEnvVar(c.id, eIdx, 'type', e.target.value)}
                                                                        className="bg-slate-100 dark:bg-slate-800 border-none px-3 py-2 text-sm text-slate-700 dark:text-slate-300 focus:ring-0 outline-none w-24 border-r dark:border-slate-700 font-medium"
                                                                    >
                                                                        <option value="raw">Raw</option>
                                                                        <option value="secret">Secret</option>
                                                                    </select>

                                                                    {(!env.type || env.type === 'raw') ? (
                                                                        <input
                                                                            type="text"
                                                                            placeholder="e.g. production"
                                                                            value={env.value}
                                                                            onChange={(e) => updateEnvVar(c.id, eIdx, 'value', e.target.value)}
                                                                            className="flex-1 px-3 py-2 bg-transparent border-none text-slate-900 dark:text-white font-mono text-sm focus:ring-0 outline-none w-full"
                                                                        />
                                                                    ) : (
                                                                        <select
                                                                            value={env.value}
                                                                            onChange={(e) => updateEnvVar(c.id, eIdx, 'value', e.target.value)}
                                                                            className="flex-1 px-3 py-2 bg-transparent border-none text-slate-900 dark:text-white font-mono text-sm focus:ring-0 outline-none w-full"
                                                                        >
                                                                            <option value="">-- Select Secret --</option>
                                                                            {availableSecrets.map(sec => (
                                                                                <option key={sec._id} value={sec.name}>{sec.name}</option>
                                                                            ))}
                                                                        </select>
                                                                    )}
                                                                </div>

                                                                <button
                                                                    type="button"
                                                                    onClick={() => removeEnvVar(c.id, eIdx)}
                                                                    className="p-2 text-slate-400 dark:text-slate-500 hover:text-rose-500 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-lg transition-colors"
                                                                >
                                                                    <Trash2 size={16} />
                                                                </button>
                                                            </div>
                                                        ))}
                                                    </div>

                                                    <button
                                                        type="button"
                                                        onClick={() => addEnvVar(c.id)}
                                                        className="text-sm font-medium text-brand-400 hover:text-brand-300 flex items-center space-x-1"
                                                    >
                                                        <Plus size={16} />
                                                        <span>Add Variable</span>
                                                    </button>
                                                </div>

                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Actions */}
                        <div className="flex flex-col sm:flex-row gap-4 pt-4 border-t border-slate-200 dark:border-slate-700/50">
                            <button
                                type="button"
                                onClick={handleAddContainer}
                                className="flex-1 flex justify-center items-center space-x-2 py-4 px-4 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-600 hover:border-brand-500 dark:hover:border-brand-500 hover:bg-brand-50 dark:hover:bg-brand-500/5 focus:outline-none text-brand-500 dark:text-brand-400 font-semibold transition-all"
                            >
                                <Plus size={20} />
                                <span>Add Another Container</span>
                            </button>

                            <button
                                type="submit"
                                disabled={loading || isExceedingLimits}
                                className={`flex-1 flex justify-center items-center space-x-2 py-4 px-4 rounded-xl shadow-lg text-sm font-bold text-white transition-all
                                    ${(loading || isExceedingLimits) ? 'bg-slate-600 cursor-not-allowed opacity-70' : 'bg-brand-500 hover:bg-brand-600 shadow-[0_0_20px_rgba(14,165,233,0.3)]'}
                                `}
                            >
                                {loading ? (
                                    <span className="flex items-center space-x-2">
                                        <span className="animate-spin w-5 h-5 border-2 border-white/20 border-t-white rounded-full"></span>
                                        <span>Deploying Stack...</span>
                                    </span>
                                ) : (
                                    <>
                                        <span>Deploy Full Stack</span>
                                        <Play size={18} />
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                </div>

            </div>
        </div>
    );
};

export default CreateContainer;
