import React, { useEffect, useState, useRef } from 'react';
import { Server, Play, Square, Trash2, Cpu, RefreshCw, Terminal, Activity, AlertTriangle, MonitorPlay, ChevronDown, ChevronUp, HardDrive, Network, Info } from 'lucide-react';
import axios from 'axios';
import { io } from 'socket.io-client';
import TerminalModal from '../components/TerminalModal';
import { useToast } from '../components/ToastContext';

const ViewContainers = () => {
    const [containers, setContainers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [refreshing, setRefreshing] = useState(false);
    const [selectedLogs, setSelectedLogs] = useState(null);
    const [logSearchQuery, setLogSearchQuery] = useState('');
    const [activeTerminal, setActiveTerminal] = useState(null);
    const [expandedContainers, setExpandedContainers] = useState({});
    const [containerStats, setContainerStats] = useState({});
    const { addToast } = useToast();

    // We use a ref to hold the latest containers so socket closures can read it
    const containersRef = useRef([]);
    useEffect(() => { containersRef.current = containers; }, [containers]);

    const fetchContainers = async () => {
        try {
            setRefreshing(true);
            const token = localStorage.getItem('token');
            const res = await axios.get('http://localhost:5000/api/containers', {
                headers: { Authorization: `Bearer ${token}` }
            });
            setContainers(res.data);
            setError('');
        } catch (err) {
            setError(err.response?.data?.message || 'Error fetching containers');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchContainers();
        const interval = setInterval(fetchContainers, 30000); // Poll every 30s

        // Setup Real-time Docker events socket
        const socket = io('http://localhost:5000');

        socket.on('container:status_change', ({ dockerId, status }) => {
            console.log('[React Socket] Received container event:', dockerId, status);
            const currentContainers = containersRef.current;
            const target = currentContainers.find(c => dockerId.includes(c.dockerId) || c.dockerId.includes(dockerId));

            if (target) {
                if (status === 'die') {
                    addToast(
                        'Container Crashed',
                        `Container ${target.name} stopped unexpectedly.`,
                        'error',
                        'View Crash Logs',
                        () => fetchLogs(target._id, target.name)
                    );
                } else if (status === 'stop') {
                    addToast('Container Stopped', `${target.name} has been stopped.`, 'warning');
                } else if (status === 'start' || status === 'unpause') {
                    addToast('Container Running', `${target.name} is now online.`, 'success');
                }

                setContainers(prevContainers =>
                    prevContainers.map(c => {
                        if (c.dockerId === target.dockerId) {
                            return { ...c, state: status === 'die' || status === 'stop' ? 'stopped' : 'running' };
                        }
                        return c;
                    })
                );
            }
        });

        return () => {
            clearInterval(interval);
            socket.disconnect();
        };
    }, []);

    const handleAction = async (id, action) => {
        try {
            const token = localStorage.getItem('token');
            const targetContainer = containers.find(c => c._id === id);
            const cName = targetContainer ? targetContainer.name : 'Container';

            const endpoint = action === 'delete'
                ? `http://localhost:5000/api/containers/${id}`
                : `http://localhost:5000/api/containers/${id}/${action}`; // action 'stop'

            const method = action === 'delete' ? 'delete' : 'post';

            await axios[method](endpoint, action === 'delete' ? { headers: { Authorization: `Bearer ${token}` } } : {}, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (action === 'start') {
                addToast('Container Started', `${cName} successfully started.`, 'success');
            } else if (action === 'stop') {
                addToast('Container Stopped', `${cName} successfully stopped.`, 'warning');
            } else if (action === 'delete') {
                addToast('Container Deleted', `${cName} has been permanently deleted.`, 'error');
            }

            fetchContainers();
        } catch (err) {
            console.error(`Error performing ${action} on container ${id}`, err);
            addToast('Action Failed', `Could not ${action} container.`, 'error');
        }
    };

    const handleRedeploy = async (id, name, image) => {
        try {
            const token = localStorage.getItem('token');
            addToast('Redeploy Started', `Pulling latest ${image} and spawning Green container for ${name}...`, 'info');

            await axios.put(`http://localhost:5000/api/containers/${id}/redeploy`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });

            addToast('Zero-Downtime Success', `${name} is now running the latest version. Old container removed.`, 'success');
            fetchContainers();
        } catch (err) {
            console.error(`Error redeploying container ${id}`, err);
            addToast('Redeployment Failed', err.response?.data?.message || `Could not complete redeploy for ${name}.`, 'error');
        }
    };

    const fetchLogs = async (id, name) => {
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get(`http://localhost:5000/api/stats/${id}/logs`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setSelectedLogs({ name, content: res.data });
        } catch (err) {
            setSelectedLogs({ name, content: "Error fetching logs or container not running." });
        }
    };

    const toggleExpand = async (container) => {
        const isExpanded = expandedContainers[container._id];
        setExpandedContainers(prev => ({ ...prev, [container._id]: !isExpanded }));

        if (!isExpanded && container.state === 'running') {
            try {
                const token = localStorage.getItem('token');
                const res = await axios.get(`http://localhost:5000/api/stats/${container._id}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setContainerStats(prev => ({ ...prev, [container._id]: res.data }));
            } catch (err) {
                console.error("Failed to fetch stats for", container.name);
            }
        }
    };

    const renderLogLine = (line, index) => {
        if (logSearchQuery && !line.toLowerCase().includes(logSearchQuery.toLowerCase())) {
            return null;
        }

        let textColorClass = 'text-slate-800 dark:text-slate-300';
        const lowerLine = line.toLowerCase();

        if (lowerLine.includes('error') || lowerLine.includes('exception') || lowerLine.includes('fail')) {
            textColorClass = 'text-red-600 dark:text-red-400 font-semibold bg-red-500/10';
        } else if (lowerLine.includes('warn')) {
            textColorClass = 'text-yellow-600 dark:text-yellow-400 font-semibold bg-yellow-500/10';
        } else if (lowerLine.includes('info')) {
            textColorClass = 'text-blue-600 dark:text-blue-400';
        } else if (lowerLine.includes('debug')) {
            textColorClass = 'text-slate-500 dark:text-slate-500';
        }

        return (
            <div key={index} className={`px-2 py-0.5 rounded ${textColorClass} break-words`}>
                {line}
            </div>
        );
    };

    return (
        <div className="p-4 md:p-8 pb-20 text-slate-900 dark:text-white max-w-7xl mx-auto">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-10 space-y-4 sm:space-y-0">
                <div>
                    <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-2">My Containers</h1>
                    <p className="text-slate-600 dark:text-slate-400 text-base sm:text-lg">Manage and monitor your deployed instances.</p>
                </div>
                <div className="flex w-full sm:w-auto space-x-3">
                    <button
                        onClick={() => addToast('Test System', 'If you see this, Toast CSS works', 'success')}
                        className="bg-brand-500 hover:bg-brand-400 text-white px-4 py-2 rounded-xl transition-all font-bold"
                    >
                        Test Notification
                    </button>
                    <button
                        onClick={fetchContainers}
                        disabled={refreshing}
                        className="bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 dark:bg-slate-800 dark:hover:bg-slate-700 dark:border-slate-700 dark:text-slate-300 p-3 rounded-xl transition-all"
                    >
                        <RefreshCw size={24} className={refreshing ? 'animate-spin' : ''} />
                    </button>
                </div>

            </div>

            {error && (
                <div className="bg-red-500/10 border border-red-500/50 text-red-500 p-4 rounded-2xl flex items-center mb-8">
                    <AlertTriangle className="mr-3" />
                    {error}
                </div>
            )}

            {loading ? (
                <div className="flex justify-center py-20">
                    <RefreshCw size={48} className="animate-spin text-brand-500" />
                </div>
            ) : containers.length === 0 ? (
                <div className="text-center py-20 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-3xl">
                    <Server size={64} className="mx-auto text-slate-400 dark:text-slate-600 mb-6" />
                    <h3 className="text-2xl font-bold mb-2 text-slate-900 dark:text-white">No containers found</h3>
                    <p className="text-slate-600 dark:text-slate-400">You haven't deployed any containers yet.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                    {containers.map(container => (
                        <div key={container._id} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 shadow-lg hover:border-slate-400 dark:hover:border-slate-500 transition-colors">
                            <div className="flex justify-between items-start mb-6">
                                <div className="flex items-center space-x-4">
                                    <div className={`p-4 rounded-2xl ${container.state === 'running' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400' : 'bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400'
                                        }`}>
                                        {container.state === 'running' ? <Activity size={28} /> : <Square size={28} />}
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-bold text-slate-900 dark:text-white">{container.name}</h3>
                                        <p className="text-slate-500 dark:text-slate-400 font-mono text-sm mt-1">{container.image}</p>
                                    </div>
                                </div>
                                <div className={`px-4 py-1.5 rounded-full text-sm font-semibold border ${container.state === 'running' ? 'bg-emerald-50 border-emerald-200 text-emerald-600 dark:bg-emerald-900/30 dark:border-emerald-500/50 dark:text-emerald-400' : 'bg-rose-50 border-rose-200 text-rose-600 dark:bg-rose-900/30 dark:border-rose-500/50 dark:text-rose-400'
                                    }`}>
                                    {container.state ? container.state.toUpperCase() : 'UNKNOWN'}
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4 mb-6">
                                <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-4 border border-slate-200 dark:border-slate-700/50">
                                    <p className="text-xs text-slate-600 dark:text-slate-500 mb-1 uppercase tracking-wider font-semibold">Ports Exposed</p>
                                    <p className="font-mono text-sm text-slate-800 dark:text-slate-300">
                                        {container.ports && Object.keys(container.ports).length > 0
                                            ? Object.keys(container.ports).join(', ')
                                            : 'None'}
                                    </p>
                                </div>
                                <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-4 border border-slate-200 dark:border-slate-700/50">
                                    <p className="text-xs text-slate-600 dark:text-slate-500 mb-1 uppercase tracking-wider font-semibold">Docker ID</p>
                                    <p className="font-mono text-sm truncate text-slate-800 dark:text-slate-300" title={container.dockerId}>
                                        {container.dockerId.substring(0, 12)}...
                                    </p>
                                </div>
                            </div>

                            {/* Expandable Details Section */}
                            {expandedContainers[container._id] && (
                                <div className="mt-4 mb-6 bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700/50 rounded-2xl p-5 shadow-[inset_0_2px_10px_rgba(0,0,0,0.02)] transition-all animate-in fade-in slide-in-from-top-4 duration-300">
                                    <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-4 border-b border-slate-200 dark:border-slate-700/50 pb-2">Advanced Instance Details</h4>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div>
                                            <p className="flex items-center text-xs font-semibold text-slate-500 uppercase tracking-widest mb-2"><Network size={14} className="mr-1.5" /> Networking</p>
                                            <div className="space-y-2">
                                                <div className="flex justify-between items-center text-sm">
                                                    <span className="text-slate-600 dark:text-slate-400">Internal IP / v4:</span>
                                                    <span className="font-mono bg-white dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-300">
                                                        {containerStats[container._id]?.ipv4Address || container.ipv4Address || 'N/A'}
                                                    </span>
                                                </div>
                                                <div className="flex justify-between items-center text-sm">
                                                    <span className="text-slate-600 dark:text-slate-400">Network Mode:</span>
                                                    <span className="font-mono bg-white dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-300">
                                                        {containerStats[container._id]?.networkMode || container.networkMode || 'bridge'}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        <div>
                                            <p className="flex items-center text-xs font-semibold text-slate-500 uppercase tracking-widest mb-2"><HardDrive size={14} className="mr-1.5" /> Hardware Usage</p>
                                            {container.state === 'running' ? (
                                                containerStats[container._id] ? (
                                                    <div className="space-y-3">
                                                        <div>
                                                            <div className="flex justify-between items-center text-xs mb-1">
                                                                <span className="text-slate-600 dark:text-slate-400">CPU</span>
                                                                <span className="font-semibold text-indigo-600 dark:text-indigo-400">{containerStats[container._id].cpuPercent}%</span>
                                                            </div>
                                                            <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-1.5 overflow-hidden">
                                                                <div className="bg-indigo-500 h-1.5 rounded-full transition-all duration-1000" style={{ width: `${Math.min(containerStats[container._id].cpuPercent, 100)}%` }}></div>
                                                            </div>
                                                        </div>
                                                        <div>
                                                            <div className="flex justify-between items-center text-xs mb-1">
                                                                <span className="text-slate-600 dark:text-slate-400">Memory</span>
                                                                <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                                                                    {(containerStats[container._id].memUsage / 1024 / 1024).toFixed(1)} MB / {(containerStats[container._id].memLimit / 1024 / 1024).toFixed(0)} MB
                                                                </span>
                                                            </div>
                                                            <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-1.5 overflow-hidden">
                                                                <div className="bg-emerald-500 h-1.5 rounded-full transition-all duration-1000" style={{ width: `${containerStats[container._id].memPercent}%` }}></div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="text-sm text-slate-500 flex items-center h-full">
                                                        <RefreshCw className="animate-spin mr-2" size={14} /> Loading metrics...
                                                    </div>
                                                )
                                            ) : (
                                                <div className="text-sm text-slate-400 dark:text-slate-500 h-full flex items-center italic">
                                                    Container is not running.
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div className="flex flex-wrap gap-3 pt-6 border-t border-slate-200 dark:border-slate-700/50">
                                <button
                                    onClick={() => toggleExpand(container)}
                                    className="p-2.5 bg-slate-50 hover:bg-slate-100 text-slate-500 border border-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-400 dark:border-slate-700 rounded-xl transition-colors shrink-0"
                                    title="View Details"
                                >
                                    {expandedContainers[container._id] ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                                </button>

                                {container.state === 'running' ? (
                                    <>
                                        <button
                                            onClick={() => handleAction(container._id, 'stop')}
                                            className="flex-1 min-w-[100px] bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 border border-amber-500/20 py-2.5 rounded-xl font-medium transition-colors flex items-center justify-center space-x-2"
                                            title="Gracefully stop the container without deleting its data"
                                        >
                                            <Square size={16} /> <span>Stop</span>
                                        </button>

                                        <button
                                            onClick={() => handleRedeploy(container._id, container.name, container.image)}
                                            className="group relative flex-1 min-w-[100px] bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-500 border border-indigo-500/20 py-2.5 rounded-xl font-medium transition-colors flex items-center justify-center space-x-2"
                                        >
                                            <RefreshCw size={16} /> <span>Redeploy</span>

                                            {/* Custom Hover Tooltip */}
                                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-[280px] opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 pointer-events-none">
                                                <div className="bg-slate-900/95 dark:bg-black/95 backdrop-blur-md text-white text-xs rounded-xl p-4 shadow-2xl border border-slate-700/50">
                                                    <div className="flex items-start mb-2 text-indigo-400">
                                                        <Info size={16} className="mr-2 shrink-0 mt-0.5" />
                                                        <span className="font-bold text-sm">Zero-Downtime Update</span>
                                                    </div>
                                                    <p className="text-slate-300 leading-relaxed text-left">
                                                        This button downloads the latest version of your app and turns it on. Traefik will seamlessly switch your users to the new version without a single second of downtime, and then delete the old one.
                                                    </p>

                                                    {/* Triangle pointer */}
                                                    <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px border-4 border-transparent border-t-slate-900/95 dark:border-t-black/95"></div>
                                                </div>
                                            </div>
                                        </button>

                                        <button
                                            onClick={() => setActiveTerminal({ id: container.dockerId, name: container.name })}
                                            className="flex-1 min-w-[100px] bg-brand-500/10 hover:bg-brand-500/20 text-brand-400 border border-brand-500/20 py-2.5 rounded-xl font-medium transition-colors flex items-center justify-center space-x-2"
                                            title="Open an interactive SSH/Bash console inside the container"
                                        >
                                            <MonitorPlay size={16} /> <span>Console</span>
                                        </button>
                                    </>
                                ) : (
                                    <button
                                        onClick={() => handleAction(container._id, 'start')}
                                        className="flex-1 min-w-[100px] bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 border border-emerald-500/20 py-2.5 rounded-xl font-medium transition-colors flex items-center justify-center space-x-2"
                                        title="Boot up the stopped container"
                                    >
                                        <Play size={16} /> <span>Start</span>
                                    </button>
                                )}

                                <button
                                    onClick={() => fetchLogs(container._id, container.name)}
                                    className="flex-1 min-w-[100px] bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-white dark:border-transparent py-2.5 rounded-xl font-medium transition-colors flex items-center justify-center space-x-2"
                                    title="View historical runtime logs"
                                >
                                    <Terminal size={16} /> <span>Logs</span>
                                </button>

                                <button
                                    onClick={() => {
                                        if (window.confirm(`Are you sure you want to completely delete ${container.name}? This will destroy all unsaved data not mapped to a volume.`)) {
                                            handleAction(container._id, 'delete');
                                        }
                                    }}
                                    className="flex-1 min-w-[100px] bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 py-2.5 rounded-xl font-medium transition-colors flex items-center justify-center space-x-2"
                                    title="Permanently delete container and its data"
                                >
                                    <Trash2 size={16} /> <span>Remove</span>
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Logs Modal */}
            {selectedLogs && (
                <div className="fixed inset-0 bg-slate-900/20 dark:bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-8">
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 w-full max-w-5xl rounded-2xl shadow-2xl overflow-hidden flex flex-col h-[85vh]">
                        <div className="p-4 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                            <h3 className="font-bold flex items-center text-lg text-slate-900 dark:text-white shrink-0">
                                <Terminal className="mr-2 text-brand-500 dark:text-brand-400" /> Logs: {selectedLogs.name}
                            </h3>
                            <div className="flex items-center space-x-3 w-full sm:w-auto">
                                <input
                                    type="text"
                                    placeholder="Filter logs..."
                                    value={logSearchQuery}
                                    onChange={(e) => setLogSearchQuery(e.target.value)}
                                    className="w-full sm:w-64 px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-sm focus:ring-1 focus:ring-brand-500 outline-none dark:text-white transition-shadow"
                                />
                                <button onClick={() => { setSelectedLogs(null); setLogSearchQuery(''); }} className="shrink-0 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors">
                                    Close
                                </button>
                            </div>
                        </div>
                        <div className="p-4 overflow-y-auto flex-1 font-mono text-sm bg-slate-50 text-slate-800 dark:bg-[#0f172a] dark:text-slate-300 leading-relaxed">
                            {selectedLogs.content ? selectedLogs.content.split('\n').map((line, i) => renderLogLine(line, i)) : 'No logs available.'}
                        </div>
                    </div>
                </div>
            )}

            {/* Terminal Modal */}
            {activeTerminal && (
                <TerminalModal
                    containerId={activeTerminal.id}
                    containerName={activeTerminal.name}
                    onClose={() => setActiveTerminal(null)}
                />
            )}
        </div>
    );
};

export default ViewContainers;
