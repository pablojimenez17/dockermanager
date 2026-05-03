import { useTranslation } from "react-i18next";import React, { useEffect, useState } from 'react';
import { Activity, Server, Cpu, Navigation, ArrowRight } from 'lucide-react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { io } from 'socket.io-client';
import { PieChart, Pie, Cell, Tooltip as RechartsTooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { useOrg } from '../context/OrgContext';

const Dashboard = () => {const { t } = useTranslation();
  const { activeOrg } = useOrg();
  const [stats, setStats] = useState({ total: 0, running: 0, stopped: 0 });
  const [metrics, setMetrics] = useState({ cpu: 0, mem: 0, memLimit: 0 });
  const [loading, setLoading] = useState(true);
  const name = localStorage.getItem('name') || 'User';

  // Mock history data for sparklines
  const cpuHistory = [{ val: 10 }, { val: 25 }, { val: 15 }, { val: 40 }, { val: Math.max(metrics.cpu, 5) }];
  const memHistory = [{ val: 20 }, { val: 22 }, { val: 25 }, { val: 30 }, { val: Math.max(metrics.mem / 1024 / 1024, 5) }];

  useEffect(() => {
    const fetchSummary = async () => {
      try {
        const res = await axios.get('/api/containers');
        const containers = res.data;
        const running = containers.filter((c) => c.state === 'running');

        setStats({
          total: containers.length,
          running: running.length,
          stopped: containers.length - running.length
        });

        let totalCpu = 0;
        let totalMem = 0;
        let totalMemLimit = 0;

        if (running.length > 0) {
          const metricsPromises = running.map((c) =>
          axios.get(`/api/stats/${c._id}`).catch(() => null)
          );
          const metricsResults = await Promise.all(metricsPromises);
          metricsResults.forEach((m) => {
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
    <div className="text-gray-900 dark:text-slate-100">
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">{t("auto.dashboard")}</h1>
                <p className="text-sm text-gray-500 dark:text-slate-400">{t("auto.welcome_back_")} {name}{t("auto._overview_of_your_resources_")}</p>
            </div>

            {/* Top Metrics Row */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
                <div className="panel p-5 flex flex-col justify-between">
                    <div className="flex justify-between items-start mb-4">
                        <h3 className="text-sm font-medium text-gray-500 dark:text-slate-400">{t("auto.total_instances")}</h3>
                        <div className="p-1.5 bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-slate-300 rounded">
                            <Server size={16} />
                        </div>
                    </div>
                    <div className="text-3xl font-bold text-gray-900 dark:text-white">
                        {loading ? '-' : stats.total}
                    </div>
                </div>

                <div className="panel p-5 flex flex-col justify-between">
                    <div className="flex justify-between items-start mb-4">
                        <h3 className="text-sm font-medium text-gray-500 dark:text-slate-400">{t("auto.running")}</h3>
                        <div className="p-1.5 bg-green-50 dark:bg-green-500/10 text-green-600 dark:text-green-500 rounded">
                            <Activity size={16} />
                        </div>
                    </div>
                    <div className="text-3xl font-bold text-gray-900 dark:text-white">
                        {loading ? '-' : stats.running}
                    </div>
                </div>

                <div className="panel p-5 flex flex-col justify-between">
                    <div className="flex justify-between items-start mb-4">
                        <h3 className="text-sm font-medium text-gray-500 dark:text-slate-400">{t("auto.stopped_failed")}</h3>
                        <div className="p-1.5 bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-500 rounded">
                            <Cpu size={16} />
                        </div>
                    </div>
                    <div className="text-3xl font-bold text-gray-900 dark:text-white">
                        {loading ? '-' : stats.stopped}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                {/* Resource Summary Table Style */}
                <div className="panel col-span-1 lg:col-span-2 overflow-hidden flex flex-col">
                    <div className="px-5 py-4 border-b border-gray-200 dark:border-slate-700 bg-gray-50/50 dark:bg-slate-800/50">
                        <h2 className="text-base font-semibold text-gray-900 dark:text-white flex items-center">
                            <Activity size={18} className="mr-2 text-gray-400" />
                            {t("auto.resource_utilization")}
                        </h2>
                    </div>
                    <div className="p-5 flex-1 flex flex-col justify-center">
                        <table className="w-full text-sm text-left">
                            <tbody>
                                <tr className="border-b border-gray-100 dark:border-slate-700/50">
                                    <td className="py-4 font-medium text-gray-700 dark:text-slate-300 w-1/4">{t("auto.cpu_usage")}</td>
                                    <td className="py-4 w-1/4 font-mono">{metrics.cpu}%</td>
                                    <td className="py-4 w-1/2">
                                        <div className="h-10 w-full">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <LineChart data={cpuHistory}>
                                                    <Line type="monotone" dataKey="val" stroke="#2563eb" strokeWidth={2} dot={false} isAnimationActive={false} />
                                                </LineChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </td>
                                </tr>
                                <tr>
                                    <td className="py-4 font-medium text-gray-700 dark:text-slate-300 w-1/4">{t("auto.memory")}</td>
                                    <td className="py-4 w-1/4 font-mono">
                                        {metrics.mem > 0 ? (metrics.mem / 1024 / 1024).toFixed(0) : 0} {t("auto.mb")}
                                    </td>
                                    <td className="py-4 w-1/2">
                                        <div className="h-10 w-full">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <LineChart data={memHistory}>
                                                    <Line type="monotone" dataKey="val" stroke="#10b981" strokeWidth={2} dot={false} isAnimationActive={false} />
                                                </LineChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="panel overflow-hidden flex flex-col">
                    <div className="px-5 py-4 border-b border-gray-200 dark:border-slate-700 bg-gray-50/50 dark:bg-slate-800/50">
                        <h2 className="text-base font-semibold text-gray-900 dark:text-white">{t("auto.status_distribution")}</h2>
                    </div>
                    <div className="p-5 flex-1 flex items-center justify-center">
                        <div className="w-full h-48 relative">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                    data={[
                    { name: 'Running', value: stats.running, fill: '#10b981' },
                    { name: 'Stopped', value: stats.stopped, fill: '#ef4444' }].
                    filter((item) => item.value > 0).length > 0 ?
                    [
                    { name: 'Running', value: stats.running, fill: '#10b981' },
                    { name: 'Stopped', value: stats.stopped, fill: '#ef4444' }].
                    filter((item) => item.value > 0) :
                    [{ name: 'None', value: 1, fill: '#e5e7eb' }]}
                    innerRadius={50}
                    outerRadius={70}
                    paddingAngle={2}
                    dataKey="value"
                    stroke="none">
                    
                                        {
                    [
                    { name: 'Running', value: stats.running, fill: '#10b981' },
                    { name: 'Stopped', value: stats.stopped, fill: '#ef4444' }].
                    filter((item) => item.value > 0).length > 0 ?
                    [
                    { name: 'Running', value: stats.running, fill: '#10b981' },
                    { name: 'Stopped', value: stats.stopped, fill: '#ef4444' }].
                    filter((item) => item.value > 0).map((entry, index) =>
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                    ) :
                    <Cell fill="#e5e7eb" />
                    }
                                    </Pie>
                                    <RechartsTooltip
                    wrapperStyle={{ zIndex: 100 }}
                    contentStyle={{ borderRadius: '4px', border: '1px solid #e5e7eb', background: '#fff', color: '#111827', fontSize: '12px', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }} />
                  
                                </PieChart>
                            </ResponsiveContainer>
                            <div className="absolute inset-0 flex items-center justify-center flex-col pointer-events-none">
                                <span className="text-2xl font-bold text-gray-900 dark:text-white">{stats.total}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Link to="/app/create" className="panel p-5 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors group flex items-center justify-between">
                    <div>
                        <h4 className="font-semibold text-gray-900 dark:text-white mb-1">{t("auto.create_container")}</h4>
                        <p className="text-sm text-gray-500 dark:text-slate-400">{t("auto.deploy_a_new_instance")}</p>
                    </div>
                    <ArrowRight size={20} className="text-gray-400 group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors" />
                </Link>

                <Link to="/app/containers" className="panel p-5 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors group flex items-center justify-between">
                    <div>
                        <h4 className="font-semibold text-gray-900 dark:text-white mb-1">{t("auto.manage_fleet")}</h4>
                        <p className="text-sm text-gray-500 dark:text-slate-400">{t("auto.view_and_control_active_deployments")}</p>
                    </div>
                    <ArrowRight size={20} className="text-gray-400 group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors" />
                </Link>
            </div>
        </div>);

};

export default Dashboard;