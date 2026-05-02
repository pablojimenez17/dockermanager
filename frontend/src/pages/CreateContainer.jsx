import React, { useState, useEffect } from 'react';
import { Database, Globe, Lock, Play, Server, AlertCircle, Settings2, Cpu, HardDrive, Network, ChevronDown, ChevronUp, Plus, Trash2, Layers, Zap, ShieldAlert, Info } from 'lucide-react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useOrg } from '../context/OrgContext';
import { resolveLimits } from '../utils/planLimits';

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
    const { activeOrg } = useOrg();
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
                setLimits(resolveLimits(meRes.data));
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

    const handleAddContainer = () => setContainers([...containers, getEmptyContainer()]);
    const handleRemoveContainer = (id) => {
        if (containers.length > 1) setContainers(containers.filter(c => c.id !== id));
    };

    const updateContainer = (id, field, value) => setContainers(containers.map(c => c.id === id ? { ...c, [field]: value } : c));
    const toggleAdvanced = (id) => setContainers(containers.map(c => c.id === id ? { ...c, showAdvanced: !c.showAdvanced } : c));

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
    const addEnvVar = (containerId) => setContainers(containers.map(c => c.id === containerId ? { ...c, envVars: [...c.envVars, { key: '', value: '', type: 'raw' }] } : c));
    const removeEnvVar = (containerId, envIndex) => setContainers(containers.map(c => {
        if (c.id === containerId) {
            const newEnvVars = c.envVars.filter((_, idx) => idx !== envIndex);
            if (newEnvVars.length === 0) newEnvVars.push({ key: '', value: '', type: 'raw' });
            return { ...c, envVars: newEnvVars };
        }
        return c;
    }));

    const IMAGE_PRESETS = {
        'mysql': [{ key: 'MYSQL_ROOT_PASSWORD', value: '', type: 'secret' }, { key: 'MYSQL_DATABASE', value: 'mydb', type: 'raw' }],
        'postgres': [{ key: 'POSTGRES_USER', value: 'admin', type: 'raw' }, { key: 'POSTGRES_PASSWORD', value: '', type: 'secret' }],
        'mongo': [{ key: 'MONGO_INITDB_ROOT_USERNAME', value: 'admin', type: 'raw' }, { key: 'MONGO_INITDB_ROOT_PASSWORD', value: '', type: 'secret' }],
        'redis': [{ key: 'REDIS_PASSWORD', value: '', type: 'secret' }],
        'node': [{ key: 'NODE_ENV', value: 'production', type: 'raw' }, { key: 'PORT', value: '3000', type: 'raw' }],
    };

    const handleImageChange = (containerId, imageValue) => {
        updateContainer(containerId, 'image', imageValue);
        const imageName = imageValue.split(':')[0].split('/').pop().toLowerCase();
        const preset = Object.entries(IMAGE_PRESETS).find(([key]) => imageName.startsWith(key));
        if (preset && preset[1].length > 0) {
            setContainers(prev => prev.map(c => c.id === containerId ? { ...c, envVars: preset[1] } : c));
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
            setError(err.response?.data?.error || err.response?.data?.message || 'Deploy failed');
            setLoading(false);
        }
    };

    const reqContainers = containers.length;
    const reqRam = containers.reduce((acc, curr) => acc + (parseInt(curr.memory) || 512), 0);
    const reqCpu = containers.reduce((acc, curr) => acc + (parseFloat(curr.cpu) || 1), 0);

    const overLimits = (currentContainerCount + reqContainers > limits.maxContainers) ||
        (currentRamMb + reqRam > limits.maxRamMb) || (currentCpu + reqCpu > limits.maxCpuCores);

    return (
        <div className="text-gray-900 dark:text-slate-100 max-w-5xl">
            <div className="mb-8">
                <h1 className="text-2xl font-bold mb-1">Create Instance</h1>
                <p className="text-sm text-gray-500 dark:text-slate-400">Configure and deploy new container instances to your cluster.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                {error && (
                    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm p-4 rounded flex items-start space-x-2">
                        <AlertCircle size={18} className="shrink-0 mt-0.5" />
                        <span>{error}</span>
                    </div>
                )}

                <div className="panel p-5">
                    <h3 className="text-base font-semibold mb-4 flex items-center">
                        <ShieldAlert size={16} className="mr-2 text-gray-400" /> Resource Allocation - <span className="ml-1 font-normal text-gray-500">{activeOrg ? activeOrg.name : 'Personal Workspace'}</span>
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
                        <div>
                            <div className="flex justify-between mb-1"><span className="text-gray-500">Containers</span><span className={currentContainerCount > limits.maxContainers ? 'text-red-500' : ''}>{currentContainerCount}/{limits.maxContainers}</span></div>
                            <div className="w-full bg-gray-200 dark:bg-slate-700 h-1.5 rounded"><div className="bg-brand-500 h-1.5 rounded" style={{width: `${Math.min((currentContainerCount/limits.maxContainers)*100, 100)}%`}}></div></div>
                        </div>
                        <div>
                            <div className="flex justify-between mb-1"><span className="text-gray-500">Memory</span><span className={currentRamMb > limits.maxRamMb ? 'text-red-500' : ''}>{currentRamMb}/{limits.maxRamMb} MB</span></div>
                            <div className="w-full bg-gray-200 dark:bg-slate-700 h-1.5 rounded"><div className="bg-brand-500 h-1.5 rounded" style={{width: `${Math.min((currentRamMb/limits.maxRamMb)*100, 100)}%`}}></div></div>
                        </div>
                        <div>
                            <div className="flex justify-between mb-1"><span className="text-gray-500">CPU</span><span className={currentCpu > limits.maxCpuCores ? 'text-red-500' : ''}>{currentCpu}/{limits.maxCpuCores} vCPU</span></div>
                            <div className="w-full bg-gray-200 dark:bg-slate-700 h-1.5 rounded"><div className="bg-brand-500 h-1.5 rounded" style={{width: `${Math.min((currentCpu/limits.maxCpuCores)*100, 100)}%`}}></div></div>
                        </div>
                    </div>
                    {overLimits && <p className="text-xs text-red-500 mt-4">Limits exceeded by current configuration.</p>}
                </div>

                <div className="space-y-6">
                    {containers.map((c, index) => (
                        <div key={c.id} className="panel overflow-hidden">
                            <div className="px-5 py-4 border-b border-gray-200 dark:border-slate-700 bg-gray-50/50 dark:bg-slate-800/50 flex justify-between items-center">
                                <h3 className="font-semibold text-gray-900 dark:text-white">Container {index + 1}</h3>
                                {containers.length > 1 && (
                                    <button type="button" onClick={() => handleRemoveContainer(c.id)} className="text-gray-400 hover:text-red-500 transition-colors">
                                        <Trash2 size={16} />
                                    </button>
                                )}
                            </div>

                            <div className="p-5 space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Container Name *</label>
                                        <input type="text" required value={c.name} onChange={(e) => updateContainer(c.id, 'name', e.target.value)} placeholder="app-frontend" className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-900 focus:ring-1 focus:ring-brand-500 outline-none text-sm" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Docker Image *</label>
                                        <input type="text" required value={c.image} onChange={(e) => handleImageChange(c.id, e.target.value)} placeholder="nginx:latest" className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-900 focus:ring-1 focus:ring-brand-500 outline-none text-sm font-mono" />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Port Binding (Optional)</label>
                                    <input type="text" value={c.portBinding} onChange={(e) => updateContainer(c.id, 'portBinding', e.target.value)} placeholder="8080:80" disabled={c.exposeDomain} className={`w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-900 focus:ring-1 focus:ring-brand-500 outline-none text-sm font-mono ${c.exposeDomain ? 'opacity-50' : ''}`} />
                                    <p className="text-xs text-gray-500 mt-1">Format: HOST:CONTAINER</p>
                                </div>

                                <div className="border border-gray-200 dark:border-slate-700 rounded p-4 bg-gray-50/50 dark:bg-slate-800/30">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <h4 className="text-sm font-medium text-gray-900 dark:text-white flex items-center">
                                                <Globe size={16} className="mr-2 text-brand-500" /> Expose to Internet
                                                <div className="relative group/tooltip ml-2 flex items-center">
                                                    <Info size={14} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 cursor-help" />
                                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover/tooltip:block bg-slate-800 text-white text-[11px] p-2.5 rounded w-56 text-center z-[100] font-medium shadow-sm leading-relaxed">
                                                        Permite acceso desde fuera de tu red aislando el puerto y generando certificado HTTPS automático a través del Proxy Inverso.
                                                    </div>
                                                </div>
                                            </h4>
                                            <p className="text-xs text-gray-500 mt-1">Route external traffic via Traefik proxy.</p>
                                        </div>
                                        <label className="relative inline-flex items-center cursor-pointer">
                                            <input type="checkbox" checked={c.exposeDomain} onChange={(e) => updateContainer(c.id, 'exposeDomain', e.target.checked)} className="sr-only peer" />
                                            <div className="w-9 h-5 bg-gray-300 peer-focus:outline-none rounded-full peer dark:bg-slate-600 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-brand-600"></div>
                                        </label>
                                    </div>

                                    {c.exposeDomain && (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 pt-4 border-t border-gray-200 dark:border-slate-700">
                                            <div>
                                                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Custom Domain</label>
                                                <input type="text" value={c.domain || ''} onChange={(e) => updateContainer(c.id, 'domain', e.target.value)} placeholder="app.example.com" className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-900 text-sm font-mono" />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Target Internal Port</label>
                                                <input type="number" value={c.domainPort || ''} onChange={(e) => updateContainer(c.id, 'domainPort', e.target.value)} placeholder="80" className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-900 text-sm font-mono" />
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="border border-gray-200 dark:border-slate-700 rounded overflow-hidden">
                                    <button type="button" onClick={() => toggleAdvanced(c.id)} className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 dark:bg-slate-800/50 dark:hover:bg-slate-800 transition-colors">
                                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center">
                                            <Settings2 size={16} className="mr-2" /> Advanced Configuration
                                        </span>
                                        {c.showAdvanced ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                    </button>

                                    {c.showAdvanced && (
                                        <div className="p-5 space-y-6 border-t border-gray-200 dark:border-slate-700">
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Memory Limit (MB)</label>
                                                    <input type="number" value={c.memory} onChange={(e) => updateContainer(c.id, 'memory', e.target.value)} className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-900 text-sm font-mono" />
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">CPU Limit (Cores)</label>
                                                    <input type="number" step="0.1" value={c.cpu} onChange={(e) => updateContainer(c.id, 'cpu', e.target.value)} className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-900 text-sm font-mono" />
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                <div>
                                                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center">
                                                        Network Mode
                                                        <div className="relative group/tooltip ml-2 flex items-center">
                                                            <Info size={14} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 cursor-help" />
                                                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover/tooltip:block bg-slate-800 text-white text-[11px] p-2.5 rounded w-56 text-center z-[100] font-medium shadow-sm leading-relaxed">
                                                                La VPC te aísla de otros usuarios protegiendo el tráfico interno. "Isolated" significa que el contenedor no tendrá ningún acceso a red.
                                                            </div>
                                                        </div>
                                                    </label>
                                                    <select value={c.networkMode} onChange={(e) => updateContainer(c.id, 'networkMode', e.target.value)} className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-900 text-sm">
                                                        <option value="bridge">Bridge (Default VPC)</option>
                                                        <option value="none">None (Isolated)</option>
                                                        {availableNetworks.filter(n => !['bridge', 'host', 'none'].includes(n.Name)).map(net => (
                                                            <option key={net.Id} value={net.Name}>{net.Name}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Restart Policy</label>
                                                    <select value={c.restartPolicy} onChange={(e) => updateContainer(c.id, 'restartPolicy', e.target.value)} className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-900 text-sm">
                                                        <option value="no">No</option>
                                                        <option value="always">Always</option>
                                                        <option value="unless-stopped">Unless Stopped</option>
                                                        <option value="on-failure">On Failure</option>
                                                    </select>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Mount Volume</label>
                                                    <select value={c.volumeName || ''} onChange={(e) => updateContainer(c.id, 'volumeName', e.target.value)} className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-900 text-sm">
                                                        <option value="">None</option>
                                                        {availableVolumes.map(v => <option key={v._id || v.name} value={v.name}>{v.name}</option>)}
                                                    </select>
                                                </div>
                                                {c.volumeName && (
                                                    <div>
                                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Container Mount Path</label>
                                                        <input type="text" value={c.volumeMountPath || ''} onChange={(e) => updateContainer(c.id, 'volumeMountPath', e.target.value)} placeholder="/data" className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-900 text-sm font-mono" />
                                                    </div>
                                                )}
                                            </div>

                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Environment Variables</label>
                                                <div className="space-y-2">
                                                    {c.envVars.map((env, eIdx) => (
                                                        <div key={eIdx} className="flex space-x-2">
                                                            <input type="text" placeholder="KEY" value={env.key} onChange={(e) => updateEnvVar(c.id, eIdx, 'key', e.target.value)} className="w-1/3 px-3 py-1.5 border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-900 text-sm font-mono" />
                                                            <select value={env.type} onChange={(e) => updateEnvVar(c.id, eIdx, 'type', e.target.value)} className="w-24 px-2 border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-900 text-xs">
                                                                <option value="raw">Raw</option>
                                                                <option value="secret">Secret</option>
                                                            </select>
                                                            {env.type === 'secret' ? (
                                                                <select value={env.value} onChange={(e) => updateEnvVar(c.id, eIdx, 'value', e.target.value)} className="flex-1 px-3 py-1.5 border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-900 text-sm font-mono">
                                                                    <option value="">Select Secret</option>
                                                                    {availableSecrets.map(sec => <option key={sec._id} value={sec.name}>{sec.name}</option>)}
                                                                </select>
                                                            ) : (
                                                                <input type="text" placeholder="VALUE" value={env.value} onChange={(e) => updateEnvVar(c.id, eIdx, 'value', e.target.value)} className="flex-1 px-3 py-1.5 border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-900 text-sm font-mono" />
                                                            )}
                                                            <button type="button" onClick={() => removeEnvVar(c.id, eIdx)} className="p-1.5 text-gray-400 hover:text-red-500 rounded"><Trash2 size={16} /></button>
                                                        </div>
                                                    ))}
                                                </div>
                                                <button type="button" onClick={() => addEnvVar(c.id)} className="mt-2 text-sm text-brand-600 hover:text-brand-700 flex items-center"><Plus size={14} className="mr-1" /> Add Variable</button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="flex items-center space-x-4 pt-4">
                    <button type="button" onClick={handleAddContainer} className="btn-secondary flex items-center">
                        <Plus size={16} className="mr-2" /> Add Container
                    </button>
                    <div className="flex-1"></div>
                    <button type="submit" disabled={loading || overLimits} className="btn-primary w-40 flex justify-center">
                        {loading ? <span className="animate-spin w-4 h-4 border-2 border-white/20 border-t-white rounded-full"></span> : 'Deploy'}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default CreateContainer;
