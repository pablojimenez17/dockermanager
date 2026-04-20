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
    // Array of container configs
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
        if (containers.length === 1) return; // Prevent deleting the last one
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

    // -------------------------------------

    // Smart Autofill: when user types a known image, suggest env vars
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
        // Match image against known presets (check image name without tag)
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
            // Format payload
            const payload = containers.map(c => {
                // Filter out empty EnvVars and format as ["KEY=VALUE"] or ["KEY={{SECRET:name}}"]
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

            // Since our backend logic was previously updated to handle "host" vs "bridge",
            // we will send the format as { stack: payload }
            await axios.post('/api/containers', { stack: payload });

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
        <div className="p-4 sm:p-8 pb-20 text-slate-900 dark:text-white max-w-5xl mx-auto">
            <div className="mb-10">
                <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-2">Deploy a Custom Stack</h1>
                <p className="text-slate-600 dark:text-slate-400 text-base sm:text-lg">Deploy single containers or orchestrate multi-container apps gracefully. For 1-click popular apps, check out the <a href="/app/marketplace" className="text-brand-500 hover:underline font-medium">App Marketplace</a>.</p>
            </div>

            <div className="w-full">
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
                                            onChange={(e) => handleImageChange(c.id, e.target.value)}
                                            placeholder="e.g., nginx:alpine"
                                            className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-brand-500 focus:outline-none text-slate-900 dark:text-white font-mono text-sm"
                                        />
                                        {/* Autofill hint */}
                                        {c.image && Object.keys(IMAGE_PRESETS).some(k => c.image.toLowerCase().includes(k)) && (
                                            <p className="text-xs text-brand-500 mt-1 flex items-center">
                                                <Zap size={12} className="mr-1" /> Smart autofill applied — env vars pre-filled for this image.
                                            </p>
                                        )}
                                    </div>
                                </div>

                                <div className="mb-6">
                                    <label className="flex items-center space-x-2 text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 relative group w-fit">
                                        <span>Port Binding (Optional)</span>
                                        <Info size={16} className="text-slate-400 cursor-help" />
                                        {/* Port Binding Tooltip */}
                                        <div className="absolute bottom-full left-0 mb-3 w-[280px] sm:w-[350px] opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 pointer-events-none">
                                            <div className="bg-slate-900 border border-slate-700 shadow-2xl rounded-2xl p-4 text-left relative overflow-hidden">
                                                <p className="text-sm font-bold text-white mb-2">Host vs Container Ports</p>
                                                <p className="text-xs text-slate-300 mb-2 leading-relaxed">
                                                    The format is <code className="text-brand-400 font-bold bg-slate-800 px-1 rounded">HOST_PORT:CONTAINER_PORT</code> (e.g. 8080:80).
                                                </p>
                                                <ul className="text-xs text-slate-400 space-y-2 list-disc pl-4 mb-3">
                                                    <li><strong className="text-brand-400">Host Port:</strong> The port opened on your server/machine to the outside network.</li>
                                                    <li><strong className="text-slate-300">Container Port:</strong> The port the software listens to <i>internally</i> inside its isolated container.</li>
                                                </ul>
                                                <p className="text-[11px] text-amber-300 bg-amber-500/10 p-2 rounded border border-amber-500/20 leading-relaxed text-left">
                                                    ⚠️ <strong>Traefik user?</strong> Ignore this field completely! Traefik handles routing without exposing raw ports to the host machine.
                                                </p>
                                                <div className="absolute -bottom-2 left-6 w-4 h-4 bg-slate-900 border-b border-r border-slate-700 transform rotate-45"></div>
                                            </div>
                                        </div>
                                    </label>
                                    <input
                                        type="text"
                                        value={c.portBinding}
                                        onChange={(e) => updateContainer(c.id, 'portBinding', e.target.value)}
                                        placeholder="e.g., 8080:80"
                                        disabled={c.exposeDomain}
                                        className={`w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-brand-500 focus:outline-none text-slate-900 dark:text-white font-mono text-sm ${c.exposeDomain ? 'opacity-50 cursor-not-allowed' : ''}`}
                                    />
                                    {c.exposeDomain && (
                                        <p className="mt-2 text-xs text-amber-600 dark:text-amber-400 flex items-center animate-fade-in">
                                            <AlertCircle size={14} className="mr-1" />
                                            Disabled because Traefik handles secure routing internally.
                                        </p>
                                    )}
                                </div>

                                {/* Domain Exposer */}
                                <div className="mb-6 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-2xl p-5">
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="flex items-center space-x-3 text-purple-700 dark:text-purple-300">
                                            <Globe size={20} />
                                            <div className="flex items-center space-x-2 relative group">
                                                <h5 className="font-bold text-sm">Expose to Internet (Traefik Router)</h5>
                                                <Info size={16} className="text-purple-400 cursor-help" />

                                                {/* Tooltip for Newbies */}
                                                <div className="absolute bottom-full left-0 mb-3 w-[320px] sm:w-[400px] opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 pointer-events-none">
                                                    <div className="bg-slate-900 border border-slate-700 shadow-2xl rounded-2xl p-4 text-left relative overflow-hidden">
                                                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-500 to-brand-500"></div>
                                                        <p className="text-sm font-bold text-white mb-2 flex items-center">
                                                            <Globe size={16} className="text-purple-400 mr-2" />
                                                            How does this work?
                                                        </p>
                                                        <p className="text-xs text-slate-300 mb-2 leading-relaxed">
                                                            Instead of opening gross numbers like <code className="bg-slate-800 text-purple-300 px-1 py-0.5 rounded">http://IP:8080</code> to the whole internet, Traefik acts as a smart bouncer.
                                                        </p>
                                                        <ul className="text-xs text-slate-400 space-y-2 list-disc pl-4 mb-2">
                                                            <li><strong className="text-slate-300">Domain:</strong> Type what people put in the browser (e.g., <code className="text-green-400">api.myweb.com</code>).</li>
                                                            <li><strong className="text-slate-300">Internal Port:</strong> Type the port the app uses <i>inside</i> its container (e.g., React uses <code className="text-brand-400">80</code>, Node uses <code className="text-brand-400">3000</code>).</li>
                                                        </ul>
                                                        <div className="bg-purple-900/30 border border-purple-500/30 p-3 rounded-lg mt-3">
                                                            <p className="text-[11px] text-purple-200 mb-2 border-b border-purple-700/50 pb-2">
                                                                <strong>🌐 Network & Port Advice:</strong>
                                                            </p>
                                                            <ul className="text-[11px] text-purple-300 space-y-2">
                                                                <li><strong className="text-white">Network Mode:</strong> Leave it on <code className="bg-purple-800/50 px-1 rounded">Bridge</code> for simple internet exposure. Use <code className="bg-purple-800/50 px-1 rounded">Custom Network</code> only if you manually created a private network to link this app to a Database.</li>
                                                                <li><strong className="text-white">Port Binding:</strong> We highly recommend leaving the global <i className="text-purple-200">Port Binding (Optional)</i> field empty above. Traefik doesn't need ports mapped to your machine to secure your domain.</li>
                                                            </ul>
                                                        </div>

                                                        {/* Arrow pointing down */}
                                                        <div className="absolute -bottom-2 left-6 w-4 h-4 bg-slate-900 border-b border-r border-slate-700 transform rotate-45"></div>
                                                    </div>
                                                </div>

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
                                                    placeholder="e.g., api.orbit.dev"
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

                                                {/* Network Mode */}
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
                                                        <option value="bridge">🛡️ Private Protected Network (VPC)</option>
                                                        <option value="none">🔒 No Network (Total Isolation)</option>
                                                        {availableNetworks.filter(n => !['bridge', 'host', 'none'].includes(n.Name)).map(net => (
                                                            <option key={net.Id} value={net.Name}>{net.Name}</option>
                                                        ))}
                                                    </select>
                                                    <p className="text-xs text-slate-500 mt-1">VPC isolates you from other users. "No Network" is an air-gapped container with no connectivity.</p>
                                                </div>

                                                {/* Internet Access Toggle */}
                                                {c.networkMode !== 'none' && (
                                                    <div className={`col-span-1 md:col-span-2 flex items-center justify-between p-3.5 rounded-xl border transition-all ${c.enableInternet
                                                            ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-700/50'
                                                            : 'bg-slate-50 dark:bg-slate-900/50 border-slate-300 dark:border-slate-600'
                                                        }`}>
                                                        <div className="flex items-center space-x-3">
                                                            {c.enableInternet
                                                                ? <Globe size={18} className="text-amber-500 shrink-0" />
                                                                : <Lock size={18} className="text-slate-400 shrink-0" />
                                                            }
                                                            <div>
                                                                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                                                                    {c.enableInternet ? 'Internet Access Enabled' : 'Private Container'}
                                                                </p>
                                                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                                                    {c.enableInternet
                                                                        ? '⚠️ By enabling internet access you accept that your container may initiate external connections. Use at your own responsibility.'
                                                                        : 'Your container is fully isolated. It can only communicate with your other services.'
                                                                    }
                                                                </p>
                                                            </div>
                                                        </div>
                                                        <button
                                                            type="button"
                                                            onClick={() => updateContainer(c.id, 'enableInternet', !c.enableInternet)}
                                                            className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none ${c.enableInternet ? 'bg-amber-500' : 'bg-slate-300 dark:bg-slate-600'
                                                                }`}
                                                        >
                                                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${c.enableInternet ? 'translate-x-6' : 'translate-x-1'
                                                                }`} />
                                                        </button>
                                                    </div>
                                                )}

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

                    {/* Shared Responsibility Notice */}
                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed pt-2">
                        <span className="font-semibold text-slate-600 dark:text-slate-300">⚖️ Shared responsibility:</span>{' '}
                        Orbit guarantees network isolation and infrastructure security. Application-level security within the container (image updates, credentials, internal configuration) remains the responsibility of the user.
                    </p>

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
    );
};

export default CreateContainer;
