import React from 'react';
import { Link } from 'react-router-dom';
import { Server, ArrowRight, ShieldCheck, Zap, Activity, Sun, Moon } from 'lucide-react';
import { useTheme } from '../components/ThemeContext';

const Welcome = () => {
    const { theme, toggleTheme } = useTheme();
    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white selection:bg-brand-500/30 transition-colors duration-200">
            {/* Navbar */}
            <nav className="border-b border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 backdrop-blur-md sticky top-0 z-50 transition-colors duration-200">
                <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-brand-500/10 rounded-xl flex items-center justify-center border border-brand-500/20 shadow-[0_0_15px_rgba(14,165,233,0.2)]">
                            <Server className="text-brand-400" size={24} />
                        </div>
                        <span className="text-xl font-bold tracking-wide">Docker Manager</span>
                    </div>
                    <div className="flex items-center space-x-6">
                        <button
                            onClick={toggleTheme}
                            className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                            title="Toggle Theme"
                        >
                            {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
                        </button>
                        <Link to="/login" className="text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors font-medium">Log in</Link>
                        <Link to="/register" className="bg-brand-500 hover:bg-brand-600 px-5 py-2.5 rounded-xl text-white font-medium transition-all shadow-lg shadow-brand-500/25 flex items-center space-x-2">
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

                <p className="text-xl text-slate-600 dark:text-slate-400 max-w-2xl mx-auto mb-12 leading-relaxed">
                    Manage, monitor, and scale your Docker environments from an intuitive, premium dashboard.
                    Perfect for developers who want power without the complexity.
                </p>

                <div className="flex items-center justify-center space-x-6">
                    <Link to="/register" className="bg-brand-500 hover:bg-brand-600 text-white px-8 py-4 rounded-2xl font-semibold transition-all shadow-[0_0_30px_rgba(14,165,233,0.3)] hover:shadow-[0_0_40px_rgba(14,165,233,0.5)] flex items-center space-x-2 text-lg">
                        <span>Start Deploying Now</span>
                        <ArrowRight size={20} />
                    </Link>
                    <a href="#features" className="px-8 py-4 rounded-2xl font-semibold bg-white dark:bg-slate-800 text-slate-900 dark:text-white hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors border border-slate-200 dark:border-slate-700 shadow-sm">
                        View Features
                    </a>
                </div>
            </div>

            {/* Features Grid */}
            <div id="features" className="max-w-7xl mx-auto px-6 py-24 border-t border-slate-200 dark:border-slate-800">
                <div className="text-center mb-16">
                    <h2 className="text-4xl font-extrabold tracking-tight mb-4">Everything you need to ship faster</h2>
                    <p className="text-xl text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
                        We've built a complete Platform as a Service (PaaS) right into your Docker engine.
                    </p>
                </div>

                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {/* Feature 1 */}
                    <div className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 p-8 rounded-3xl shadow-xl dark:shadow-none transition-all hover:-translate-y-1">
                        <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-500/10 rounded-xl flex items-center justify-center text-indigo-500 dark:text-indigo-400 mb-6 border border-indigo-100 dark:border-indigo-500/20">
                            <Zap size={24} />
                        </div>
                        <h3 className="text-xl font-bold mb-3 text-slate-900 dark:text-white">Git Deploy Pipelines</h3>
                        <p className="text-slate-600 dark:text-slate-400">Deploy directly from GitHub repositories. The PaaS engine clones your code, safely builds Dockerfiles in a restricted sandbox, and spins up your app in seconds.</p>
                    </div>

                    {/* Feature 2 */}
                    <div className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 p-8 rounded-3xl shadow-xl dark:shadow-none transition-all hover:-translate-y-1">
                        <div className="w-12 h-12 bg-emerald-50 dark:bg-emerald-500/10 rounded-xl flex items-center justify-center text-emerald-500 dark:text-emerald-400 mb-6 border border-emerald-100 dark:border-emerald-500/20">
                            <Activity size={24} />
                        </div>
                        <h3 className="text-xl font-bold mb-3 text-slate-900 dark:text-white">Auto-Routing & Traefik Domains</h3>
                        <p className="text-slate-600 dark:text-slate-400">Forget Nginx configs. Assign custom domains (e.g. `api.pablo.dev`) to any container via the UI. Our built-in Traefik Proxy reverse-routes traffic automatically.</p>
                    </div>

                    {/* Feature 3 */}
                    <div className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 p-8 rounded-3xl shadow-xl dark:shadow-none transition-all hover:-translate-y-1">
                        <div className="w-12 h-12 bg-pink-50 dark:bg-pink-500/10 rounded-xl flex items-center justify-center text-pink-500 dark:text-pink-400 mb-6 border border-pink-100 dark:border-pink-500/20">
                            <Server size={24} />
                        </div>
                        <h3 className="text-xl font-bold mb-3 text-slate-900 dark:text-white">Smart Stack Builder</h3>
                        <p className="text-slate-600 dark:text-slate-400">Deploy single instances or multi-tier apps (like WordPress + MySQL) simultaneously. Includes 1-click presets and auto-injected environment variables to link containers.</p>
                    </div>

                    {/* Feature 4 */}
                    <div className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 p-8 rounded-3xl shadow-xl dark:shadow-none transition-all hover:-translate-y-1">
                        <div className="w-12 h-12 bg-amber-50 dark:bg-amber-500/10 rounded-xl flex items-center justify-center text-amber-500 dark:text-amber-400 mb-6 border border-amber-100 dark:border-amber-500/20">
                            <ShieldCheck size={24} />
                        </div>
                        <h3 className="text-xl font-bold mb-3 text-slate-900 dark:text-white">Hardware Quotas & Billing</h3>
                        <p className="text-slate-600 dark:text-slate-400">Live monitoring of CPU, RAM, Disk Space, and Domain count limits based on your subscription tier. Prevents users from exhausting host machine resources.</p>
                    </div>

                    {/* Feature 5 */}
                    <div className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 p-8 rounded-3xl shadow-xl dark:shadow-none transition-all hover:-translate-y-1">
                        <div className="w-12 h-12 bg-blue-50 dark:bg-blue-500/10 rounded-xl flex items-center justify-center text-blue-500 dark:text-blue-400 mb-6 border border-blue-100 dark:border-blue-500/20">
                            <Server size={24} />
                        </div>
                        <h3 className="text-xl font-bold mb-3 text-slate-900 dark:text-white">Persistent Disks & Networks</h3>
                        <p className="text-slate-600 dark:text-slate-400">Manage isolated Docker volumes and bridge networks. Attach persistent storage so your databases never lose data when containers restart.</p>
                    </div>

                    {/* Feature 6 */}
                    <div className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 p-8 rounded-3xl shadow-xl dark:shadow-none transition-all hover:-translate-y-1">
                        <div className="w-12 h-12 bg-slate-100 dark:bg-slate-700/50 rounded-xl flex items-center justify-center text-slate-700 dark:text-slate-300 mb-6 border border-slate-200 dark:border-slate-600/50">
                            <Server size={24} />
                        </div>
                        <h3 className="text-xl font-bold mb-3 text-slate-900 dark:text-white">Live Terminals & Logs</h3>
                        <p className="text-slate-600 dark:text-slate-400">No SSH required. Access interactive Bash/Sh shells directly inside any container from the browser, or stream live stdout/stderr logs instantly.</p>
                    </div>
                </div>
            </div>

            {/* Plans Preview */}
            <div className="max-w-7xl mx-auto px-6 py-24 border-t border-slate-200 dark:border-slate-800">
                <div className="text-center mb-16">
                    <h2 className="text-4xl font-extrabold tracking-tight mb-4">Simple, transparent pricing</h2>
                    <p className="text-xl text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
                        Start for free, upgrade when your app scales to millions.
                    </p>
                </div>

                <div className="grid md:grid-cols-3 gap-8">
                    {/* Free Plan */}
                    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-8 rounded-3xl flex flex-col">
                        <h3 className="text-2xl font-bold mb-2">Hobby</h3>
                        <p className="text-sm text-slate-500 mb-6">Perfect for learning Docker and personal projects.</p>
                        <div className="text-4xl font-extrabold mb-6">$0<span className="text-lg text-slate-500 font-normal">/mo</span></div>
                        <ul className="space-y-4 mb-8 flex-1 text-slate-600 dark:text-slate-400">
                            <li className="flex items-center"><span className="text-emerald-500 mr-2">✓</span> Up to 2 Containers limit</li>
                            <li className="flex items-center"><span className="text-emerald-500 mr-2">✓</span> 1 GB RAM quota</li>
                            <li className="flex items-center"><span className="text-emerald-500 mr-2">✓</span> 1 CPU Core equivalent</li>
                            <li className="flex items-center"><span className="text-emerald-500 mr-2">✓</span> 1 GB Persistent Storage (1 Disk)</li>
                            <li className="flex items-center"><span className="text-red-500 mr-2">✕</span> No Custom Domains</li>
                            <li className="flex items-center"><span className="text-emerald-500 mr-2">✓</span> Community Support</li>
                        </ul>
                        <Link to="/register" className="w-full text-center bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-900 dark:text-white py-3 rounded-xl font-semibold transition-colors">Start Free</Link>
                    </div>

                    {/* Pro Plan */}
                    <div className="bg-gradient-to-br from-brand-500 to-indigo-600 text-white p-8 rounded-3xl flex flex-col shadow-2xl scale-105 z-10 border border-brand-400/30">
                        <div className="text-xs font-bold uppercase tracking-wider text-brand-200 mb-2">Most Popular</div>
                        <h3 className="text-2xl font-bold mb-2">Professional</h3>
                        <p className="text-sm text-brand-100 mb-6">For active developers needing more resources.</p>
                        <div className="text-4xl font-extrabold mb-6">$12<span className="text-lg text-brand-200 font-normal">/mo</span></div>
                        <ul className="space-y-4 mb-8 flex-1 text-white/90">
                            <li className="flex items-center"><span className="mr-2 text-emerald-300">✓</span> Up to 10 Containers limit</li>
                            <li className="flex items-center"><span className="mr-2 text-emerald-300">✓</span> 8 GB RAM quota</li>
                            <li className="flex items-center"><span className="mr-2 text-emerald-300">✓</span> 4 CPU Cores equivalent</li>
                            <li className="flex items-center"><span className="mr-2 text-emerald-300">✓</span> 10 GB Persistent Storage (5 Disks)</li>
                            <li className="flex items-center"><span className="mr-2 text-emerald-300">✓</span> 3 Custom Domains</li>
                            <li className="flex items-center"><span className="mr-2 text-emerald-300">✓</span> Priority Support</li>
                            <li className="flex items-center"><span className="mr-2 text-emerald-300">✓</span> Advanced Network Modes</li>
                        </ul>
                        <Link to="/register" className="w-full text-center bg-white text-brand-600 hover:bg-slate-50 py-3 rounded-xl font-semibold transition-colors shadow-lg">Upgrade Now</Link>
                    </div>

                    {/* Enterprise Plan */}
                    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-8 rounded-3xl flex flex-col">
                        <h3 className="text-2xl font-bold mb-2">Enterprise</h3>
                        <p className="text-sm text-slate-500 mb-6">Uncapped potential for production workloads.</p>
                        <div className="text-4xl font-extrabold mb-6">$45<span className="text-lg text-slate-500 font-normal">/mo</span></div>
                        <ul className="space-y-4 mb-8 flex-1 text-slate-600 dark:text-slate-400">
                            <li className="flex items-center"><span className="text-emerald-500 mr-2">✓</span> Up to 50 Containers limit</li>
                            <li className="flex items-center"><span className="text-emerald-500 mr-2">✓</span> 32 GB RAM quota</li>
                            <li className="flex items-center"><span className="text-emerald-500 mr-2">✓</span> 16 CPU Cores equivalent</li>
                            <li className="flex items-center"><span className="text-emerald-500 mr-2">✓</span> 100 GB Persistent Storage (20 Disks)</li>
                            <li className="flex items-center"><span className="text-emerald-500 mr-2">✓</span> Unlimited Custom Domains</li>
                            <li className="flex items-center"><span className="text-emerald-500 mr-2">✓</span> 24/7 Dedicated Support</li>
                            <li className="flex items-center"><span className="text-emerald-500 mr-2">✓</span> Custom Node Mapping</li>
                        </ul>
                        <Link to="/register" className="w-full text-center bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-900 dark:text-white py-3 rounded-xl font-semibold transition-colors">Contact Sales</Link>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Welcome;
