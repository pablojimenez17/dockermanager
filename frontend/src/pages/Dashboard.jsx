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
                const res = await axios.get('/api/containers');
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
                        axios.get(`/api/stats/${c._id}`).catch(() => null)
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

        const socket = io('');
        socket.on('container:status_change', () => {
            fetchSummary();
        });

        return () => {
            clearInterval(interval);
            socket.disconnect();
        };
    }, [activeOrg]);

    return (
        <div className="p-4 md:p-8 pb-20 text-slate-200">
            <div className="mb-14 reveal">
                <h1 className="text-3xl sm:text-5xl font-display font-bold tracking-tighter mb-3 uppercase text-white drop-shadow-md">Telemetry <span className="text-brand-500">Overview</span></h1>
                <p className="text-slate-400 text-base sm:text-lg uppercase tracking-widest font-semibold">Welcome back, {name} // System Status Online</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-12 reveal" style={{ animationDelay: '0.1s' }}>
                <div className="panel-glass p-8 rounded-sm relative overflow-hidden group hover:border-brand-500/50 hover:shadow-hud transition-aero duration-500">
                    <div className="absolute -top-4 -right-4 p-6 opacity-5 text-slate-100 group-hover:scale-110 group-hover:opacity-10 transition-aero duration-700">
                        <Server size={120} strokeWidth={1} />
                    </div>
                    <div className="relative z-10 flex flex-col h-full justify-between">
                        <h3 className="text-slate-500 font-display text-xs uppercase tracking-[0.2em] mb-4">Total Fleet</h3>
                        <div className="text-6xl font-display font-bold text-white group-hover:text-brand-100 transition-colors">
                            {loading ? '-' : stats.total}
                        </div>
                    </div>
                    <div className="absolute bottom-0 left-0 h-1 bg-surface-border w-full">
                        <div className="h-full bg-slate-500 w-full"></div>
                    </div>
                </div>

                <div className="panel-glass p-8 rounded-sm relative overflow-hidden group hover:border-emerald-500/50 hover:shadow-[0_0_15px_rgba(16,185,129,0.1)] transition-aero duration-500">
                    <div className="absolute -top-4 -right-4 p-6 opacity-5 text-emerald-100 group-hover:scale-110 group-hover:opacity-10 transition-aero duration-700">
                        <Activity size={120} strokeWidth={1} />
                    </div>
                    <div className="relative z-10 flex flex-col h-full justify-between">
                        <h3 className="text-emerald-500/70 font-display text-xs uppercase tracking-[0.2em] mb-4">Active Engines</h3>
                        <div className="text-6xl font-display font-bold text-emerald-400 group-hover:text-emerald-300 transition-colors">
                            {loading ? '-' : stats.running}
                        </div>
                    </div>
                    <div className="absolute bottom-0 left-0 h-1 bg-surface-border w-full">
                        <div className="h-full bg-emerald-500" style={{ width: stats.total > 0 ? `${(stats.running/stats.total)*100}%` : '0%' }}></div>
                    </div>
                </div>

                <div className="panel-glass p-8 rounded-sm relative overflow-hidden group hover:border-rose-500/50 hover:shadow-[0_0_15px_rgba(244,63,94,0.1)] transition-aero duration-500">
                    <div className="absolute -top-4 -right-4 p-6 opacity-5 text-rose-100 group-hover:scale-110 group-hover:opacity-10 transition-aero duration-700">
                        <Cpu size={120} strokeWidth={1} />
                    </div>
                    <div className="relative z-10 flex flex-col h-full justify-between">
                        <h3 className="text-rose-500/70 font-display text-xs uppercase tracking-[0.2em] mb-4">Offline / Faults</h3>
                        <div className="text-6xl font-display font-bold text-rose-500 group-hover:text-rose-400 transition-colors">
                            {loading ? '-' : stats.stopped}
                        </div>
                    </div>
                    <div className="absolute bottom-0 left-0 h-1 bg-surface-border w-full">
                        <div className="h-full bg-rose-500" style={{ width: stats.total > 0 ? `${(stats.stopped/stats.total)*100}%` : '0%' }}></div>
                    </div>
                </div>
            </div>

            <div className="panel-glass rounded-sm p-8 md:p-10 mb-12 reveal" style={{ animationDelay: '0.2s' }}>
                <div className="flex items-center space-x-4 mb-8 border-b border-surface-border pb-4">
                    <div className="p-2 bg-brand-500/20 text-brand-500 rounded-sm border border-brand-500/30">
                        <Navigation size={20} />
                    </div>
                    <h2 className="text-xl font-display font-bold text-white uppercase tracking-widest">Command Center</h2>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Link to="/app/create" className="p-6 bg-surface/50 border border-surface-border rounded-sm hover:bg-brand-500/5 hover:-translate-y-1 hover:shadow-hud hover:border-brand-500/50 transition-aero duration-300 group flex items-center justify-between">
                        <div>
                            <h4 className="font-display font-bold text-lg text-white mb-2 group-hover:text-brand-400 transition-colors uppercase tracking-wide">Ignite Engine</h4>
                            <p className="text-sm text-slate-400 tracking-wide">Deploy new container instances</p>
                        </div>
                        <div className="w-12 h-12 bg-surface border border-surface-border flex items-center justify-center group-hover:bg-brand-500 group-hover:border-brand-400 transition-aero text-slate-400 group-hover:text-white shadow-inner">
                            <span className="text-2xl font-light">+</span>
                        </div>
                    </Link>

                    <Link to="/app/containers" className="p-6 bg-surface/50 border border-surface-border rounded-sm hover:bg-brand-500/5 hover:-translate-y-1 hover:shadow-hud hover:border-brand-500/50 transition-aero duration-300 group flex items-center justify-between">
                        <div>
                            <h4 className="font-display font-bold text-lg text-white mb-2 group-hover:text-brand-400 transition-colors uppercase tracking-wide">Fleet Control</h4>
                            <p className="text-sm text-slate-400 tracking-wide">Monitor and command active deployments</p>
                        </div>
                        <div className="w-12 h-12 bg-surface border border-surface-border flex items-center justify-center group-hover:bg-brand-500 group-hover:border-brand-400 transition-aero text-slate-400 group-hover:text-white shadow-inner">
                            <ArrowRight size={20} />
                        </div>
                    </Link>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-8 reveal" style={{ animationDelay: '0.3s' }}>
                {/* Visual Overview Donut Chart */}
                <div className="panel-glass rounded-sm p-8 flex flex-col items-center group hover:border-surface-border transition-aero">
                    <h2 className="text-sm font-display text-slate-400 mb-6 w-full text-left uppercase tracking-[0.2em]">Distribution Matrix</h2>
                    <div className="w-full h-56 relative mt-4">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={[
                                        { name: 'Active', value: stats.running, fill: '#10b981' },
                                        { name: 'Inactive', value: stats.stopped, fill: '#f43f5e' }
                                    ].filter(item => item.value > 0).length > 0
                                        ? [
                                            { name: 'Active', value: stats.running, fill: '#10b981' },
                                            { name: 'Inactive', value: stats.stopped, fill: '#f43f5e' }
                                        ].filter(item => item.value > 0)
                                        : [{ name: 'Standby', value: 1, fill: '#1f242d' }]}
                                    innerRadius={70}
                                    outerRadius={90}
                                    paddingAngle={2}
                                    dataKey="value"
                                    stroke="rgba(255,255,255,0.05)"
                                    strokeWidth={1}
                                >
                                    {
                                        [
                                            { name: 'Active', value: stats.running, fill: '#10b981' },
                                            { name: 'Inactive', value: stats.stopped, fill: '#f43f5e' }
                                        ].filter(item => item.value > 0).length > 0
                                            ? [
                                                { name: 'Active', value: stats.running, fill: '#10b981' },
                                                { name: 'Inactive', value: stats.stopped, fill: '#f43f5e' }
                                            ].filter(item => item.value > 0).map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.fill} />
                                            ))
                                            : <Cell fill="#1f242d" />
                                    }
                                </Pie>
                                <RechartsTooltip
                                    wrapperStyle={{ zIndex: 100 }}
                                    contentStyle={{ borderRadius: '4px', border: '1px solid #1f242d', background: 'rgba(5, 5, 8, 0.95)', color: '#fff', boxShadow: '0 0 15px rgba(220, 38, 38, 0.1)' }}
                                    itemStyle={{ color: '#fff', fontFamily: 'Michroma', fontSize: '12px' }}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                        <div className="absolute inset-0 flex items-center justify-center flex-col pointer-events-none z-0">
                            <span className="text-3xl font-display font-bold text-white group-hover:text-brand-400 transition-colors">{stats.total}</span>
                            <span className="text-[10px] text-slate-500 uppercase tracking-widest mt-1">Total</span>
                        </div>
                    </div>
                </div>

                {/* Resource Sliders */}
                <div className="panel-glass rounded-sm p-8 col-span-1 lg:col-span-2 group">
                    <div className="flex items-center space-x-4 mb-8 border-b border-surface-border pb-4">
                        <div className="p-2 bg-slate-800 text-slate-300 rounded-sm border border-slate-700">
                            <Activity size={20} />
                        </div>
                        <h2 className="text-xl font-display font-bold text-white uppercase tracking-widest">Hardware Telemetry</h2>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="bg-surface/30 border border-surface-border p-6 rounded-sm hover:border-slate-700 transition-aero duration-300 shadow-inner">
                            <div className="flex justify-between items-center mb-6">
                                <h4 className="font-display text-xs text-slate-400 flex items-center uppercase tracking-[0.1em]"><Cpu className="mr-2 text-slate-500" size={16} /> Core Usage</h4>
                                <span className="text-2xl font-display font-bold text-white">{metrics.cpu}%</span>
                            </div>
                            <div className="w-full bg-[#030305] h-2 mb-3 overflow-hidden border border-surface-border relative">
                                <div className="absolute top-0 bottom-0 left-0 bg-brand-500 transition-all duration-1000 shadow-[0_0_10px_rgba(220,38,38,0.8)]" style={{ width: `${Math.min(metrics.cpu, 100)}%` }}></div>
                            </div>
                            <p className="text-[10px] text-slate-600 text-right uppercase tracking-wider">Aggregated Load</p>
                        </div>

                        <div className="bg-surface/30 border border-surface-border p-6 rounded-sm hover:border-slate-700 transition-aero duration-300 shadow-inner">
                            <div className="flex justify-between items-center mb-6">
                                <h4 className="font-display text-xs text-slate-400 flex items-center uppercase tracking-[0.1em]"><Server className="mr-2 text-slate-500" size={16} /> RAM Capacity</h4>
                                <span className="text-2xl font-display font-bold text-white">
                                    {metrics.mem > 0 ? (metrics.mem / 1024 / 1024).toFixed(0) : 0} <span className="text-sm text-slate-500">MB</span>
                                </span>
                            </div>
                            <div className="w-full bg-[#030305] h-2 mb-3 overflow-hidden border border-surface-border relative">
                                <div className="absolute top-0 bottom-0 left-0 bg-brand-500 transition-all duration-1000 shadow-[0_0_10px_rgba(220,38,38,0.8)]" style={{ width: `${metrics.memLimit > 0 ? Math.min((metrics.mem / metrics.memLimit) * 100, 100) : 0}%` }}></div>
                            </div>
                            <p className="text-[10px] text-slate-600 text-right uppercase tracking-wider">Allocated Limits</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
