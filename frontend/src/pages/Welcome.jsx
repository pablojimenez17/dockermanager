import React from 'react';
import { Link } from 'react-router-dom';
import { Server, ArrowRight, ShieldCheck, Zap, Activity } from 'lucide-react';

const Welcome = () => {
    return (
        <div className="min-h-screen bg-slate-900 text-white selection:bg-brand-500/30">
            {/* Navbar */}
            <nav className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-md sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-brand-500/10 rounded-xl flex items-center justify-center border border-brand-500/20 shadow-[0_0_15px_rgba(14,165,233,0.2)]">
                            <Server className="text-brand-400" size={24} />
                        </div>
                        <span className="text-xl font-bold tracking-wide">Docker Manager</span>
                    </div>
                    <div className="flex items-center space-x-6">
                        <Link to="/login" className="text-slate-300 hover:text-white transition-colors font-medium">Log in</Link>
                        <Link to="/register" className="bg-brand-500 hover:bg-brand-600 px-5 py-2.5 rounded-xl font-medium transition-all shadow-lg shadow-brand-500/25 flex items-center space-x-2">
                            <span>Get Started</span>
                            <ArrowRight size={18} />
                        </Link>
                    </div>
                </div>
            </nav>

            {/* Hero Section */}
            <div className="max-w-7xl mx-auto px-6 pt-32 pb-24 text-center">
                <div className="inline-flex items-center space-x-2 bg-brand-500/10 border border-brand-500/20 rounded-full px-4 py-1.5 text-brand-400 text-sm font-medium mb-8">
                    <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-brand-500"></span>
                    </span>
                    <span>v1.0 is now live</span>
                </div>

                <h1 className="text-6xl md:text-7xl font-extrabold tracking-tight mb-8">
                    Deploy Containers <br />
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-400 to-indigo-400">
                        Without the Friction
                    </span>
                </h1>

                <p className="text-xl text-slate-400 max-w-2xl mx-auto mb-12 leading-relaxed">
                    Manage, monitor, and scale your Docker environments from an intuitive, premium dashboard.
                    Perfect for developers who want power without the complexity.
                </p>

                <div className="flex items-center justify-center space-x-6">
                    <Link to="/register" className="bg-brand-500 hover:bg-brand-600 px-8 py-4 rounded-2xl font-semibold transition-all shadow-[0_0_30px_rgba(14,165,233,0.3)] hover:shadow-[0_0_40px_rgba(14,165,233,0.5)] flex items-center space-x-2 text-lg">
                        <span>Start Deploying Now</span>
                        <ArrowRight size={20} />
                    </Link>
                    <a href="#features" className="px-8 py-4 rounded-2xl font-semibold bg-slate-800 hover:bg-slate-700 transition-colors border border-slate-700">
                        View Features
                    </a>
                </div>
            </div>

            {/* Features Grid */}
            <div id="features" className="max-w-7xl mx-auto px-6 py-24 border-t border-slate-800">
                <div className="grid md:grid-cols-3 gap-8">
                    <div className="bg-slate-800/50 border border-slate-700 p-8 rounded-3xl hover:border-slate-500 transition-colors">
                        <div className="w-12 h-12 bg-indigo-500/10 rounded-xl flex items-center justify-center text-indigo-400 mb-6">
                            <Zap size={24} />
                        </div>
                        <h3 className="text-xl font-bold mb-3">Instant Creation</h3>
                        <p className="text-slate-400">Launch standard images or custom Docker Hub templates in seconds. Configure ports and variables easily.</p>
                    </div>

                    <div className="bg-slate-800/50 border border-slate-700 p-8 rounded-3xl hover:border-slate-500 transition-colors">
                        <div className="w-12 h-12 bg-emerald-500/10 rounded-xl flex items-center justify-center text-emerald-400 mb-6">
                            <Activity size={24} />
                        </div>
                        <h3 className="text-xl font-bold mb-3">Live Monitoring</h3>
                        <p className="text-slate-400">Keep an eye on CPU, Memory, and application logs in real-time right from your dashboard.</p>
                    </div>

                    <div className="bg-slate-800/50 border border-slate-700 p-8 rounded-3xl hover:border-slate-500 transition-colors">
                        <div className="w-12 h-12 bg-purple-500/10 rounded-xl flex items-center justify-center text-purple-400 mb-6">
                            <ShieldCheck size={24} />
                        </div>
                        <h3 className="text-xl font-bold mb-3">Secure & Private</h3>
                        <p className="text-slate-400">Built with standard authentication practices to ensure your containers remain solely under your control.</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Welcome;
