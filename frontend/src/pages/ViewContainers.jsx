import React, { useEffect, useState, useRef } from 'react';
import { Server, Play, Square, Trash2, Cpu, RefreshCw, Terminal, Activity, AlertTriangle, MonitorPlay } from 'lucide-react';
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
    const [activeTerminal, setActiveTerminal] = useState(null);
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

    return (
        <div className="p-8 pb-20 text-white max-w-7xl mx-auto">
            <div className="flex items-center justify-between mb-10">
                <div>
                    <h1 className="text-4xl font-extrabold tracking-tight mb-2">My Containers</h1>
                    <p className="text-slate-400 text-lg">Manage and monitor your deployed instances.</p>
                </div>
                <div className="flex space-x-3">
                    <button
                        onClick={() => addToast('Test System', 'If you see this, Toast CSS works', 'success')}
                        className="bg-brand-500 hover:bg-brand-400 text-white px-4 py-2 rounded-xl transition-all font-bold"
                    >
                        Test Notification
                    </button>
                    <button
                        onClick={fetchContainers}
                        disabled={refreshing}
                        className="bg-slate-800 hover:bg-slate-700 border border-slate-700 p-3 rounded-xl transition-all"
                    >
                        <RefreshCw size={24} className={`text-slate-300 ${refreshing ? 'animate-spin' : ''}`} />
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
                <div className="text-center py-20 bg-slate-800/50 border border-slate-700 rounded-3xl">
                    <Server size={64} className="mx-auto text-slate-600 mb-6" />
                    <h3 className="text-2xl font-bold mb-2">No containers found</h3>
                    <p className="text-slate-400">You haven't deployed any containers yet.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                    {containers.map(container => (
                        <div key={container._id} className="bg-slate-800 border border-slate-700 rounded-2xl p-6 shadow-lg hover:border-slate-500 transition-colors">
                            <div className="flex justify-between items-start mb-6">
                                <div className="flex items-center space-x-4">
                                    <div className={`p-4 rounded-2xl ${container.state === 'running' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
                                        }`}>
                                        {container.state === 'running' ? <Activity size={28} /> : <Square size={28} />}
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-bold">{container.name}</h3>
                                        <p className="text-slate-400 font-mono text-sm mt-1">{container.image}</p>
                                    </div>
                                </div>
                                <div className={`px-4 py-1.5 rounded-full text-sm font-semibold border ${container.state === 'running' ? 'bg-emerald-900/30 border-emerald-500/50 text-emerald-400' : 'bg-rose-900/30 border-rose-500/50 text-rose-400'
                                    }`}>
                                    {container.state ? container.state.toUpperCase() : 'UNKNOWN'}
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4 mb-6">
                                <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-700/50">
                                    <p className="text-xs text-slate-500 mb-1 uppercase tracking-wider font-semibold">Ports Exposed</p>
                                    <p className="font-mono text-sm">
                                        {container.ports && Object.keys(container.ports).length > 0
                                            ? Object.keys(container.ports).join(', ')
                                            : 'None'}
                                    </p>
                                </div>
                                <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-700/50">
                                    <p className="text-xs text-slate-500 mb-1 uppercase tracking-wider font-semibold">Docker ID</p>
                                    <p className="font-mono text-sm truncate" title={container.dockerId}>
                                        {container.dockerId.substring(0, 12)}...
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center space-x-3 pt-6 border-t border-slate-700/50">
                                {container.state === 'running' ? (
                                    <>
                                        <button
                                            onClick={() => handleAction(container._id, 'stop')}
                                            className="flex-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 border border-amber-500/20 py-2.5 rounded-xl font-medium transition-colors flex items-center justify-center space-x-2"
                                        >
                                            <Square size={16} /> <span>Stop</span>
                                        </button>

                                        <button
                                            onClick={() => setActiveTerminal({ id: container.dockerId, name: container.name })}
                                            className="flex-1 bg-brand-500/10 hover:bg-brand-500/20 text-brand-400 border border-brand-500/20 py-2.5 rounded-xl font-medium transition-colors flex items-center justify-center space-x-2"
                                        >
                                            <MonitorPlay size={16} /> <span>Console</span>
                                        </button>
                                    </>
                                ) : (
                                    <button
                                        onClick={() => handleAction(container._id, 'start')}
                                        className="flex-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 border border-emerald-500/20 py-2.5 rounded-xl font-medium transition-colors flex items-center justify-center space-x-2"
                                    >
                                        <Play size={16} /> <span>Start</span>
                                    </button>
                                )}

                                <button
                                    onClick={() => fetchLogs(container._id, container.name)}
                                    className="flex-1 bg-slate-700 hover:bg-slate-600 text-white py-2.5 rounded-xl font-medium transition-colors flex items-center justify-center space-x-2"
                                >
                                    <Terminal size={16} /> <span>Logs</span>
                                </button>

                                <button
                                    onClick={() => handleAction(container._id, 'delete')}
                                    className="flex-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 py-2.5 rounded-xl font-medium transition-colors flex items-center justify-center space-x-2"
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
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-8">
                    <div className="bg-slate-900 border border-slate-700 w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden flex flex-col h-[80vh]">
                        <div className="p-4 bg-slate-800 border-b border-slate-700 flex justify-between items-center">
                            <h3 className="font-bold flex items-center text-lg"><Terminal className="mr-2 text-brand-400" /> Logs: {selectedLogs.name}</h3>
                            <button onClick={() => setSelectedLogs(null)} className="text-slate-400 hover:text-white transition-colors">
                                Close
                            </button>
                        </div>
                        <div className="p-6 overflow-y-auto flex-1 font-mono text-sm text-green-400 whitespace-pre-wrap leading-relaxed">
                            {selectedLogs.content || 'No logs available.'}
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
