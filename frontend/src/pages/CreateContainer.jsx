import React, { useState } from 'react';
import { Box, Code, Database, Globe, Play, Server, AlertCircle, Settings2, Cpu, HardDrive, Network, ChevronDown, ChevronUp, Plus, Trash2, Layers } from 'lucide-react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const predefinedImages = [
    { id: 'custom', name: 'Custom Stack', image: 'custom', icon: <Layers size={24} />, desc: 'Build your own multi-container architecture from scratch' },
    { id: 'ubuntu', name: 'Ubuntu Latest', image: 'ubuntu:latest', icon: <Server size={24} />, desc: 'Base Ubuntu OS image for raw Linux setup' },
    { id: 'node', name: 'Node.js', image: 'node:18-alpine', icon: <Code size={24} />, desc: 'Lightweight Node 18 environment' },
    { id: 'nginx', name: 'Nginx', image: 'nginx:alpine', icon: <Globe size={24} />, desc: 'High-performance web server & reverse proxy' },
    { id: 'wp-mysql', name: 'WordPress + MySQL', image: 'wordpress:latest', icon: <Box size={24} />, desc: 'Full CMS Stack with automatically linked Database' },
];

const getEmptyContainer = () => ({
    id: crypto.randomUUID(),
    name: '',
    image: '',
    portBinding: '',
    memory: '512',
    cpu: '1',
    restartPolicy: 'no',
    networkMode: 'bridge',
    envVars: [{ key: '', value: '' }],
    showAdvanced: false
});

const CreateContainer = () => {
    // Array of container configs
    const [containers, setContainers] = useState([getEmptyContainer()]);
    const [activePreset, setActivePreset] = useState('custom');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const navigate = useNavigate();

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
                return { ...c, envVars: [...c.envVars, { key: '', value: '' }] };
            }
            return c;
        }));
    };

    const removeEnvVar = (containerId, envIndex) => {
        setContainers(containers.map(c => {
            if (c.id === containerId) {
                const newEnvVars = c.envVars.filter((_, idx) => idx !== envIndex);
                return { ...c, envVars: newEnvVars };
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
                // Filter out empty EnvVars and format as ["KEY=VALUE"]
                const validEnvVars = c.envVars
                    .filter(env => env.key.trim() !== '')
                    .map(env => `${env.key.trim()}=${env.value.trim()}`);

                return {
                    name: c.name,
                    image: c.image,
                    ports: c.portBinding ? [c.portBinding] : [],
                    env: validEnvVars,
                    memory: c.memory,
                    cpu: c.cpu,
                    restartPolicy: c.restartPolicy,
                    networkMode: c.networkMode
                };
            });

            // Since our backend logic was previously updated to handle "host" vs "bridge",
            // we will send the format as { stack: payload }
            await axios.post('http://localhost:5000/api/containers', { stack: payload }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            navigate('/app/containers');
        } catch (err) {
            setError(err.response?.data?.message || 'Error deploying stack');
            setLoading(false);
        }
    };

    return (
        <div className="p-8 pb-20 text-white max-w-7xl mx-auto">
            <div className="mb-10">
                <h1 className="text-4xl font-extrabold tracking-tight mb-2">Deploy a Stack</h1>
                <p className="text-slate-400 text-lg">Deploy single containers or orchestrate multi-container apps gracefully.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">

                {/* Left Side: Presets (Moved to left for natural flow) */}
                <div className="lg:col-span-4 space-y-4">
                    <h3 className="text-xl font-bold mb-6 flex items-center space-x-2">
                        <Server className="text-purple-400" />
                        <span>Quick Presets</span>
                    </h3>

                    <div className="grid gap-4">
                        {predefinedImages.map(img => (
                            <div
                                key={img.id}
                                onClick={() => handleSelectPredefined(img)}
                                className={`p-5 rounded-2xl border cursor-pointer transition-all flex items-start space-x-4
                                    ${activePreset === img.id
                                        ? 'bg-brand-500/10 border-brand-500 shadow-[0_0_15px_rgba(14,165,233,0.15)]'
                                        : 'bg-slate-800 border-slate-700 hover:border-slate-500'}
                                `}
                            >
                                <div className={`p-3 rounded-xl shrink-0 ${activePreset === img.id ? 'bg-brand-500 text-white' : 'bg-slate-700 text-slate-300'}`}>
                                    {img.icon}
                                </div>
                                <div>
                                    <h4 className="font-bold text-white text-lg">{img.name}</h4>
                                    {img.image !== 'custom' && <p className="text-sm font-mono text-brand-300 my-1">{img.image}</p>}
                                    <p className="text-sm text-slate-400 leading-snug">{img.desc}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Right Side: Stack Builder */}
                <div className="lg:col-span-8">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-xl font-bold flex items-center space-x-2">
                            <Layers className="text-brand-400" />
                            <span>Stack Builder</span>
                        </h3>
                        <div className="text-sm text-slate-400 bg-slate-800 px-4 py-2 rounded-xl border border-slate-700">
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

                        <div className="space-y-6">
                            {containers.map((c, index) => (
                                <div key={c.id} className="bg-slate-800 border border-slate-700 rounded-3xl p-8 shadow-xl relative animate-fade-in">
                                    {/* Sub-header for Container index */}
                                    <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-700/50">
                                        <div className="flex items-center space-x-3">
                                            <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center font-bold text-slate-300">
                                                {index + 1}
                                            </div>
                                            <h4 className="text-lg font-bold text-white">Container Configuration</h4>
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
                                            <label className="block text-sm font-medium text-slate-300 mb-2">Container Name</label>
                                            <input
                                                type="text"
                                                required
                                                value={c.name}
                                                onChange={(e) => updateContainer(c.id, 'name', e.target.value)}
                                                placeholder="e.g., frontend-app"
                                                className="w-full px-4 py-3 bg-slate-900 border border-slate-600 rounded-xl focus:ring-2 focus:ring-brand-500 focus:outline-none text-white transition-shadow"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-slate-300 mb-2">Docker Image</label>
                                            <input
                                                type="text"
                                                required
                                                value={c.image}
                                                onChange={(e) => updateContainer(c.id, 'image', e.target.value)}
                                                placeholder="e.g., nginx:alpine"
                                                className="w-full px-4 py-3 bg-slate-900 border border-slate-600 rounded-xl focus:ring-2 focus:ring-brand-500 focus:outline-none text-white font-mono text-sm"
                                            />
                                        </div>
                                    </div>

                                    <div className="mb-6">
                                        <label className="block text-sm font-medium text-slate-300 mb-2">Port Binding (Optional)</label>
                                        <input
                                            type="text"
                                            value={c.portBinding}
                                            onChange={(e) => updateContainer(c.id, 'portBinding', e.target.value)}
                                            placeholder="Host_Port:Container_Port (e.g., 8080:80)"
                                            className="w-full px-4 py-3 bg-slate-900 border border-slate-600 rounded-xl focus:ring-2 focus:ring-brand-500 focus:outline-none text-white font-mono text-sm"
                                        />
                                    </div>

                                    {/* Advanced Options Accordion for this specific container */}
                                    <div className="border border-slate-700 bg-slate-800/50 rounded-2xl overflow-hidden transition-all duration-300">
                                        <button
                                            type="button"
                                            onClick={() => toggleAdvanced(c.id)}
                                            className="w-full flex items-center justify-between p-4 bg-slate-800 hover:bg-slate-700/50 transition-colors"
                                        >
                                            <div className="flex items-center space-x-2">
                                                <Settings2 size={18} className={c.showAdvanced ? "text-brand-400" : "text-slate-400"} />
                                                <span className={`font-semibold ${c.showAdvanced ? 'text-white' : 'text-slate-300'}`}>Advanced Configuration</span>
                                            </div>
                                            {c.showAdvanced ? <ChevronUp size={20} className="text-slate-400" /> : <ChevronDown size={20} className="text-slate-400" />}
                                        </button>

                                        {c.showAdvanced && (
                                            <div className="p-6 space-y-6 border-t border-slate-700 bg-slate-900/30">
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                    <div>
                                                        <label className="flex items-center space-x-2 text-sm font-medium text-slate-300 mb-2">
                                                            <HardDrive size={16} className="text-slate-400" />
                                                            <span>Memory Limit (MB)</span>
                                                        </label>
                                                        <input
                                                            type="number"
                                                            value={c.memory}
                                                            onChange={(e) => updateContainer(c.id, 'memory', e.target.value)}
                                                            placeholder="Base: 512"
                                                            className="w-full px-4 py-2.5 bg-slate-900 border border-slate-600 rounded-xl focus:ring-1 focus:ring-brand-500 text-white placeholder-slate-500"
                                                        />
                                                    </div>

                                                    <div>
                                                        <label className="flex items-center space-x-2 text-sm font-medium text-slate-300 mb-2">
                                                            <Cpu size={16} className="text-slate-400" />
                                                            <span>CPU Limit (Cores)</span>
                                                        </label>
                                                        <input
                                                            type="number"
                                                            step="0.1"
                                                            value={c.cpu}
                                                            onChange={(e) => updateContainer(c.id, 'cpu', e.target.value)}
                                                            placeholder="Base: 1"
                                                            className="w-full px-4 py-2.5 bg-slate-900 border border-slate-600 rounded-xl focus:ring-1 focus:ring-brand-500 text-white placeholder-slate-500"
                                                        />
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                    <div>
                                                        <label className="flex items-center space-x-2 text-sm font-medium text-slate-300 mb-2">
                                                            <Settings2 size={16} className="text-slate-400" />
                                                            <span>Restart Policy</span>
                                                        </label>
                                                        <select
                                                            value={c.restartPolicy}
                                                            onChange={(e) => updateContainer(c.id, 'restartPolicy', e.target.value)}
                                                            className="w-full px-4 py-2.5 bg-slate-900 border border-slate-600 rounded-xl focus:ring-1 focus:ring-brand-500 text-white"
                                                        >
                                                            <option value="no">No (Default)</option>
                                                            <option value="always">Always</option>
                                                            <option value="unless-stopped">Unless Stopped</option>
                                                            <option value="on-failure">On Failure</option>
                                                        </select>
                                                    </div>

                                                    <div>
                                                        <label className="flex items-center space-x-2 text-sm font-medium text-slate-300 mb-2">
                                                            <Network size={16} className="text-slate-400" />
                                                            <span>Network Mode</span>
                                                        </label>
                                                        <select
                                                            value={c.networkMode}
                                                            onChange={(e) => updateContainer(c.id, 'networkMode', e.target.value)}
                                                            className="w-full px-4 py-2.5 bg-slate-900 border border-slate-600 rounded-xl focus:ring-1 focus:ring-brand-500 text-white"
                                                        >
                                                            <option value="bridge">Bridge (Secure)</option>
                                                            <option value="none">None (Isolated)</option>
                                                        </select>
                                                    </div>
                                                </div>

                                                {/* Environment Variables Section */}
                                                <div className="pt-4 border-t border-slate-700/50">
                                                    <label className="flex flex-col mb-4">
                                                        <span className="text-sm font-medium text-slate-300">Environment Variables</span>
                                                        <span className="text-xs text-slate-500">Add custom KEY=VALUE pairs injected on runtime.</span>
                                                    </label>

                                                    <div className="space-y-3 mb-3">
                                                        {c.envVars.map((env, eIdx) => (
                                                            <div key={eIdx} className="flex items-center space-x-3">
                                                                <input
                                                                    type="text"
                                                                    placeholder="e.g. NODE_ENV"
                                                                    value={env.key}
                                                                    onChange={(e) => updateEnvVar(c.id, eIdx, 'key', e.target.value)}
                                                                    className="flex-1 px-4 py-2 bg-slate-900 border border-slate-600 rounded-xl focus:ring-1 focus:ring-brand-500 text-white font-mono text-sm"
                                                                />
                                                                <span className="text-slate-500 font-bold">=</span>
                                                                <input
                                                                    type="text"
                                                                    placeholder="e.g. production"
                                                                    value={env.value}
                                                                    onChange={(e) => updateEnvVar(c.id, eIdx, 'value', e.target.value)}
                                                                    className="flex-1 px-4 py-2 bg-slate-900 border border-slate-600 rounded-xl focus:ring-1 focus:ring-brand-500 text-white font-mono text-sm"
                                                                />
                                                                <button
                                                                    type="button"
                                                                    onClick={() => removeEnvVar(c.id, eIdx)}
                                                                    className="p-2 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
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
                        <div className="flex flex-col sm:flex-row gap-4 pt-4 border-t border-slate-700/50">
                            <button
                                type="button"
                                onClick={handleAddContainer}
                                className="flex-1 flex justify-center items-center space-x-2 py-4 px-4 rounded-xl border-2 border-dashed border-slate-600 hover:border-brand-500 hover:bg-brand-500/5 focus:outline-none text-brand-400 font-semibold transition-all"
                            >
                                <Plus size={20} />
                                <span>Add Another Container</span>
                            </button>

                            <button
                                type="submit"
                                disabled={loading}
                                className={`flex-1 flex justify-center items-center space-x-2 py-4 px-4 rounded-xl shadow-lg text-sm font-bold text-white transition-all
                                    ${loading ? 'bg-slate-600 cursor-not-allowed' : 'bg-brand-500 hover:bg-brand-600 shadow-[0_0_20px_rgba(14,165,233,0.3)]'}
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
