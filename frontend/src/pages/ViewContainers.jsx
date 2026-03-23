import React, { useEffect, useState, useRef } from 'react';
import { Server, Play, Square, Trash2, Cpu, RefreshCw, Terminal, Activity, AlertTriangle, MonitorPlay, ChevronDown, ChevronUp, HardDrive, Network, Info, Settings, Globe, Camera } from 'lucide-react';
import axios from 'axios';
import { io } from 'socket.io-client';
import TerminalModal from '../components/TerminalModal';
import LiveLogsModal from '../components/LiveLogsModal';
import { useToast } from '../components/ToastContext';
import { useOrg } from '../context/OrgContext';

const ViewContainers = () => {
    const { activeOrg } = useOrg();
    const [containers, setContainers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [refreshing, setRefreshing] = useState(false);
    const [selectedLogs, setSelectedLogs] = useState(null);
    const [logSearchQuery, setLogSearchQuery] = useState('');
    const [activeTerminal, setActiveTerminal] = useState(null);
    const [liveLogsTerminal, setLiveLogsTerminal] = useState(null);
    const [expandedContainers, setExpandedContainers] = useState({});
    const [containerStats, setContainerStats] = useState({});

    // Edit Modal State
    const [editModalOpen, setEditModalOpen] = useState(false);
    const [editingContainer, setEditingContainer] = useState(null);
    const [editDomain, setEditDomain] = useState('');
    const [editPort, setEditPort] = useState('');
    const [redeployConfirm, setRedeployConfirm] = useState(null);

    // Snapshot Modal State
    const [snapshotModalOpen, setSnapshotModalOpen] = useState(false);
    const [snapshotContainer, setSnapshotContainer] = useState(null);
    const [snapshotName, setSnapshotName] = useState('');

    // User Context
    const [userLimits, setUserLimits] = useState({ maxSnapshots: 0 });

    const { addToast } = useToast();

    // We use a ref to hold the latest containers so socket closures can read it
    const containersRef = useRef([]);
    useEffect(() => { containersRef.current = containers; }, [containers]);

    const fetchContainers = async () => {
        try {
            setRefreshing(true);
            const res = await axios.get('https://localhost:5000/api/containers');
            setContainers(res.data);

            // Also fetch basic user profile for limits
            const userRes = await axios.get('https://localhost:5000/api/auth/me', {
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
            });
            setUserLimits(userRes.data?.limits || { maxSnapshots: 0 });

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
        const socket = io('https://localhost:5000', { withCredentials: true });

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
    }, [activeOrg]);

    const handleAction = async (id, action) => {
        try {
            const targetContainer = containers.find(c => c._id === id);
            const cName = targetContainer ? targetContainer.name : 'Container';

            const endpoint = action === 'delete'
                ? `https://localhost:5000/api/containers/${id}`
                : `https://localhost:5000/api/containers/${id}/${action}`; // action 'stop'

            const method = action === 'delete' ? 'delete' : 'post';

            await axios[method](endpoint, action === 'delete' ? {} : {});

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
            addToast('Redeploy Started', `Pulling latest ${image} and spawning Green container for ${name}...`, 'info');

            await axios.put(`https://localhost:5000/api/containers/${id}/redeploy`, {});

            addToast('Zero-Downtime Success', `${name} is now running the latest version. Old container removed.`, 'success');
            fetchContainers();
        } catch (err) {
            console.error(`Error redeploying container ${id}`, err);
            addToast('Redeployment Failed', err.response?.data?.message || `Could not complete redeploy for ${name}.`, 'error');
        }
    };

    const openEditModal = (container) => {
        setEditingContainer(container);
        setEditDomain(container.domain || '');
        // We try to guess the exposed port if it had one, or default to 80
        const guessedPort = container.ports && Object.keys(container.ports).length > 0
            ? Object.keys(container.ports)[0].split('/')[0]
            : '80';
        setEditPort(guessedPort);
        setEditModalOpen(true);
    };

    const submitEdit = async (e) => {
        e.preventDefault();
        try {
            addToast('Updating Container', `Applying network settings for ${editingContainer.name}...`, 'info');
            setEditModalOpen(false);

            await axios.put(`https://localhost:5000/api/containers/${editingContainer._id}/edit`, {
                domain: editDomain,
                domainPort: editPort
            });

            addToast('Update Successful', 'Container routing settings updated.', 'success');
            fetchContainers();
        } catch (err) {
            console.error('Error editing container:', err);
            addToast('Update Failed', err.response?.data?.message || 'Could not edit container.', 'error');
        }
    };

    const openSnapshotModal = (container) => {
        if (!userLimits || userLimits.maxSnapshots === 0) {
            addToast('Upgrade Required', 'Snapshots are only available on Professional and Enterprise plans. Head to the Plans billing page to upgrade.', 'warning');
            return;
        }

        setSnapshotContainer(container);
        setSnapshotName(`${container.image.split(':')[0]}-backup-${new Date().toISOString().split('T')[0]}`);
        setSnapshotModalOpen(true);
    };

    const submitSnapshot = async (e) => {
        e.preventDefault();
        try {
            addToast('Creating Snapshot', `Committing image for ${snapshotContainer.name}. This may take a few seconds...`, 'info');
            setSnapshotModalOpen(false);

            await axios.post(`https://localhost:5000/api/containers/${snapshotContainer.dockerId}/snapshot`, {
                snapshotName: snapshotName
            }, {
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
            });

            addToast('Snapshot Saved', `Successfully created image ${snapshotName}`, 'success');
        } catch (err) {
            console.error('Error creating snapshot:', err);
            addToast('Snapshot Failed', err.response?.data?.message || 'Could not commit image.', 'error');
        }
    };

    const fetchLogs = async (id, name) => {
        // Now opens the realtime WebSocket modal instead of the old static fetch
        setLiveLogsTerminal({ id, name });
    };

    const toggleExpand = async (container) => {
        const isExpanded = expandedContainers[container._id];
        setExpandedContainers(prev => ({ ...prev, [container._id]: !isExpanded }));

        if (!isExpanded && container.state === 'running') {
            try {
                const res = await axios.get(`https://localhost:5000/api/stats/${container._id}`);
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
                        className="bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white px-5 py-2.5 rounded-xl shadow-lg hover:shadow-brand-500/25 transition-all duration-300 font-bold hover:-translate-y-0.5"
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
                        <div key={container._id} className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-md border border-slate-200 dark:border-slate-700 rounded-3xl p-6 shadow-lg hover:shadow-xl hover:-translate-y-1 hover:border-brand-400/50 dark:hover:border-brand-500/50 transition-all duration-300">
                            <div className="flex justify-between items-start mb-6">
                                <div className="flex items-center space-x-4 flex-1 min-w-0 pr-4">
                                    <div className={`p-4 rounded-2xl shrink-0 ${container.state === 'running' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400' : 'bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400'
                                        }`}>
                                        {container.state === 'running' ? <Activity size={28} /> : <Square size={28} />}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <h3 className="text-xl font-bold text-slate-900 dark:text-white truncate" title={container.name}>{container.name}</h3>
                                        <p className="text-slate-500 dark:text-slate-400 font-mono text-sm mt-1 truncate" title={container.image}>{container.image}</p>
                                    </div>
                                </div>
                                <div className="flex items-center space-x-3 shrink-0">
                                    <button
                                        onClick={() => openSnapshotModal(container)}
                                        className="p-2 text-slate-400 hover:text-indigo-500 bg-slate-50 hover:bg-indigo-50 dark:bg-slate-800 dark:hover:bg-indigo-500/10 rounded-xl transition-all"
                                        title="Snapshot / Backup to Image"
                                    >
                                        <Camera size={20} />
                                    </button>
                                    <button
                                        onClick={() => openEditModal(container)}
                                        className="p-2 text-slate-400 hover:text-brand-500 bg-slate-50 hover:bg-brand-50 dark:bg-slate-800 dark:hover:bg-brand-500/10 rounded-xl transition-all"
                                        title="Settings / Expose to Internet"
                                    >
                                        <Settings size={20} />
                                    </button>
                                    <div className={`px-4 py-1.5 rounded-full text-sm font-semibold border ${container.state === 'running' ? 'bg-emerald-50 border-emerald-200 text-emerald-600 dark:bg-emerald-900/30 dark:border-emerald-500/50 dark:text-emerald-400' : 'bg-rose-50 border-rose-200 text-rose-600 dark:bg-rose-900/30 dark:border-rose-500/50 dark:text-rose-400'
                                        }`}>
                                        {container.state ? container.state.toUpperCase() : 'UNKNOWN'}
                                    </div>
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
                                            className="group relative flex-1 min-w-[100px] bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 border border-amber-500/20 py-2.5 rounded-xl font-medium transition-colors flex items-center justify-center space-x-2"
                                        >
                                            <Square size={16} /> <span>Stop</span>

                                            {/* Custom Hover Tooltip */}
                                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-[240px] opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 pointer-events-none">
                                                <div className="bg-slate-900/95 dark:bg-black/95 backdrop-blur-md text-white text-xs rounded-xl p-3 shadow-2xl border border-slate-700/50 block text-left">
                                                    <div className="flex items-start mb-1 text-amber-400">
                                                        <Info size={14} className="mr-1.5 shrink-0 mt-0.5" />
                                                        <span className="font-bold">Pause Container</span>
                                                    </div>
                                                    <p className="text-slate-300 leading-relaxed font-normal">
                                                        Gracefully stop the container without deleting its data. You can start it again later.
                                                    </p>
                                                    <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px border-4 border-transparent border-t-slate-900/95 dark:border-t-black/95"></div>
                                                </div>
                                            </div>
                                        </button>

                                        <button
                                            onClick={() => setRedeployConfirm({ id: container._id, name: container.name, image: container.image })}
                                            className="group relative flex-1 min-w-[100px] bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-500 border border-indigo-500/20 py-2.5 rounded-xl font-medium transition-colors flex items-center justify-center space-x-2"
                                        >
                                            <RefreshCw size={16} /> <span>Redeploy</span>

                                            {/* Custom Hover Tooltip */}
                                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-[280px] opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 pointer-events-none">
                                                <div className="bg-slate-900/95 dark:bg-black/95 backdrop-blur-md text-white text-xs rounded-xl p-3 shadow-2xl border border-slate-700/50 block text-left">
                                                    <div className="flex items-start mb-1 text-indigo-400">
                                                        <Info size={14} className="mr-1.5 shrink-0 mt-0.5" />
                                                        <span className="font-bold">Zero-Downtime Update</span>
                                                    </div>
                                                    <p className="text-slate-300 leading-relaxed font-normal mb-1.5">
                                                        Downloads the latest app version and turns it on. Traefik seamlessly switches users to the new version without a single second of downtime, then deletes the old one.
                                                    </p>
                                                    <p className="text-indigo-300/80 text-[11px] leading-relaxed font-medium">
                                                        💡 <span className="text-white">Best for:</span> Web Servers (Nginx, React) & APIs (Node, Python). <span className="text-rose-300">Do NOT use on Database containers.</span>
                                                    </p>
                                                    <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px border-4 border-transparent border-t-slate-900/95 dark:border-t-black/95"></div>
                                                </div>
                                            </div>
                                        </button>

                                        <button
                                            onClick={() => setActiveTerminal({ id: container.dockerId, name: container.name })}
                                            className="group relative flex-1 min-w-[100px] bg-brand-500/10 hover:bg-brand-500/20 text-brand-400 border border-brand-500/20 py-2.5 rounded-xl font-medium transition-colors flex items-center justify-center space-x-2"
                                        >
                                            <MonitorPlay size={16} /> <span>Console</span>

                                            {/* Custom Hover Tooltip */}
                                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-[240px] opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 pointer-events-none">
                                                <div className="bg-slate-900/95 dark:bg-black/95 backdrop-blur-md text-white text-xs rounded-xl p-3 shadow-2xl border border-slate-700/50 block text-left">
                                                    <div className="flex items-start mb-1 text-brand-400">
                                                        <Info size={14} className="mr-1.5 shrink-0 mt-0.5" />
                                                        <span className="font-bold">Terminal Access</span>
                                                    </div>
                                                    <p className="text-slate-300 leading-relaxed font-normal">
                                                        Open an interactive SSH/Bash console inside the container to run commands directly.
                                                    </p>
                                                    <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px border-4 border-transparent border-t-slate-900/95 dark:border-t-black/95"></div>
                                                </div>
                                            </div>
                                        </button>
                                    </>
                                ) : (
                                    <button
                                        onClick={() => handleAction(container._id, 'start')}
                                        className="group relative flex-1 min-w-[100px] bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 border border-emerald-500/20 py-2.5 rounded-xl font-medium transition-colors flex items-center justify-center space-x-2"
                                    >
                                        <Play size={16} /> <span>Start</span>

                                        {/* Custom Hover Tooltip */}
                                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-[200px] opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 pointer-events-none">
                                            <div className="bg-slate-900/95 dark:bg-black/95 backdrop-blur-md text-white text-xs rounded-xl p-3 shadow-2xl border border-slate-700/50 block text-left">
                                                <div className="flex items-start mb-1 text-emerald-400">
                                                    <Info size={14} className="mr-1.5 shrink-0 mt-0.5" />
                                                    <span className="font-bold">Boot Container</span>
                                                </div>
                                                <p className="text-slate-300 leading-relaxed font-normal">
                                                    Turn on this stopped container.
                                                </p>
                                                <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px border-4 border-transparent border-t-slate-900/95 dark:border-t-black/95"></div>
                                            </div>
                                        </div>
                                    </button>
                                )}

                                <button
                                    onClick={() => fetchLogs(container._id, container.name)}
                                    className="group relative flex-1 min-w-[100px] bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-white dark:border-transparent py-2.5 rounded-xl font-medium transition-colors flex items-center justify-center space-x-2"
                                >
                                    <Terminal size={16} /> <span>Logs</span>

                                    {/* Custom Hover Tooltip */}
                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-[220px] opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 pointer-events-none">
                                        <div className="bg-slate-900/95 dark:bg-black/95 backdrop-blur-md text-white text-xs rounded-xl p-3 shadow-2xl border border-slate-700/50 block text-left">
                                            <div className="flex items-start mb-1 text-slate-300">
                                                <Info size={14} className="mr-1.5 shrink-0 mt-0.5" />
                                                <span className="font-bold text-white">View Console Logs</span>
                                            </div>
                                            <p className="text-slate-400 leading-relaxed font-normal">
                                                View historical runtime logs and error outputs for this container.
                                            </p>
                                            <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px border-4 border-transparent border-t-slate-900/95 dark:border-t-black/95"></div>
                                        </div>
                                    </div>
                                </button>

                                <button
                                    onClick={() => {
                                        if (window.confirm(`Are you sure you want to completely delete ${container.name}? This will destroy all unsaved data not mapped to a volume.`)) {
                                            handleAction(container._id, 'delete');
                                        }
                                    }}
                                    className="group relative flex-[2] min-w-[150px] bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 py-2.5 rounded-xl font-medium transition-colors flex items-center justify-center space-x-2"
                                >
                                    <Trash2 size={16} /> <span>Remove</span>

                                    {/* Custom Hover Tooltip */}
                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-[260px] opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 pointer-events-none">
                                        <div className="bg-slate-900/95 dark:bg-black/95 backdrop-blur-md text-white text-xs rounded-xl p-3 shadow-2xl border border-slate-700/50 block text-left">
                                            <div className="flex items-start mb-1 text-rose-400">
                                                <Info size={14} className="mr-1.5 shrink-0 mt-0.5" />
                                                <span className="font-bold tracking-wide">Danger Zone</span>
                                            </div>
                                            <p className="text-slate-300 leading-relaxed font-normal">
                                                Permanently delete this container and its data. Unsaved files not in a Volume will be lost forever.
                                            </p>
                                            <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px border-4 border-transparent border-t-slate-900/95 dark:border-t-black/95"></div>
                                        </div>
                                    </div>
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Live Logs Terminal Modal */}
            {liveLogsTerminal && (
                <LiveLogsModal
                    containerId={liveLogsTerminal.id}
                    containerName={liveLogsTerminal.name}
                    onClose={() => setLiveLogsTerminal(null)}
                />
            )}

            {/* Terminal Modal */}
            {activeTerminal && (
                <TerminalModal
                    containerId={activeTerminal.id}
                    containerName={activeTerminal.name}
                    onClose={() => setActiveTerminal(null)}
                />
            )}

            {/* Edit / Settings Modal */}
            {editModalOpen && editingContainer && (
                <div className="fixed inset-0 bg-slate-900/20 dark:bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-slate-800 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        <div className="p-5 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
                            <h3 className="text-xl font-bold text-slate-900 dark:text-white flex items-center">
                                <Settings className="mr-2 text-brand-500" /> Settings: {editingContainer.name}
                            </h3>
                            <button onClick={() => setEditModalOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-1">
                                <Square size={20} className="stroke-[2.5px]" />
                            </button>
                        </div>

                        <form onSubmit={submitEdit} className="p-6">
                            <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-4 flex items-center">
                                <Globe size={18} className="mr-2 text-purple-500" /> Expose to Internet
                            </h4>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mb-5 leading-relaxed">
                                Add a custom Traefik domain to connect this container to the public web safely.
                                <br /> <strong className="text-amber-500">Note:</strong> Applying these settings will restart the container instantly to apply network changes.
                            </p>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                        Custom Domain URL
                                    </label>
                                    <input
                                        type="text"
                                        value={editDomain}
                                        onChange={(e) => setEditDomain(e.target.value)}
                                        placeholder="e.g., app.mydomain.com"
                                        className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none text-slate-900 dark:text-white transition-shadow text-sm"
                                    />
                                    <p className="text-[10px] text-slate-500 mt-1">Leave empty to remove internet access.</p>
                                </div>
                                {editDomain.trim() !== '' && (
                                    <div className="animate-fade-in">
                                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                            Internal Container Port
                                        </label>
                                        <input
                                            type="number"
                                            value={editPort}
                                            onChange={(e) => setEditPort(e.target.value)}
                                            required={editDomain.trim() !== ''}
                                            placeholder="e.g., 80 or 3000"
                                            className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none text-slate-900 dark:text-white transition-shadow text-sm"
                                        />
                                        <p className="text-[10px] text-slate-500 mt-1">The port your app listens on inside the container.</p>
                                    </div>
                                )}
                            </div>

                            <div className="mt-8 flex justify-end space-x-3 pt-4 border-t border-slate-100 dark:border-slate-700/50">
                                <button type="button" onClick={() => setEditModalOpen(false)} className="px-5 py-2.5 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl font-medium transition-colors">
                                    Cancel
                                </button>
                                <button type="submit" className="px-5 py-2.5 bg-brand-500 hover:bg-brand-600 text-white rounded-xl font-bold transition-transform active:scale-95 shadow-lg shadow-brand-500/25">
                                    Save & Apply
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Redeploy Confirmation Modal */}
            {redeployConfirm && (
                <div className="fixed inset-0 bg-slate-900/40 dark:bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in zoom-in-95 duration-200">
                    <div className="bg-white dark:bg-slate-800 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-700">
                        <div className="p-6 border-b border-slate-200 dark:border-slate-700 flex items-center">
                            <AlertTriangle className="mr-3 text-amber-500" size={24} />
                            <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                                Confirm Redeployment
                            </h3>
                        </div>
                        <div className="p-6 text-slate-600 dark:text-slate-300 space-y-4 text-sm leading-relaxed">
                            <p>
                                You are about to initiate a Zero-Downtime update for <strong className="text-slate-900 dark:text-white">{redeployConfirm.name}</strong> using the latest version of <code className="bg-slate-100 dark:bg-slate-900 px-1.5 py-0.5 rounded font-mono text-xs">{redeployConfirm.image}</code>.
                            </p>
                            <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 p-4 rounded-xl text-amber-800 dark:text-amber-400">
                                <h4 className="font-bold mb-2 text-amber-900 dark:text-amber-300">⚠️ Important Considerations:</h4>
                                <ul className="list-disc pl-5 space-y-2">
                                    <li><strong>Zero-Downtime:</strong> A Green container will boot up. Traffic switches instantly once it is healthy.</li>
                                    <li><strong>Ephemeral Data Loss:</strong> Data stored directly inside the container filesystem (not mapped to a persistent <strong>Volume</strong>) will be permanently destroyed.</li>
                                    <li><strong>Databases:</strong> Do not redeploy databases (MySQL, Postgres) via this method without strictly mapped volumes, or you will lose your records.</li>
                                </ul>
                            </div>
                        </div>
                        <div className="p-4 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-200 dark:border-slate-700 mt-2 flex justify-end space-x-3">
                            <button
                                onClick={() => setRedeployConfirm(null)}
                                className="px-5 py-2.5 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white rounded-xl font-medium transition-colors">
                                Cancel
                            </button>
                            <button
                                onClick={() => {
                                    handleRedeploy(redeployConfirm.id, redeployConfirm.name, redeployConfirm.image);
                                    setRedeployConfirm(null);
                                }}
                                className="px-5 py-2.5 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl font-bold shadow-lg shadow-indigo-500/30 transition-transform active:scale-95 flex items-center">
                                <RefreshCw size={18} className="mr-2" /> Yes, Redeploy Now
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Snapshot Modal */}
            {snapshotModalOpen && snapshotContainer && (
                <div className="fixed inset-0 bg-slate-900/40 dark:bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-800 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-700">
                        <div className="p-6 border-b border-slate-200 dark:border-slate-700 flex items-center">
                            <Camera className="mr-3 text-indigo-500" size={24} />
                            <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                                Create Snapshot
                            </h3>
                        </div>

                        <form onSubmit={submitSnapshot} className="p-6">
                            <p className="text-sm text-slate-600 dark:text-slate-300 mb-5 leading-relaxed">
                                Creating a snapshot saves the current state of <strong className="text-slate-900 dark:text-white">{snapshotContainer.name}</strong> as a reusable Docker Image.
                            </p>

                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                Snapshot Tag Name <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                required
                                value={snapshotName}
                                onChange={(e) => setSnapshotName(e.target.value)}
                                placeholder="e.g. my-app-backup:v1"
                                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-slate-900 dark:text-white transition-shadow text-sm font-mono"
                            />
                            <p className="text-[11px] text-slate-500 mt-2">
                                Stored locally in your Docker Engine. You can deploy this exact image later exactly as it is now.
                            </p>

                            <div className="mt-8 pt-4 border-t border-slate-100 dark:border-slate-700/50 flex justify-end space-x-3">
                                <button
                                    type="button"
                                    onClick={() => setSnapshotModalOpen(false)}
                                    className="px-5 py-2.5 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white rounded-xl font-medium transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={!snapshotName}
                                    className="px-5 py-2.5 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white rounded-xl font-bold shadow-lg shadow-indigo-500/30 transition-transform active:scale-95 flex items-center"
                                >
                                    Save Image
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ViewContainers;
