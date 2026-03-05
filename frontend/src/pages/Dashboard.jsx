import React, { useEffect, useState } from 'react';
import { Activity, Server, Cpu, Navigation, ArrowRight } from 'lucide-react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { io } from 'socket.io-client';

const Dashboard = () => {
    const [stats, setStats] = useState({ total: 0, running: 0, stopped: 0 });
    const [loading, setLoading] = useState(true);
    const name = localStorage.getItem('name') || 'User';

    useEffect(() => {
        const fetchSummary = async () => {
            try {
                const token = localStorage.getItem('token');
                const res = await axios.get('http://localhost:5000/api/containers', {
                    headers: { Authorization: `Bearer ${token}` }
                });
                const containers = res.data;
                const running = containers.filter(c => c.state === 'running').length;
                setStats({
                    total: containers.length,
                    running,
                    stopped: containers.length - running
                });
            } catch (err) {
                console.error('Failed to parse dashboard stats', err);
            } finally {
                setLoading(false);
            }
        };

        fetchSummary();
        const interval = setInterval(fetchSummary, 30000);

        // Setup Real-time Docker events socket
        const socket = io('http://localhost:5000');
        socket.on('container:status_change', () => {
            fetchSummary(); // Just refetch numbers when any container changes state globally
        });

        return () => {
            clearInterval(interval);
            socket.disconnect();
        };
    }, []);

    return (
        <div className="p-8 pb-20 text-slate-900 dark:text-white transition-colors duration-200">
            <div className="mb-10">
                <h1 className="text-4xl font-extrabold tracking-tight mb-2">Welcome back, {name}</h1>
                <p className="text-slate-500 dark:text-slate-400 text-lg">Here's what's happening with your deployments today.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
                <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-6 rounded-3xl shadow-lg relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:scale-110 transition-transform duration-500">
                        <Server size={64} />
                    </div>
                    <div className="relative z-10">
                        <h3 className="text-slate-500 dark:text-slate-400 font-medium mb-1">Total Containers</h3>
                        <div className="text-5xl font-bold flex items-center space-x-3 text-slate-900 dark:text-white">
                            <span>{loading ? '-' : stats.total}</span>
                        </div>
                    </div>
                </div>

                <div className="bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-500/30 p-6 rounded-3xl shadow-lg relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-6 opacity-10 text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform duration-500">
                        <Activity size={64} />
                    </div>
                    <div className="relative z-10">
                        <h3 className="text-emerald-600 dark:text-emerald-400 font-medium mb-1">Running</h3>
                        <div className="text-5xl font-bold text-emerald-700 dark:text-emerald-300 flex items-center space-x-3">
                            <span>{loading ? '-' : stats.running}</span>
                        </div>
                    </div>
                </div>

                <div className="bg-rose-50 dark:bg-rose-900/30 border border-rose-200 dark:border-rose-500/30 p-6 rounded-3xl shadow-lg relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-6 opacity-10 text-rose-600 dark:text-rose-400 group-hover:scale-110 transition-transform duration-500">
                        <Cpu size={64} />
                    </div>
                    <div className="relative z-10">
                        <h3 className="text-rose-600 dark:text-rose-400 font-medium mb-1">Stopped / Error</h3>
                        <div className="text-5xl font-bold text-rose-700 dark:text-rose-300 flex items-center space-x-3">
                            <span>{loading ? '-' : stats.stopped}</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-3xl p-8 shadow-xl">
                <div className="flex items-center space-x-4 mb-6">
                    <div className="p-3 bg-brand-500/10 rounded-xl text-brand-600 dark:text-brand-400">
                        <Navigation size={24} />
                    </div>
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Quick Actions</h2>
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                    <Link to="/app/create" className="p-6 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl hover:border-brand-500/50 hover:bg-brand-50 dark:hover:bg-brand-500/5 transition-all group flex items-center justify-between">
                        <div>
                            <h4 className="font-semibold text-lg text-slate-900 dark:text-white mb-1 group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">Start a New Container</h4>
                            <p className="text-sm text-slate-500 dark:text-slate-400">Launch a predefined template or custom image</p>
                        </div>
                        <div className="w-10 h-10 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center group-hover:bg-brand-500/10 group-hover:text-brand-600 dark:group-hover:text-brand-400 group-hover:border-brand-500/30 transition-colors text-slate-400 dark:text-slate-500">
                            <span className="text-xl">+</span>
                        </div>
                    </Link>

                    <Link to="/app/containers" className="p-6 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl hover:border-brand-500/50 hover:bg-brand-50 dark:hover:bg-brand-500/5 transition-all group flex items-center justify-between">
                        <div>
                            <h4 className="font-semibold text-lg text-slate-900 dark:text-white mb-1 group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">Manage Instances</h4>
                            <p className="text-sm text-slate-500 dark:text-slate-400">View logs, stop, or remove your deployment</p>
                        </div>
                        <div className="w-10 h-10 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center group-hover:bg-brand-500/10 group-hover:text-brand-600 dark:group-hover:text-brand-400 group-hover:border-brand-500/30 transition-colors text-slate-400 dark:text-slate-500">
                            <ArrowRight size={20} />
                        </div>
                    </Link>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
