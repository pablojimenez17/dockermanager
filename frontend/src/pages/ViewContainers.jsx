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

    const containersRef = useRef([]);
    useEffect(() => { containersRef.current = containers; }, [containers]);

    const fetchContainers = async () => {
        try {
            setRefreshing(true);
            const res = await axios.get('/api/containers');
            setContainers(res.data);

            const userRes = await axios.get('/api/auth/me', {
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
        const interval = setInterval(fetchContainers, 30000);

        const socket = io('', { withCredentials: true });

        socket.on('container:status_change', ({ dockerId, status }) => {
            const currentContainers = containersRef.current;
            const target = currentContainers.find(c => dockerId.includes(c.dockerId) || c.dockerId.includes(dockerId));

            if (target) {
                if (status === 'die') {
                    addToast('Container Crashed', `Container ${target.name} stopped unexpectedly.`, 'error');
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
                ? `/api/containers/${id}`
                : `/api/containers/${id}/${action}`; 

            const method = action === 'delete' ? 'delete' : 'post';

            await axios[method](endpoint, action === 'delete' ? {} : {});

            if (action === 'start') {
                addToast('Engine Started', `${cName} is online.`, 'success');
            } else if (action === 'stop') {
                addToast('Engine Stopped', `${cName} successfully shut down.`, 'warning');
            } else if (action === 'delete') {
                addToast('Instance Terminated', `${cName} has been permanently erased.`, 'error');
            }

            fetchContainers();
        } catch (err) {
            console.error(`Error performing ${action} on container ${id}`, err);
            addToast('Action Failed', `Could not ${action} container.`, 'error');
        }
    };

    const handleRedeploy = async (id, name, image) => {
        try {
            addToast('Redeploy Sequence Initiated', `Pulling latest ${image} and spawning replacement for ${name}...`, 'info');

            await axios.put(`/api/containers/${id}/redeploy`, {});

            addToast('Zero-Downtime Success', `${name} is now running the latest version. Old instance decoupled.`, 'success');
            fetchContainers();
        } catch (err) {
            console.error(`Error redeploying container ${id}`, err);
            addToast('Redeployment Failed', err.response?.data?.message || `Could not complete redeploy for ${name}.`, 'error');
        }
    };

    const openEditModal = (container) => {
        setEditingContainer(container);
        setEditDomain(container.domain || '');
        const guessedPort = container.ports && Object.keys(container.ports).length > 0
            ? Object.keys(container.ports)[0].split('/')[0]
            : '80';
        setEditPort(guessedPort);
        setEditModalOpen(true);
    };

    const submitEdit = async (e) => {
        e.preventDefault();
        try {
            addToast('Updating Network Config', `Applying routing rules for ${editingContainer.name}...`, 'info');
            setEditModalOpen(false);

            await axios.put(`/api/containers/${editingContainer._id}/edit`, {
                domain: editDomain,
                domainPort: editPort
            });

            addToast('Route Established', 'Container proxy settings updated.', 'success');
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
            addToast('Committing Snapshot', `Creating image blueprint for ${snapshotContainer.name}. This may take a few seconds...`, 'info');
            setSnapshotModalOpen(false);

            await axios.post(`/api/containers/${snapshotContainer.dockerId}/snapshot`, {
                snapshotName: snapshotName
            }, {
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
            });

            addToast('Snapshot Saved', `Successfully stored image blueprint ${snapshotName}`, 'success');
        } catch (err) {
            console.error('Error creating snapshot:', err);
            addToast('Snapshot Failed', err.response?.data?.message || 'Could not commit image.', 'error');
        }
    };

    const fetchLogs = async (id, name) => {
        setLiveLogsTerminal({ id, name });
    };

    const toggleExpand = async (container) => {
        const isExpanded = expandedContainers[container._id];
        setExpandedContainers(prev => ({ ...prev, [container._id]: !isExpanded }));

        if (!isExpanded && container.state === 'running') {
            try {
                const res = await axios.get(`/api/stats/${container._id}`);
                setContainerStats(prev => ({ ...prev, [container._id]: res.data }));
            } catch (err) {
                console.error("Failed to fetch stats for", container.name);
            }
        }
    };

    return (
        <div className="p-4 md:p-8 pb-20 text-slate-200 max-w-7xl mx-auto">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-10 space-y-4 sm:space-y-0 reveal">
                <div>
                    <h1 className="text-3xl sm:text-5xl font-display font-bold tracking-tighter mb-3 uppercase text-white drop-shadow-md">Active <span className="text-brand-500">Fleet</span></h1>
                    <p className="text-slate-400 text-base sm:text-lg uppercase tracking-widest font-semibold">Monitor and command your deployed instances.</p>
                </div>
                <div className="flex w-full sm:w-auto space-x-3">
                    <button
                        onClick={fetchContainers}
                        disabled={refreshing}
                        className="bg-surface hover:bg-surface-hover border border-surface-border text-slate-300 p-3 rounded-sm shadow-inner transition-aero"
                    >
                        <RefreshCw size={24} className={refreshing ? 'animate-spin text-brand-500' : ''} />
                    </button>
                </div>
            </div>

            {error && (
                <div className="bg-rose-500/10 border border-rose-500/50 text-rose-500 p-4 rounded-sm flex items-center mb-8 shadow-[0_0_15px_rgba(244,63,94,0.1)]">
                    <AlertTriangle className="mr-3" />
                    <span className="font-display text-sm tracking-wider uppercase">{error}</span>
                </div>
            )}

            {loading ? (
                <div className="flex justify-center py-20 reveal">
                    <RefreshCw size={48} className="animate-[spin_2s_linear_infinite] text-brand-500/50" />
                </div>
            ) : containers.length === 0 ? (
                <div className="text-center py-20 panel-glass rounded-sm border-dashed border-surface-border reveal">
                    <Server size={64} className="mx-auto text-slate-600 mb-6 stroke-[1px]" />
                    <h3 className="text-2xl font-display font-bold mb-2 text-white uppercase tracking-wider">No instances online</h3>
                    <p className="text-slate-500 tracking-wide">You haven't initiated any deployments yet.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 reveal" style={{ animationDelay: '0.1s' }}>
                    {containers.map(container => (
                        <div key={container._id} className="panel-glass rounded-sm p-6 group hover:border-brand-500/30 hover:shadow-hud transition-aero duration-500">
                            <div className="flex justify-between items-start mb-6">
                                <div className="flex items-center space-x-4 flex-1 min-w-0 pr-4">
                                    <div className={`p-4 rounded-sm shrink-0 border shadow-inner transition-colors duration-500 ${container.state === 'running' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 shadow-[0_0_10px_rgba(16,185,129,0.2)]' : 'bg-rose-500/10 text-rose-400 border-rose-500/30 shadow-[0_0_10px_rgba(244,63,94,0.2)]'
                                        }`}>
                                        {container.state === 'running' ? <Activity size={24} /> : <Square size={24} />}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <h3 className="text-xl font-display font-bold text-white truncate uppercase tracking-widest" title={container.name}>{container.name}</h3>
                                        <p className="text-brand-400/80 font-mono text-xs mt-2 truncate tracking-widest" title={container.image}>{container.image}</p>
                                    </div>
                                </div>
                                <div className="flex items-center space-x-2 shrink-0">
                                    <button
                                        onClick={() => openSnapshotModal(container)}
                                        className="p-2 text-slate-400 hover:text-indigo-400 bg-surface border border-surface-border hover:border-indigo-500/50 rounded-sm transition-aero shadow-inner"
                                        title="Snapshot Blueprint"
                                    >
                                        <Camera size={18} />
                                    </button>
                                    <button
                                        onClick={() => openEditModal(container)}
                                        className="p-2 text-slate-400 hover:text-brand-400 bg-surface border border-surface-border hover:border-brand-500/50 rounded-sm transition-aero shadow-inner"
                                        title="Network Routing"
                                    >
                                        <Settings size={18} />
                                    </button>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4 mb-6">
                                <div className="bg-surface/50 rounded-sm p-4 border border-surface-border shadow-inner">
                                    <p className="text-[10px] text-slate-500 mb-2 font-display uppercase tracking-[0.2em]">Exposed Ports</p>
                                    <p className="font-mono text-sm text-slate-300">
                                        {container.ports && Object.keys(container.ports).length > 0
                                            ? Object.keys(container.ports).join(', ')
                                            : 'NO_ROUTES_MAPPED'}
                                    </p>
                                </div>
                                <div className="bg-surface/50 rounded-sm p-4 border border-surface-border shadow-inner">
                                    <p className="text-[10px] text-slate-500 mb-2 font-display uppercase tracking-[0.2em]">Instance ID</p>
                                    <p className="font-mono text-sm truncate text-slate-300" title={container.dockerId}>
                                        {container.dockerId.substring(0, 12)}
                                    </p>
                                </div>
                            </div>

                            {/* Expandable Details Section */}
                            {expandedContainers[container._id] && (
                                <div className="mt-4 mb-6 bg-surface border border-surface-border rounded-sm p-5 shadow-inner transition-aero">
                                    <h4 className="text-xs font-display font-bold text-white mb-6 border-b border-surface-border pb-3 uppercase tracking-widest text-brand-400">Diagnostic Telemetry</h4>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                        <div>
                                            <p className="flex items-center text-[10px] font-display text-slate-500 uppercase tracking-[0.2em] mb-4"><Network size={14} className="mr-2" /> Route Vector</p>
                                            <div className="space-y-4">
                                                <div className="flex justify-between items-center text-sm border-b border-surface-border/50 pb-2">
                                                    <span className="text-slate-400 text-xs uppercase tracking-widest">Internal IP</span>
                                                    <span className="font-mono text-brand-300">
                                                        {containerStats[container._id]?.ipv4Address || container.ipv4Address || 'OFFLINE'}
                                                    </span>
                                                </div>
                                                <div className="flex justify-between items-center text-sm border-b border-surface-border/50 pb-2">
                                                    <span className="text-slate-400 text-xs uppercase tracking-widest">Topology</span>
                                                    <span className="font-mono text-brand-300">
                                                        {containerStats[container._id]?.networkMode || container.networkMode || 'isolated'}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        <div>
                                            <p className="flex items-center text-[10px] font-display text-slate-500 uppercase tracking-[0.2em] mb-4"><HardDrive size={14} className="mr-2" /> Hardware Allocation</p>
                                            {container.state === 'running' ? (
                                                containerStats[container._id] ? (
                                                    <div className="space-y-4">
                                                        <div>
                                                            <div className="flex justify-between items-center text-[10px] uppercase tracking-widest mb-2 font-display">
                                                                <span className="text-slate-400">Core Threads</span>
                                                                <span className="font-bold text-indigo-400">{containerStats[container._id].cpuPercent}%</span>
                                                            </div>
                                                            <div className="w-full bg-[#030305] border border-surface-border rounded-sm h-1.5 overflow-hidden">
                                                                <div className="bg-indigo-500 h-1.5 transition-all duration-1000 shadow-[0_0_8px_rgba(99,102,241,0.8)]" style={{ width: `${Math.min(containerStats[container._id].cpuPercent, 100)}%` }}></div>
                                                            </div>
                                                        </div>
                                                        <div>
                                                            <div className="flex justify-between items-center text-[10px] uppercase tracking-widest mb-2 font-display">
                                                                <span className="text-slate-400">Memory Matrix</span>
                                                                <span className="font-bold text-emerald-400">
                                                                    {(containerStats[container._id].memUsage / 1024 / 1024).toFixed(1)} MB / {(containerStats[container._id].memLimit / 1024 / 1024).toFixed(0)} MB
                                                                </span>
                                                            </div>
                                                            <div className="w-full bg-[#030305] border border-surface-border rounded-sm h-1.5 overflow-hidden">
                                                                <div className="bg-emerald-500 h-1.5 transition-all duration-1000 shadow-[0_0_8px_rgba(16,185,129,0.8)]" style={{ width: `${containerStats[container._id].memPercent}%` }}></div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="text-[10px] uppercase tracking-widest font-display text-brand-500 flex items-center h-full">
                                                        <RefreshCw className="animate-spin mr-2" size={14} /> Synchronizing Data...
                                                    </div>
                                                )
                                            ) : (
                                                <div className="text-[10px] uppercase tracking-widest font-display text-rose-500/80 h-full flex items-center">
                                                    Engine Offline
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div className="flex flex-wrap gap-3 pt-6 border-t border-surface-border">
                                <button
                                    onClick={() => toggleExpand(container)}
                                    className="p-2.5 bg-surface hover:bg-surface-hover text-slate-400 border border-surface-border rounded-sm transition-aero shrink-0"
                                    title="Diagnostics"
                                >
                                    {expandedContainers[container._id] ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                                </button>

                                {container.state === 'running' ? (
                                    <>
                                        <button
                                            onClick={() => handleAction(container._id, 'stop')}
                                            className="flex-1 min-w-[100px] bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 border border-amber-500/30 hover:border-amber-500 py-2 rounded-sm font-display text-[10px] font-bold uppercase tracking-[0.2em] transition-aero flex items-center justify-center space-x-2"
                                        >
                                            <Square size={14} /> <span>Halt</span>
                                        </button>

                                        <button
                                            onClick={() => setRedeployConfirm({ id: container._id, name: container.name, image: container.image })}
                                            className="flex-1 min-w-[100px] bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 hover:border-indigo-500 py-2 rounded-sm font-display text-[10px] font-bold uppercase tracking-[0.2em] transition-aero flex items-center justify-center space-x-2"
                                        >
                                            <RefreshCw size={14} /> <span>Cycle</span>
                                        </button>

                                        <button
                                            onClick={() => setActiveTerminal({ id: container.dockerId, name: container.name })}
                                            className="flex-1 min-w-[100px] bg-brand-500/10 hover:bg-brand-500/20 text-brand-400 border border-brand-500/30 hover:border-brand-500 hover:shadow-hud py-2 rounded-sm font-display text-[10px] font-bold uppercase tracking-[0.2em] transition-aero flex items-center justify-center space-x-2"
                                        >
                                            <MonitorPlay size={14} /> <span>Link</span>
                                        </button>
                                    </>
                                ) : (
                                    <button
                                        onClick={() => handleAction(container._id, 'start')}
                                        className="flex-1 min-w-[100px] bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:border-emerald-500 py-2 rounded-sm font-display text-[10px] font-bold uppercase tracking-[0.2em] transition-aero flex items-center justify-center space-x-2 shadow-[0_0_10px_rgba(16,185,129,0.1)] hover:shadow-[0_0_15px_rgba(16,185,129,0.2)]"
                                    >
                                        <Play size={14} /> <span>Ignite</span>
                                    </button>
                                )}

                                <button
                                    onClick={() => fetchLogs(container._id, container.name)}
                                    className="flex-1 min-w-[100px] bg-surface hover:bg-surface-hover text-slate-300 hover:text-white border border-surface-border hover:border-slate-500 py-2 rounded-sm font-display text-[10px] font-bold uppercase tracking-[0.2em] transition-aero flex items-center justify-center space-x-2 shadow-inner"
                                >
                                    <Terminal size={14} /> <span>Logs</span>
                                </button>

                                <button
                                    onClick={() => {
                                        if (window.confirm(`Are you sure you want to completely delete ${container.name}? This will destroy all unsaved data not mapped to a volume.`)) {
                                            handleAction(container._id, 'delete');
                                        }
                                    }}
                                    className="flex-[2] min-w-[120px] bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 border border-rose-500/30 hover:border-rose-500 py-2 rounded-sm font-display text-[10px] font-bold uppercase tracking-[0.2em] transition-aero flex items-center justify-center space-x-2"
                                >
                                    <Trash2 size={14} /> <span>Destroy</span>
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
                <div className="fixed inset-0 bg-[#050508]/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
                    <div className="panel-glass w-full max-w-lg rounded-sm shadow-hud overflow-hidden animate-in fade-in zoom-in-95 duration-300">
                        <div className="p-6 border-b border-surface-border flex justify-between items-center bg-surface/80">
                            <h3 className="text-sm font-display font-bold text-white flex items-center uppercase tracking-widest">
                                <Globe className="mr-3 text-brand-500" size={18} /> Network Uplink
                            </h3>
                            <button onClick={() => setEditModalOpen(false)} className="text-slate-500 hover:text-white transition-colors">
                                <Square size={16} className="stroke-[2px]" />
                            </button>
                        </div>

                        <form onSubmit={submitEdit} className="p-8">
                            <p className="text-xs text-slate-400 mb-8 leading-relaxed font-mono">
                                Establish a secure routing protocol to the public internet via internal Traefik gateways.
                            </p>

                            <div className="space-y-6">
                                <div>
                                    <label className="block text-[10px] font-display font-bold text-slate-500 uppercase tracking-widest mb-2">
                                        Ingress Domain
                                    </label>
                                    <input
                                        type="text"
                                        value={editDomain}
                                        onChange={(e) => setEditDomain(e.target.value)}
                                        placeholder="e.g. app.orbitcloud.app"
                                        className="w-full px-4 py-3 bg-[#030305] border border-surface-border rounded-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none text-white transition-aero text-sm font-mono shadow-inner"
                                    />
                                </div>
                                {editDomain.trim() !== '' && (
                                    <div className="animate-in fade-in">
                                        <label className="block text-[10px] font-display font-bold text-slate-500 uppercase tracking-widest mb-2">
                                            Target Port (Internal)
                                        </label>
                                        <input
                                            type="number"
                                            value={editPort}
                                            onChange={(e) => setEditPort(e.target.value)}
                                            required={editDomain.trim() !== ''}
                                            placeholder="e.g. 80"
                                            className="w-full px-4 py-3 bg-[#030305] border border-surface-border rounded-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none text-white transition-aero text-sm font-mono shadow-inner"
                                        />
                                    </div>
                                )}
                            </div>

                            <div className="mt-10 flex justify-end space-x-4 pt-6 border-t border-surface-border">
                                <button type="button" onClick={() => setEditModalOpen(false)} className="px-6 py-2 bg-surface hover:bg-surface-hover text-slate-400 border border-surface-border rounded-sm font-display text-[10px] font-bold uppercase tracking-widest transition-aero">
                                    Abort
                                </button>
                                <button type="submit" className="px-6 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-sm font-display text-[10px] font-bold uppercase tracking-widest transition-aero shadow-[0_0_15px_rgba(220,38,38,0.3)]">
                                    Establish Link
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Redeploy Confirmation Modal */}
            {redeployConfirm && (
                <div className="fixed inset-0 bg-[#050508]/80 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in duration-300">
                    <div className="panel-glass w-full max-w-md rounded-sm shadow-hud overflow-hidden border border-amber-500/30">
                        <div className="p-6 border-b border-surface-border flex items-center bg-surface/80">
                            <AlertTriangle className="mr-3 text-amber-500" size={20} />
                            <h3 className="text-sm font-display font-bold text-white uppercase tracking-widest">
                                Confirm Cycle
                            </h3>
                        </div>
                        <div className="p-6 text-slate-300 space-y-4 text-sm leading-relaxed">
                            <p className="font-mono text-xs text-slate-400">
                                Executing Zero-Downtime update protocol for <strong className="text-white">{redeployConfirm.name}</strong>.
                            </p>
                            <div className="bg-amber-500/10 border border-amber-500/20 p-5 rounded-sm text-amber-400 shadow-inner">
                                <h4 className="font-display text-[10px] font-bold mb-3 uppercase tracking-widest text-amber-500">Critical Warning</h4>
                                <ul className="list-disc pl-5 space-y-2 text-xs font-mono text-amber-200/70">
                                    <li>Data strictly inside the local container filesystem will be incinerated.</li>
                                    <li>Do NOT cycle Database images (MySQL, Mongo) without persistent volumes mapped.</li>
                                </ul>
                            </div>
                        </div>
                        <div className="p-6 bg-surface/50 border-t border-surface-border flex justify-end space-x-4">
                            <button
                                onClick={() => setRedeployConfirm(null)}
                                className="px-6 py-2 bg-surface hover:bg-surface-hover text-slate-400 border border-surface-border rounded-sm font-display text-[10px] font-bold uppercase tracking-widest transition-aero">
                                Cancel
                            </button>
                            <button
                                onClick={() => {
                                    handleRedeploy(redeployConfirm.id, redeployConfirm.name, redeployConfirm.image);
                                    setRedeployConfirm(null);
                                }}
                                className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-sm font-display text-[10px] font-bold uppercase tracking-widest transition-aero shadow-[0_0_15px_rgba(79,70,229,0.3)]">
                                Authorize
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Snapshot Modal */}
            {snapshotModalOpen && snapshotContainer && (
                <div className="fixed inset-0 bg-[#050508]/80 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in duration-300">
                    <div className="panel-glass w-full max-w-md rounded-sm shadow-hud overflow-hidden border border-indigo-500/30">
                        <div className="p-6 border-b border-surface-border flex items-center bg-surface/80">
                            <Camera className="mr-3 text-indigo-400" size={20} />
                            <h3 className="text-sm font-display font-bold text-white uppercase tracking-widest">
                                Blueprint Capture
                            </h3>
                        </div>

                        <form onSubmit={submitSnapshot} className="p-8">
                            <p className="font-mono text-xs text-slate-400 mb-6 leading-relaxed">
                                Creating an immutable Docker Image backup for <strong className="text-white">{snapshotContainer.name}</strong>.
                            </p>

                            <label className="block text-[10px] font-display font-bold text-slate-500 uppercase tracking-widest mb-2">
                                Output Tag Name <span className="text-brand-500">*</span>
                            </label>
                            <input
                                type="text"
                                required
                                value={snapshotName}
                                onChange={(e) => setSnapshotName(e.target.value)}
                                className="w-full px-4 py-3 bg-[#030305] border border-surface-border rounded-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none text-white transition-aero text-sm font-mono shadow-inner mb-4"
                            />

                            <div className="mt-8 pt-6 border-t border-surface-border flex justify-end space-x-4">
                                <button
                                    type="button"
                                    onClick={() => setSnapshotModalOpen(false)}
                                    className="px-6 py-2 bg-surface hover:bg-surface-hover text-slate-400 border border-surface-border rounded-sm font-display text-[10px] font-bold uppercase tracking-widest transition-aero"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={!snapshotName}
                                    className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-sm font-display text-[10px] font-bold uppercase tracking-widest transition-aero shadow-[0_0_15px_rgba(79,70,229,0.3)]"
                                >
                                    Compile
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
