import React, { useEffect, useState, useRef } from 'react';
import { Server, Play, Square, Trash2, RefreshCw, Terminal, Activity, AlertTriangle, MonitorPlay, ChevronDown, ChevronUp, Network, Settings, Camera, Search, MoreVertical } from 'lucide-react';
import axios from 'axios';
import { io } from 'socket.io-client';
import TerminalModal from '../components/TerminalModal';
import LiveLogsModal from '../components/LiveLogsModal';
import { useToast } from '../components/ToastContext';
import { useOrg } from '../context/OrgContext';
import { resolveLimits } from '../utils/planLimits';

const ViewContainers = () => {
    const { activeOrg } = useOrg();
    const [containers, setContainers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [refreshing, setRefreshing] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    
    // Modals & Terminals
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
            setUserLimits(resolveLimits(userRes.data));

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
            const endpoint = action === 'delete' ? `/api/containers/${id}` : `/api/containers/${id}/${action}`; 
            const method = action === 'delete' ? 'delete' : 'post';

            await axios[method](endpoint, action === 'delete' ? {} : {});

            if (action === 'start') addToast('Success', 'Container started successfully', 'success');
            else if (action === 'stop') addToast('Success', 'Container stopped', 'warning');
            else if (action === 'delete') addToast('Success', 'Container deleted', 'success');

            fetchContainers();
        } catch (err) {
            addToast('Error', `Could not ${action} container`, 'error');
        }
    };

    const handleRedeploy = async (id, name, image) => {
        try {
            addToast('Info', `Redeploying ${name}...`, 'info');
            await axios.put(`/api/containers/${id}/redeploy`, {});
            addToast('Success', `${name} redeployed successfully.`, 'success');
            fetchContainers();
        } catch (err) {
            addToast('Error', err.response?.data?.message || 'Redeploy failed.', 'error');
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
            setEditModalOpen(false);
            await axios.put(`/api/containers/${editingContainer._id}/edit`, {
                domain: editDomain,
                domainPort: editPort
            });
            addToast('Success', 'Routing updated.', 'success');
            fetchContainers();
        } catch (err) {
            addToast('Error', err.response?.data?.message || 'Update failed.', 'error');
        }
    };

    const openSnapshotModal = (container) => {
        if (!userLimits || userLimits.maxSnapshots === 0) {
            addToast('Upgrade Required', 'Snapshots require Pro or Enterprise plans.', 'warning');
            return;
        }
        setSnapshotContainer(container);
        setSnapshotName(`${container.image.split(':')[0]}-backup-${new Date().toISOString().split('T')[0]}`);
        setSnapshotModalOpen(true);
    };

    const submitSnapshot = async (e) => {
        e.preventDefault();
        try {
            setSnapshotModalOpen(false);
            await axios.post(`/api/containers/${snapshotContainer.dockerId}/snapshot`, {
                snapshotName: snapshotName
            });
            addToast('Success', 'Snapshot created.', 'success');
        } catch (err) {
            addToast('Error', 'Snapshot failed.', 'error');
        }
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

    const filteredContainers = containers.filter(c => 
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
        c.image.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="text-gray-900 dark:text-slate-100">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 space-y-4 sm:space-y-0">
                <div>
                    <h1 className="text-2xl font-bold mb-1">Instances</h1>
                    <p className="text-sm text-gray-500 dark:text-slate-400">View and manage your container fleet.</p>
                </div>
                <div className="flex w-full sm:w-auto space-x-3">
                    <div className="relative">
                        <Search size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                        <input 
                            type="text" 
                            placeholder="Search instances..." 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-9 pr-4 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-1 focus:ring-brand-500 outline-none w-full sm:w-64"
                        />
                    </div>
                    <button
                        onClick={fetchContainers}
                        disabled={refreshing}
                        className="btn-secondary px-3"
                    >
                        <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
                    </button>
                </div>
            </div>

            {error && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm p-4 rounded mb-6 flex items-center">
                    <AlertTriangle size={18} className="mr-2 shrink-0" />
                    <span>{error}</span>
                </div>
            )}

            <div className="panel overflow-visible">
                <table className="table-industrial w-full">
                    <thead>
                        <tr>
                            <th className="w-10"></th>
                            <th>Name</th>
                            <th>Status</th>
                            <th>Image</th>
                            <th>Ports</th>
                            <th className="text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr>
                                <td colSpan="6" className="text-center py-10">
                                    <RefreshCw size={24} className="animate-spin mx-auto text-brand-500 mb-2" />
                                    <span className="text-sm text-gray-500">Loading instances...</span>
                                </td>
                            </tr>
                        ) : filteredContainers.length === 0 ? (
                            <tr>
                                <td colSpan="6" className="text-center py-10">
                                    <span className="text-sm text-gray-500">No instances found.</span>
                                </td>
                            </tr>
                        ) : (
                            filteredContainers.map(container => (
                                <React.Fragment key={container._id}>
                                    <tr className={`border-l-[3px] ${container.state === 'running' ? 'border-l-green-500' : 'border-l-red-500'}`}>
                                        <td className="text-center">
                                            <button onClick={() => toggleExpand(container)} className="p-1 hover:bg-gray-200 dark:hover:bg-slate-700 rounded text-gray-500">
                                                {expandedContainers[container._id] ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                            </button>
                                        </td>
                                        <td>
                                            <div className="font-semibold text-gray-900 dark:text-white">{container.name}</div>
                                            <div className="text-xs text-gray-500 font-mono mt-0.5" title={container.dockerId}>{container.dockerId.substring(0, 12)}</div>
                                        </td>
                                        <td>
                                            {container.state === 'running' ? (
                                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                                                    Running
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">
                                                    Stopped
                                                </span>
                                            )}
                                        </td>
                                        <td className="font-mono text-xs">{container.image}</td>
                                        <td className="font-mono text-xs">
                                            {container.ports && Object.keys(container.ports).length > 0
                                                ? Object.keys(container.ports).map(p => p.split('/')[0]).join(', ')
                                                : '-'}
                                        </td>
                                        <td className="text-right whitespace-nowrap">
                                            <div className="flex items-center justify-end space-x-2">
                                                {container.state === 'running' ? (
                                                    <>
                                                        <div className="relative group/tooltip">
                                                            <button onClick={() => handleAction(container._id, 'stop')} className="text-gray-500 hover:text-amber-600 dark:hover:text-amber-500 p-1.5 rounded hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors">
                                                                <Square size={16} />
                                                            </button>
                                                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover/tooltip:block bg-slate-800 text-white text-[10px] px-2 py-1 rounded whitespace-nowrap z-[100] font-medium shadow-sm">Stop Instance</div>
                                                        </div>
                                                        <div className="relative group/tooltip">
                                                            <button onClick={() => setRedeployConfirm({ id: container._id, name: container.name, image: container.image })} className="text-gray-500 hover:text-brand-600 dark:hover:text-brand-500 p-1.5 rounded hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors">
                                                                <RefreshCw size={16} />
                                                            </button>
                                                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover/tooltip:block bg-slate-800 text-white text-[10px] px-2 py-1 rounded whitespace-nowrap z-[100] font-medium shadow-sm">Redeploy</div>
                                                        </div>
                                                        <div className="relative group/tooltip">
                                                            <button onClick={() => setActiveTerminal({ id: container.dockerId, name: container.name })} className="text-gray-500 hover:text-gray-900 dark:hover:text-white p-1.5 rounded hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors">
                                                                <MonitorPlay size={16} />
                                                            </button>
                                                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover/tooltip:block bg-slate-800 text-white text-[10px] px-2 py-1 rounded whitespace-nowrap z-[100] font-medium shadow-sm">Open Terminal</div>
                                                        </div>
                                                    </>
                                                ) : (
                                                    <div className="relative group/tooltip">
                                                        <button onClick={() => handleAction(container._id, 'start')} className="text-gray-500 hover:text-green-600 dark:hover:text-green-500 p-1.5 rounded hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors">
                                                            <Play size={16} />
                                                        </button>
                                                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover/tooltip:block bg-slate-800 text-white text-[10px] px-2 py-1 rounded whitespace-nowrap z-[100] font-medium shadow-sm">Start Instance</div>
                                                    </div>
                                                )}
                                                
                                                <div className="relative group/tooltip">
                                                    <button onClick={() => setLiveLogsTerminal({ id: container._id, name: container.name })} className="text-gray-500 hover:text-gray-900 dark:hover:text-white p-1.5 rounded hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors">
                                                        <Terminal size={16} />
                                                    </button>
                                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover/tooltip:block bg-slate-800 text-white text-[10px] px-2 py-1 rounded whitespace-nowrap z-[100] font-medium shadow-sm">View Logs</div>
                                                </div>
                                                
                                                <div className="relative group inline-block text-left">
                                                    <button className="text-gray-500 p-1.5 rounded hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors">
                                                        <MoreVertical size={16} />
                                                    </button>
                                                    <div className="origin-top-right absolute right-0 mt-1 w-48 rounded shadow-sm bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 ring-1 ring-black ring-opacity-5 invisible group-hover:visible opacity-0 group-hover:opacity-100 transition-all z-[100]">
                                                        <div className="py-1">
                                                            <button onClick={() => openEditModal(container)} className="flex w-full items-center px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700">
                                                                <Settings size={14} className="mr-2" /> Networking
                                                            </button>
                                                            <button onClick={() => openSnapshotModal(container)} className="flex w-full items-center px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700">
                                                                <Camera size={14} className="mr-2" /> Snapshot
                                                            </button>
                                                            <button onClick={() => { if (window.confirm(`Delete ${container.name}?`)) handleAction(container._id, 'delete'); }} className="flex w-full items-center px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 border-t border-gray-100 dark:border-slate-700">
                                                                <Trash2 size={14} className="mr-2" /> Delete
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                    {expandedContainers[container._id] && (
                                        <tr className="bg-gray-50/50 dark:bg-slate-800/30">
                                            <td></td>
                                            <td colSpan="5" className="px-4 py-4">
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 text-sm">
                                                    <div>
                                                        <h4 className="font-semibold text-gray-900 dark:text-white mb-2 flex items-center"><Network size={14} className="mr-2 text-gray-500" /> Network</h4>
                                                        <div className="space-y-1 text-gray-600 dark:text-slate-400">
                                                            <div className="flex justify-between"><span className="text-gray-500">Internal IP</span> <span className="font-mono">{containerStats[container._id]?.ipv4Address || container.ipv4Address || '-'}</span></div>
                                                            <div className="flex justify-between"><span className="text-gray-500">Mode</span> <span className="font-mono">{containerStats[container._id]?.networkMode || container.networkMode || 'bridge'}</span></div>
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <h4 className="font-semibold text-gray-900 dark:text-white mb-2 flex items-center"><Activity size={14} className="mr-2 text-gray-500" /> Telemetry</h4>
                                                        {container.state === 'running' ? (
                                                            containerStats[container._id] ? (
                                                                <div className="space-y-2">
                                                                    <div>
                                                                        <div className="flex justify-between text-xs mb-1"><span className="text-gray-500">CPU Usage</span><span className="font-mono">{containerStats[container._id].cpuPercent}%</span></div>
                                                                        <div className="w-full bg-gray-200 dark:bg-slate-700 rounded-sm h-1.5"><div className="bg-brand-500 h-1.5 rounded-sm" style={{ width: `${Math.min(containerStats[container._id].cpuPercent, 100)}%` }}></div></div>
                                                                    </div>
                                                                    <div>
                                                                        <div className="flex justify-between text-xs mb-1"><span className="text-gray-500">Memory</span><span className="font-mono">{(containerStats[container._id].memUsage / 1024 / 1024).toFixed(1)} MB</span></div>
                                                                        <div className="w-full bg-gray-200 dark:bg-slate-700 rounded-sm h-1.5"><div className="bg-green-500 h-1.5 rounded-sm" style={{ width: `${containerStats[container._id].memPercent}%` }}></div></div>
                                                                    </div>
                                                                </div>
                                                            ) : <div className="text-xs text-gray-500 flex items-center"><RefreshCw className="animate-spin mr-1" size={12} /> Loading stats...</div>
                                                        ) : <div className="text-xs text-gray-500">Offline</div>}
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Live Logs Terminal Modal */}
            {liveLogsTerminal && (
                <LiveLogsModal containerId={liveLogsTerminal.id} containerName={liveLogsTerminal.name} onClose={() => setLiveLogsTerminal(null)} />
            )}

            {/* Terminal Modal */}
            {activeTerminal && (
                <TerminalModal containerId={activeTerminal.id} containerName={activeTerminal.name} onClose={() => setActiveTerminal(null)} />
            )}

            {/* Edit / Settings Modal */}
            {editModalOpen && editingContainer && (
                <div className="fixed inset-0 bg-gray-900/50 dark:bg-slate-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-slate-800 w-full max-w-lg rounded shadow-sm overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-200 dark:border-slate-700">
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Network Settings</h3>
                        </div>
                        <form onSubmit={submitEdit} className="p-6">
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Domain</label>
                                    <input type="text" value={editDomain} onChange={(e) => setEditDomain(e.target.value)} className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-900 text-gray-900 dark:text-white focus:ring-1 focus:ring-brand-500 outline-none text-sm" />
                                </div>
                                {editDomain.trim() !== '' && (
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Internal Port</label>
                                        <input type="number" value={editPort} onChange={(e) => setEditPort(e.target.value)} className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-900 text-gray-900 dark:text-white focus:ring-1 focus:ring-brand-500 outline-none text-sm" />
                                    </div>
                                )}
                            </div>
                            <div className="mt-6 flex justify-end space-x-3">
                                <button type="button" onClick={() => setEditModalOpen(false)} className="btn-secondary">Cancel</button>
                                <button type="submit" className="btn-primary">Save Changes</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Redeploy Modal */}
            {redeployConfirm && (
                <div className="fixed inset-0 bg-gray-900/50 dark:bg-slate-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-slate-800 w-full max-w-md rounded shadow-sm overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-200 dark:border-slate-700 flex items-center">
                            <AlertTriangle className="text-amber-500 mr-2" size={20} />
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Redeploy Instance</h3>
                        </div>
                        <div className="p-6 text-sm text-gray-600 dark:text-slate-300 space-y-4">
                            <p>This will pull the latest <strong>{redeployConfirm.image}</strong> image and restart <strong>{redeployConfirm.name}</strong>.</p>
                            <p className="text-amber-600 dark:text-amber-500">Warning: Ephemeral data inside the container will be lost.</p>
                        </div>
                        <div className="px-6 py-4 bg-gray-50 dark:bg-slate-800/50 flex justify-end space-x-3">
                            <button onClick={() => setRedeployConfirm(null)} className="btn-secondary">Cancel</button>
                            <button onClick={() => { handleRedeploy(redeployConfirm.id, redeployConfirm.name, redeployConfirm.image); setRedeployConfirm(null); }} className="btn-primary">Confirm Redeploy</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Snapshot Modal */}
            {snapshotModalOpen && snapshotContainer && (
                <div className="fixed inset-0 bg-gray-900/50 dark:bg-slate-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-slate-800 w-full max-w-md rounded shadow-sm overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-200 dark:border-slate-700 flex items-center">
                            <Camera className="text-brand-500 mr-2" size={20} />
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Create Snapshot</h3>
                        </div>
                        <form onSubmit={submitSnapshot} className="p-6">
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Snapshot Tag</label>
                                    <input type="text" required value={snapshotName} onChange={(e) => setSnapshotName(e.target.value)} className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-900 text-gray-900 dark:text-white focus:ring-1 focus:ring-brand-500 outline-none text-sm font-mono" />
                                </div>
                            </div>
                            <div className="mt-6 flex justify-end space-x-3">
                                <button type="button" onClick={() => setSnapshotModalOpen(false)} className="btn-secondary">Cancel</button>
                                <button type="submit" disabled={!snapshotName} className="btn-primary">Create Snapshot</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ViewContainers;
