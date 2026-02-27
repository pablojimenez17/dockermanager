import React, { useEffect, useState, useRef } from 'react';
import { Users, Server, ShieldAlert, Trash2, MonitorPlay, Terminal } from 'lucide-react';
import axios from 'axios';
import { io } from 'socket.io-client';
import TerminalModal from '../components/TerminalModal';
import { useToast } from '../components/ToastContext';

const AdminDashboard = () => {
    const [users, setUsers] = useState([]);
    const [containers, setContainers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [activeTerminal, setActiveTerminal] = useState(null);
    const { addToast } = useToast();
    const [selectedLogs, setSelectedLogs] = useState(null);

    // Keep ref to latest containers for socket closure
    const containersRef = useRef([]);
    useEffect(() => { containersRef.current = containers; }, [containers]);

    const fetchData = async () => {
        try {
            const token = localStorage.getItem('token');
            const [usersRes, containersRes] = await Promise.all([
                axios.get('http://localhost:5000/api/admin/users', { headers: { Authorization: `Bearer ${token}` } }),
                axios.get('http://localhost:5000/api/admin/containers', { headers: { Authorization: `Bearer ${token}` } })
            ]);
            setUsers(usersRes.data);
            setContainers(containersRes.data);
        } catch (err) {
            setError(err.response?.data?.message || 'Error fetching admin data');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 30000);

        // Setup Real-time Docker events socket
        const socket = io('http://localhost:5000');

        socket.on('container:status_change', ({ dockerId, status }) => {
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

    const handleForceDelete = async (id) => {
        if (!window.confirm("Are you sure you want to forcibly remove this container for this user?")) return;
        try {
            const token = localStorage.getItem('token');
            const targetContainer = containers.find(c => c._id === id);
            const cName = targetContainer ? targetContainer.name : 'Container';

            await axios.delete(`http://localhost:5000/api/admin/containers/${id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            addToast('Container Deleted', `Forcefully unlinked and removed ${cName}`, 'error');
            fetchData();
        } catch (err) {
            alert(err.response?.data?.message || 'Error deleting container');
            addToast('Delete Failed', 'Admin override failed to remove container.', 'error');
        }
    };

    if (loading) return <div className="p-8 text-white">Loading admin resources...</div>;

    if (error) return (
        <div className="p-8 text-white max-w-4xl mx-auto">
            <div className="bg-red-500/10 border border-red-500/50 text-red-500 p-6 rounded-2xl flex items-center mb-8">
                <ShieldAlert className="mr-3" size={32} />
                <div>
                    <h2 className="text-xl font-bold">Access Denied</h2>
                    <p>{error}</p>
                </div>
            </div>
        </div>
    );

    return (
        <div className="p-8 pb-20 text-white max-w-6xl mx-auto">
            <div className="mb-10 flex items-center space-x-4">
                <ShieldAlert className="text-purple-500" size={40} />
                <div>
                    <h1 className="text-4xl font-extrabold tracking-tight mb-2">Admin Control Panel</h1>
                    <p className="text-slate-400 text-lg">System-wide overview of users and container resources.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
                <div className="bg-slate-800 border border-slate-700 p-6 rounded-3xl shadow-lg relative overflow-hidden group col-span-1">
                    <div className="absolute top-0 right-0 p-6 opacity-10 text-purple-400 group-hover:scale-110 transition-transform duration-500">
                        <Users size={64} />
                    </div>
                    <div className="relative z-10">
                        <h3 className="text-purple-400 font-medium mb-1">Total Users</h3>
                        <div className="text-5xl font-bold flex items-center space-x-3">
                            <span>{users.length}</span>
                        </div>
                    </div>
                </div>

                <div className="bg-slate-800 border border-slate-700 rounded-3xl p-6 shadow-lg col-span-2 overflow-x-auto">
                    <h3 className="font-bold mb-4 border-b border-slate-700 pb-2">Registered Users</h3>
                    <table className="w-full text-left text-sm">
                        <thead>
                            <tr className="text-slate-400">
                                <th className="pb-2">Username</th>
                                <th className="pb-2">Role</th>
                                <th className="pb-2">Joined</th>
                            </tr>
                        </thead>
                        <tbody>
                            {users.map(u => (
                                <tr key={u._id} className="border-t border-slate-700/50">
                                    <td className="py-3 font-medium">{u.username}</td>
                                    <td className="py-3">
                                        <span className={`px-2 py-1 rounded text-xs ${u.role === 'admin' ? 'bg-purple-500/20 text-purple-400' : 'bg-slate-700'}`}>
                                            {u.role.toUpperCase()}
                                        </span>
                                    </td>
                                    <td className="py-3 text-slate-400">{new Date(u.createdAt).toLocaleDateString()}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="bg-slate-800 border border-slate-700 rounded-3xl p-8 shadow-xl">
                <h3 className="text-xl font-bold mb-6 flex items-center space-x-2 border-b border-slate-700 pb-4">
                    <Server className="text-brand-400" />
                    <span>Global Container Instances ({containers.length})</span>
                </h3>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead>
                            <tr className="text-slate-400 bg-slate-900/50">
                                <th className="p-4 rounded-tl-xl">Container</th>
                                <th className="p-4">Owner</th>
                                <th className="p-4">Image</th>
                                <th className="p-4">State</th>
                                <th className="p-4 rounded-tr-xl">Admin Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {containers.map(c => (
                                <tr key={c._id} className="border-b border-slate-700/50 hover:bg-slate-700/20 transition-colors">
                                    <td className="p-4 font-medium">{c.name} <br /><span className="text-xs text-slate-500 font-mono">{c.dockerId.substring(0, 8)}</span></td>
                                    <td className="p-4">{c.owner}</td>
                                    <td className="p-4 font-mono text-xs text-brand-300">{c.image}</td>
                                    <td className="p-4">
                                        <span className={`px-2 py-1 rounded-full border text-xs font-semibold ${c.state === 'running' ? 'bg-emerald-900/30 border-emerald-500/50 text-emerald-400' : 'bg-rose-900/30 border-rose-500/50 text-rose-400'
                                            }`}>
                                            {c.state ? c.state.toUpperCase() : 'UNKNOWN'}
                                        </span>
                                    </td>
                                    <td className="p-4 flex space-x-2">
                                        {c.state === 'running' && (
                                            <button
                                                onClick={() => setActiveTerminal({ id: c.dockerId, name: c.name })}
                                                className="p-2 bg-brand-500/10 text-brand-400 hover:bg-brand-500/20 rounded-lg transition-colors border border-brand-500/20"
                                                title="Open Terminal"
                                            >
                                                <MonitorPlay size={16} />
                                            </button>
                                        )}
                                        <button
                                            onClick={() => handleForceDelete(c._id)}
                                            className="p-2 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 rounded-lg transition-colors border border-rose-500/20"
                                            title="Force Delete Container"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {containers.length === 0 && (
                                <tr>
                                    <td colSpan="5" className="p-8 text-center text-slate-400">No containers found on the host.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Terminal Modal */}
            {activeTerminal && (
                <TerminalModal
                    containerId={activeTerminal.id}
                    containerName={activeTerminal.name}
                    onClose={() => setActiveTerminal(null)}
                />
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
        </div>
    );
};

export default AdminDashboard;
