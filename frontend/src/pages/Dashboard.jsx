import React, { useEffect, useState } from 'react';
import { Activity, Server, Cpu, Navigation, ArrowRight } from 'lucide-react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { io } from 'socket.io-client';
import { PieChart, Pie, Cell, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';
import { useOrg } from '../context/OrgContext';

const Dashboard = () => {
    const { activeOrg } = useOrg();
    const [stats, setStats] = useState({ total: 0, running: 0, stopped: 0 });
    const [metrics, setMetrics] = useState({ cpu: 0, mem: 0, memLimit: 0 });
    const [loading, setLoading] = useState(true);
    const name = localStorage.getItem('name') || 'User';

    useEffect(() => {
        const fetchSummary = async () => {
            try {
                const res = await axios.get('https://localhost:5000/api/containers');
                const containers = res.data;
                const running = containers.filter(c => c.state === 'running');

                setStats({
                    total: containers.length,
                    running: running.length,
                    stopped: containers.length - running.length
                });

                // Fetch metrics for running containers
                let totalCpu = 0;
                let totalMem = 0;
                let totalMemLimit = 0;

                if (running.length > 0) {
                    const metricsPromises = running.map(c =>
                        axios.get(`https://localhost:5000/api/stats/${c._id}`).catch(() => null)
                    );
                    const metricsResults = await Promise.all(metricsPromises);
                    metricsResults.forEach(m => {
                        if (m && m.data) {
                            totalCpu += parseFloat(m.data.cpuPercent) || 0;
                            totalMem += parseFloat(m.data.memUsage) || 0;
                            totalMemLimit += parseFloat(m.data.memLimit) || 0;
                        }
                    });
                }

                setMetrics({ cpu: totalCpu.toFixed(1), mem: totalMem, memLimit: totalMemLimit });

            } catch (err) {
                console.error('Failed to parse dashboard stats', err);
            } finally {
                setLoading(false);
            }
        };

        fetchSummary();
        const interval = setInterval(fetchSummary, 30000);

        // Setup Real-time Docker events socket
        const socket = io('https://localhost:5000');
        socket.on('container:status_change', () => {
            fetchSummary(); // Just refetch numbers when any container changes state globally
        });

        return () => {
            clearInterval(interval);
            socket.disconnect();
        };
    }, [activeOrg]);

    return (
        <div className="p-4 md:p-8 pb-20 text-slate-900 dark:text-white transition-colors duration-200">
            <div className="mb-10">
                <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-2">Welcome back, {name}</h1>
                <p className="text-slate-600 dark:text-slate-300 text-base sm:text-lg">Here's what's happening with your deployments today.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
                <div className="bg-white/50 dark:bg-slate-900/40 backdrop-blur-xl border border-white/80 dark:border-white/10 p-6 rounded-[2rem] shadow-[0_8px_32px_rgba(0,0,0,0.08)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.2)] ring-1 ring-slate-900/5 dark:ring-white/5 relative overflow-hidden group hover:-translate-y-1 hover:border-brand-400 dark:hover:border-slate-500 hover:shadow-2xl transition-all duration-300">
                    <div className="absolute top-0 right-0 p-6 opacity-20 text-slate-400 group-hover:scale-110 transition-transform duration-500">
                        <Server size={64} />
                    </div>
                    <div className="relative z-10">
                        <h3 className="text-slate-700 dark:text-slate-300 font-medium mb-1 drop-shadow-sm">Total Containers</h3>
                        <div className="text-5xl font-bold flex items-center space-x-3 text-slate-900 dark:text-white drop-shadow-md">
                            <span>{loading ? '-' : stats.total}</span>
                        </div>
                    </div>
                </div>

                <div className="bg-emerald-50/60 dark:bg-emerald-900/20 backdrop-blur-xl border border-emerald-200/80 dark:border-emerald-500/10 p-6 rounded-[2rem] shadow-[0_8px_32px_rgba(16,185,129,0.08)] dark:shadow-[0_8px_32px_rgba(16,185,129,0.1)] ring-1 ring-emerald-900/5 dark:ring-emerald-500/5 relative overflow-hidden group hover:-translate-y-1 hover:border-emerald-400 dark:hover:border-emerald-500 hover:shadow-2xl transition-all duration-300">
                    <div className="absolute top-0 right-0 p-6 opacity-20 text-emerald-500 dark:text-emerald-400 group-hover:scale-110 transition-transform duration-500">
                        <Activity size={64} />
                    </div>
                    <div className="relative z-10">
                        <h3 className="text-emerald-800 dark:text-emerald-300 font-medium mb-1 drop-shadow-sm">Running</h3>
                        <div className="text-5xl font-bold text-emerald-600 dark:text-emerald-400 flex items-center space-x-3 drop-shadow-md">
                            <span>{loading ? '-' : stats.running}</span>
                        </div>
                    </div>
                </div>

                <div className="bg-rose-50/60 dark:bg-rose-900/20 backdrop-blur-xl border border-rose-200/80 dark:border-rose-500/10 p-6 rounded-[2rem] shadow-[0_8px_32px_rgba(244,63,94,0.08)] dark:shadow-[0_8px_32px_rgba(244,63,94,0.1)] ring-1 ring-rose-900/5 dark:ring-rose-500/5 relative overflow-hidden group hover:-translate-y-1 hover:border-rose-400 dark:hover:border-rose-500 hover:shadow-2xl transition-all duration-300">
                    <div className="absolute top-0 right-0 p-6 opacity-20 text-rose-500 dark:text-rose-400 group-hover:scale-110 transition-transform duration-500">
                        <Cpu size={64} />
                    </div>
                    <div className="relative z-10">
                        <h3 className="text-rose-800 dark:text-rose-300 font-medium mb-1 drop-shadow-sm">Stopped / Error</h3>
                        <div className="text-5xl font-bold text-rose-600 dark:text-rose-400 flex items-center space-x-3 drop-shadow-md">
                            <span>{loading ? '-' : stats.stopped}</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="bg-white/50 dark:bg-slate-900/40 backdrop-blur-xl border border-white/80 dark:border-white/10 ring-1 ring-slate-900/5 dark:ring-white/5 rounded-[2rem] p-6 md:p-8 shadow-[0_8px_32px_rgba(0,0,0,0.08)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.2)]">
                <div className="flex items-center space-x-4 mb-6">
                    <div className="p-3 bg-brand-500 text-white rounded-[1rem] shadow-lg shadow-brand-500/30 hidden sm:block">
                        <Navigation size={24} />
                    </div>
                    <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white drop-shadow-sm">Quick Actions</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Link to="/app/create" className="p-6 bg-white/60 dark:bg-white/5 border border-white dark:border-white/10 ring-1 ring-slate-900/5 dark:ring-0 rounded-3xl hover:bg-white/90 dark:hover:bg-white/10 hover:-translate-y-1 hover:shadow-xl hover:shadow-brand-500/20 hover:border-brand-300 dark:hover:border-brand-500 transition-all duration-300 group flex items-center justify-between">
                        <div>
                            <h4 className="font-semibold text-lg text-slate-900 dark:text-white mb-1 group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">Start a New Container</h4>
                            <p className="text-sm text-slate-700 dark:text-slate-300">Launch a predefined template or custom image</p>
                        </div>
                        <div className="w-12 h-12 rounded-full bg-white/80 dark:bg-slate-800 border border-white/50 dark:border-slate-600 flex items-center justify-center group-hover:bg-brand-500 group-hover:text-white group-hover:border-brand-500 transition-all text-slate-500 dark:text-slate-400 drop-shadow-md">
                            <span className="text-2xl">+</span>
                        </div>
                    </Link>

                    <Link to="/app/containers" className="p-6 bg-white/60 dark:bg-white/5 border border-white dark:border-white/10 ring-1 ring-slate-900/5 dark:ring-0 rounded-3xl hover:bg-white/90 dark:hover:bg-white/10 hover:-translate-y-1 hover:shadow-xl hover:shadow-brand-500/20 hover:border-brand-300 dark:hover:border-brand-500 transition-all duration-300 group flex items-center justify-between">
                        <div>
                            <h4 className="font-semibold text-lg text-slate-900 dark:text-white mb-1 group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">Manage Instances</h4>
                            <p className="text-sm text-slate-700 dark:text-slate-300">View logs, stop, or remove your deployment</p>
                        </div>
                        <div className="w-12 h-12 rounded-full bg-white/80 dark:bg-slate-800 border border-white/50 dark:border-slate-600 flex items-center justify-center group-hover:bg-brand-500 group-hover:text-white group-hover:border-brand-500 transition-all text-slate-500 dark:text-slate-400 drop-shadow-md">
                            <ArrowRight size={22} />
                        </div>
                    </Link>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-8">
                {/* Visual Overview Donut Chart */}
                <div className="bg-white/50 dark:bg-slate-900/40 backdrop-blur-xl border border-white/80 dark:border-white/10 ring-1 ring-slate-900/5 dark:ring-white/5 rounded-[2rem] p-6 md:p-8 shadow-[0_8px_32px_rgba(0,0,0,0.08)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.2)] col-span-1 flex flex-col items-center group hover:border-brand-300 dark:hover:border-slate-500 transition-colors duration-300">
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-6 w-full text-left drop-shadow-sm">Fleet Status</h2>
                    <div className="w-full h-48 relative">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={[
                                        { name: 'Running', value: stats.running, fill: '#34d399' },
                                        { name: 'Stopped/Error', value: stats.stopped, fill: '#fb7185' }
                                    ].filter(item => item.value > 0).length > 0
                                        ? [
                                            { name: 'Running', value: stats.running, fill: '#34d399' },
                                            { name: 'Stopped/Error', value: stats.stopped, fill: '#fb7185' }
                                        ].filter(item => item.value > 0)
                                        : [{ name: 'No Containers', value: 1, fill: '#94a3b8' }]} // Default state
                                    innerRadius={60}
                                    outerRadius={80}
                                    paddingAngle={0}
                                    dataKey="value"
                                    stroke="none"
                                >
                                    {
                                        [
                                            { name: 'Running', value: stats.running, fill: '#34d399' },
                                            { name: 'Stopped/Error', value: stats.stopped, fill: '#fb7185' }
                                        ].filter(item => item.value > 0).length > 0
                                            ? [
                                                { name: 'Running', value: stats.running, fill: '#34d399' },
                                                { name: 'Stopped/Error', value: stats.stopped, fill: '#fb7185' }
                                            ].filter(item => item.value > 0).map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.fill} />
                                            ))
                                            : <Cell fill="#94a3b8" />
                                    }
                                </Pie>
                                <RechartsTooltip
                                    wrapperStyle={{ zIndex: 100 }}
                                    contentStyle={{ borderRadius: '16px', border: '1px solid rgba(255,255,255,0.4)', background: 'rgba(255, 255, 255, 0.8)', backdropFilter: 'blur(12px)', color: '#0f172a', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)' }}
                                    itemStyle={{ color: '#0f172a', fontWeight: 'bold' }}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                        <div className="absolute inset-0 flex items-center justify-center flex-col pointer-events-none z-0">
                            <span className="text-4xl font-extrabold text-slate-900 dark:text-white drop-shadow-sm group-hover:scale-105 transition-transform">{stats.total}</span>
                            <span className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-widest font-bold mt-1">Total</span>
                        </div>
                    </div>
                </div>

                {/* Resource Sliders */}
                <div className="bg-white/50 dark:bg-slate-900/40 backdrop-blur-xl border border-white/80 dark:border-white/10 ring-1 ring-slate-900/5 dark:ring-white/5 rounded-[2rem] p-6 md:p-8 shadow-[0_8px_32px_rgba(0,0,0,0.08)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.2)] col-span-1 lg:col-span-2 group hover:border-indigo-300 dark:hover:border-slate-500 transition-colors duration-300">
                    <div className="flex items-center space-x-4 mb-6">
                        <div className="p-3 bg-indigo-500 text-white rounded-[1rem] shadow-lg shadow-indigo-500/30 hidden sm:block">
                            <Activity size={24} />
                        </div>
                        <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white drop-shadow-sm">Active Resource Usage</h2>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="bg-white/60 dark:bg-white/5 border border-white dark:border-white/10 ring-1 ring-slate-900/5 dark:ring-0 p-6 rounded-[1.5rem] hover:bg-white/90 dark:hover:bg-white/10 hover:shadow-xl hover:-translate-y-1 hover:border-indigo-400 hover:shadow-indigo-500/10 transition-all duration-300">
                            <div className="flex justify-between items-center mb-4">
                                <h4 className="font-semibold text-slate-800 dark:text-slate-200 flex items-center"><Cpu className="mr-2 text-indigo-500 dark:text-indigo-400" size={18} /> CPU Usage</h4>
                                <span className="text-lg font-bold text-indigo-600 dark:text-indigo-400 transition-transform scale-110">{metrics.cpu}%</span>
                            </div>
                            <div className="w-full bg-slate-200/50 dark:bg-slate-800/80 rounded-full h-4 mb-2 overflow-hidden shadow-inner backdrop-blur-sm border border-slate-900/5 dark:border-white/5">
                                <div className="bg-gradient-to-r from-indigo-500 to-purple-500 h-4 rounded-full transition-all duration-1000 shadow-[0_0_10px_rgba(99,102,241,0.5)]" style={{ width: `${Math.min(metrics.cpu, 100)}%` }}></div>
                            </div>
                            <p className="text-xs text-slate-500 dark:text-slate-400 text-right font-medium">Aggregated over instances</p>
                        </div>

                        <div className="bg-white/60 dark:bg-white/5 border border-white dark:border-white/10 ring-1 ring-slate-900/5 dark:ring-0 p-6 rounded-[1.5rem] hover:bg-white/90 dark:hover:bg-white/10 hover:shadow-xl hover:-translate-y-1 hover:border-emerald-400 hover:shadow-emerald-500/10 transition-all duration-300">
                            <div className="flex justify-between items-center mb-4">
                                <h4 className="font-semibold text-slate-800 dark:text-slate-200 flex items-center"><Server className="mr-2 text-emerald-500 dark:text-emerald-400" size={18} /> Memory Usage</h4>
                                <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400 transition-transform scale-110">
                                    {metrics.mem > 0 ? (metrics.mem / 1024 / 1024).toFixed(0) : 0} MB
                                </span>
                            </div>
                            <div className="w-full bg-slate-200/50 dark:bg-slate-800/80 rounded-full h-4 mb-2 overflow-hidden shadow-inner backdrop-blur-sm border border-slate-900/5 dark:border-white/5">
                                <div className="bg-gradient-to-r from-emerald-400 to-teal-500 h-4 rounded-full transition-all duration-1000 shadow-[0_0_10px_rgba(52,211,153,0.5)]" style={{ width: `${metrics.memLimit > 0 ? Math.min((metrics.mem / metrics.memLimit) * 100, 100) : 0}%` }}></div>
                            </div>
                            <p className="text-xs text-slate-500 dark:text-slate-400 text-right font-medium">Of system limits</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
