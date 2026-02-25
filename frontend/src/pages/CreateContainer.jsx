import React, { useState } from 'react';
import { Box, Code, Database, Globe, Play, Server, AlertCircle } from 'lucide-react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const predefinedImages = [
    { id: 'ubuntu', name: 'Ubuntu Latest', image: 'ubuntu:latest', icon: <Server size={24} />, desc: 'Base Ubuntu OS image for raw Linux setup' },
    { id: 'node', name: 'Node.js', image: 'node:18-alpine', icon: <Code size={24} />, desc: 'Lightweight Node 18 environment' },
    { id: 'nginx', name: 'Nginx', image: 'nginx:alpine', icon: <Globe size={24} />, desc: 'High-performance web server & reverse proxy' },
    { id: 'wp-mysql', name: 'WordPress', image: 'wordpress:latest', icon: <Box size={24} />, desc: 'WordPress CMS (Requires DB separate linking)' },
    { id: 'mongo', name: 'MongoDB', image: 'mongo:latest', icon: <Database size={24} />, desc: 'NoSQL Document Database' },
];

const CreateContainer = () => {
    const [name, setName] = useState('');
    const [image, setImage] = useState('');
    const [portBinding, setPortBinding] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const navigate = useNavigate();

    const handleSelectPredefined = (img) => {
        setImage(img.image);
        if (!name) {
            setName(`${img.id}-${Math.floor(Math.random() * 1000)}`);
        }
        // Set some default ports if helpful
        if (img.id === 'nginx') setPortBinding('8080:80');
        if (img.id === 'mongo') setPortBinding('27017:27017');
        if (img.id === 'wp-mysql') setPortBinding('8000:80');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const token = localStorage.getItem('token');
            // Format ports: array of "host:container"
            const ports = portBinding ? [portBinding] : [];

            await axios.post('http://localhost:5000/api/containers', {
                name,
                image,
                ports,
                env: []
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            navigate('/app/containers');
        } catch (err) {
            setError(err.response?.data?.message || 'Error creating container');
            setLoading(false);
        }
    };

    return (
        <div className="p-8 pb-20 text-white max-w-5xl mx-auto">
            <div className="mb-10">
                <h1 className="text-4xl font-extrabold tracking-tight mb-2">Deploy a Container</h1>
                <p className="text-slate-400 text-lg">Pick a preset or pull any image straight from Docker Hub.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">

                {/* Left Side: Form */}
                <div className="bg-slate-800 border border-slate-700 rounded-3xl p-8 shadow-xl h-fit">
                    <h3 className="text-xl font-bold mb-6 flex items-center space-x-2">
                        <Box className="text-brand-400" />
                        <span>Configuration</span>
                    </h3>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        {error && (
                            <div className="bg-red-500/10 border border-red-500/50 text-red-500 text-sm py-4 px-4 rounded-xl flex items-start space-x-3">
                                <AlertCircle size={20} className="shrink-0 mt-0.5" />
                                <span>{error}</span>
                            </div>
                        )}

                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">Container Name</label>
                            <input
                                type="text"
                                required
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="my-awesome-app"
                                className="w-full px-4 py-3 bg-slate-900 border border-slate-600 rounded-xl focus:ring-2 focus:ring-brand-500 focus:outline-none text-white transition-shadow"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">Docker Image</label>
                            <input
                                type="text"
                                required
                                value={image}
                                onChange={(e) => setImage(e.target.value)}
                                placeholder="e.g., redis:alpine"
                                className="w-full px-4 py-3 bg-slate-900 border border-slate-600 rounded-xl focus:ring-2 focus:ring-brand-500 focus:outline-none text-white transition-shadow font-mono text-sm"
                            />
                            <p className="text-xs text-slate-500 mt-2">Any image available on Docker Hub works here.</p>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">Port Binding (Optional)</label>
                            <input
                                type="text"
                                value={portBinding}
                                onChange={(e) => setPortBinding(e.target.value)}
                                placeholder="Host_Port:Container_Port (e.g., 8080:80)"
                                className="w-full px-4 py-3 bg-slate-900 border border-slate-600 rounded-xl focus:ring-2 focus:ring-brand-500 focus:outline-none text-white transition-shadow font-mono text-sm"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className={`w-full flex justify-center items-center space-x-2 py-4 px-4 rounded-xl shadow-lg text-sm font-bold text-white transition-all
                ${loading ? 'bg-slate-600 cursor-not-allowed' : 'bg-brand-500 hover:bg-brand-600 shadow-[0_0_20px_rgba(14,165,233,0.3)] hover:shadow-[0_0_30px_rgba(14,165,233,0.5)]'}
              `}
                        >
                            {loading ? (
                                <span className="flex items-center space-x-2">
                                    <span className="animate-spin w-5 h-5 border-2 border-white/20 border-t-white rounded-full"></span>
                                    <span>Deploying...</span>
                                </span>
                            ) : (
                                <>
                                    <span>Create Container</span>
                                    <Play size={18} />
                                </>
                            )}
                        </button>
                    </form>
                </div>

                {/* Right Side: Presets */}
                <div>
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
                  ${image === img.image
                                        ? 'bg-brand-500/10 border-brand-500 shadow-[0_0_15px_rgba(14,165,233,0.15)]'
                                        : 'bg-slate-800 border-slate-700 hover:border-slate-500'}
                `}
                            >
                                <div className={`p-3 rounded-xl ${image === img.image ? 'bg-brand-500 text-white' : 'bg-slate-700 text-slate-300'}`}>
                                    {img.icon}
                                </div>
                                <div>
                                    <h4 className="font-bold text-white text-lg">{img.name}</h4>
                                    <p className="text-sm font-mono text-brand-300 my-1">{img.image}</p>
                                    <p className="text-sm text-slate-400 leading-snug">{img.desc}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

            </div>
        </div>
    );
};

export default CreateContainer;
