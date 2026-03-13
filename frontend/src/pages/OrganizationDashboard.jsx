import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useOrg } from '../context/OrgContext';
import { useToast } from '../components/ToastContext';
import { Building2, Users, Shield, Plus, Mail, Trash2, Edit2, AlertCircle } from 'lucide-react';

const OrganizationDashboard = () => {
    const { activeOrg, membership, hasPermission, refreshOrgs, userPlan } = useOrg();
    const { addToast } = useToast();
    const [loading, setLoading] = useState(true);
    const [members, setMembers] = useState([]);
    const [roles, setRoles] = useState([]);
    const [invites, setInvites] = useState([]);

    // Modals state
    const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
    const [isCreateRoleModalOpen, setIsCreateRoleModalOpen] = useState(false);
    const [isCreateOrgModalOpen, setIsCreateOrgModalOpen] = useState(false);

    // For editing roles
    const [isEditingRole, setIsEditingRole] = useState(false);
    const [editingRoleId, setEditingRoleId] = useState(null);

    // Form states
    const [orgData, setOrgData] = useState({ name: '' });
    const [inviteData, setInviteData] = useState({ email: '', roleId: '' });
    const [roleData, setRoleData] = useState({
        name: '',
        permissions: {
            manageContainers: false,
            manageVolumes: false,
            manageNetworks: false,
            viewLogs: true,
            deleteContainers: false,
            deleteVolumes: false,
            deleteNetworks: false
        }
    });

    useEffect(() => {
        if (activeOrg) {
            fetchOrgData();
        } else {
            setLoading(false);
        }
    }, [activeOrg]);

    const fetchOrgData = async () => {
        setLoading(true);
        try {
            const [membersRes, rolesRes, invitesRes] = await Promise.all([
                axios.get(`/api/organizations/${activeOrg._id}/members`),
                axios.get(`/api/organizations/${activeOrg._id}/roles`),
                axios.get(`/api/organizations/${activeOrg._id}/invites`)
            ]);
            setMembers(membersRes.data);
            setRoles(rolesRes.data);
            setInvites(invitesRes.data);
        } catch (error) {
            console.error('Failed to fetch org data:', error);
            addToast('Error', 'Failed to load organization details', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleCreateOrg = async (e) => {
        e.preventDefault();
        try {
            const res = await axios.post('/api/organizations', orgData);
            addToast('Success', 'Organization created successfully', 'success');
            setIsCreateOrgModalOpen(false);
            setOrgData({ name: '' });

            // Set the active organization to the newly created one before refreshing context
            localStorage.setItem('activeOrgId', res.data.organization._id);
            await refreshOrgs();
        } catch (error) {
            addToast('Error', error.response?.data?.message || 'Failed to create organization', 'error');
        }
    };

    const handleCreateRole = async (e) => {
        e.preventDefault();
        try {
            if (isEditingRole && editingRoleId) {
                await axios.put(`/api/organizations/${activeOrg._id}/roles/${editingRoleId}`, roleData);
                addToast('Success', 'Role updated successfully', 'success');
            } else {
                await axios.post(`/api/organizations/${activeOrg._id}/roles`, roleData);
                addToast('Success', 'Role created successfully', 'success');
            }

            closeRoleModal();
            fetchOrgData();
        } catch (error) {
            addToast('Error', error.response?.data?.message || 'Failed to save role', 'error');
        }
    };

    const openCreateRoleModal = () => {
        setIsEditingRole(false);
        setEditingRoleId(null);
        setRoleData({
            name: '',
            permissions: {
                manageContainers: false,
                manageVolumes: false,
                manageNetworks: false,
                viewLogs: true,
                deleteContainers: false,
                deleteVolumes: false,
                deleteNetworks: false
            }
        });
        setIsCreateRoleModalOpen(true);
    };

    const openEditRoleModal = (role) => {
        setIsEditingRole(true);
        setEditingRoleId(role._id);
        const permDefaults = {
            manageContainers: false,
            manageVolumes: false,
            manageNetworks: false,
            viewLogs: true,
            deleteContainers: false,
            deleteVolumes: false,
            deleteNetworks: false
        };
        setRoleData({
            name: role.name,
            permissions: { ...permDefaults, ...(role.permissions || {}) }
        });
        setIsCreateRoleModalOpen(true);
    };

    const closeRoleModal = () => {
        setIsCreateRoleModalOpen(false);
        setIsEditingRole(false);
        setEditingRoleId(null);
        setRoleData({ ...roleData, name: '' });
    };

    const handleInviteUser = async (e) => {
        e.preventDefault();
        try {
            const res = await axios.post(`/api/organizations/${activeOrg._id}/invites`, inviteData);
            addToast('Success', `Invitation sent to ${inviteData.email}`, 'success');

            setIsInviteModalOpen(false);
            setInviteData({ email: '', roleId: '' });
            fetchOrgData();
        } catch (error) {
            addToast('Error', error.response?.data?.message || 'Failed to send invite', 'error');
        }
    };

    const handleRemoveMember = async (memberId) => {
        if (!confirm('Are you sure you want to remove this member?')) return;
        try {
            await axios.delete(`/api/organizations/${activeOrg._id}/members/${memberId}`);
            addToast('Success', 'Member removed', 'success');
            fetchOrgData();
        } catch (error) {
            addToast('Error', error.response?.data?.message || 'Failed to remove member', 'error');
        }
    };

    if (!activeOrg) {
        const planType = userPlan || 'free';
        const canManageOrgs = ['enterprise', 'agency', 'msp', 'partner'].includes(planType);
        const canCreateOrgs = ['agency', 'msp', 'partner'].includes(planType);

        return (
            <div className="flex flex-col items-center justify-center p-12 text-center h-[60vh]">
                <div className="w-20 h-20 bg-brand-500/10 rounded-2xl flex items-center justify-center mb-6 border border-brand-500/20 shadow-sm">
                    <Building2 className="text-brand-500" size={40} />
                </div>
                <h2 className="text-2xl font-bold mb-3 text-slate-900 dark:text-white">No Active Organization</h2>
                <p className="text-slate-500 dark:text-slate-400 max-w-md mb-8">
                    {canCreateOrgs
                        ? 'You are currently in your Personal Workspace. To collaborate and manage team roles, select an existing Organization or create a new one.'
                        : canManageOrgs
                            ? 'You are currently in your Personal Workspace. As an Enterprise user, you can participate in organizations by receiving an invitation. You do not currently belong to any active Organizations.'
                            : 'You are currently in your Personal Workspace. Upgrade your plan to create an Organization, or ask your administrator to invite you to one.'
                    }
                </p>

                {canCreateOrgs && (
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => setIsCreateOrgModalOpen(true)}
                            className="bg-brand-600 hover:bg-brand-700 text-white px-6 py-3 rounded-xl flex items-center gap-2 font-bold shadow-md shadow-brand-500/20 transition-all hover:scale-105 active:scale-95"
                        >
                            <Plus size={20} /> Create Organization
                        </button>
                    </div>
                )}

                {canCreateOrgs && isCreateOrgModalOpen && (
                    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-fade-in">
                            <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
                                <h3 className="font-bold flex items-center gap-2 text-lg text-slate-800 dark:text-slate-200">
                                    <Building2 size={20} className="text-brand-500" /> New Organization
                                </h3>
                                <button onClick={() => setIsCreateOrgModalOpen(false)} className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors">✕</button>
                            </div>
                            <form onSubmit={handleCreateOrg} className="p-6 space-y-4">
                                <div>
                                    <label className="block text-sm font-bold mb-1.5 text-slate-700 dark:text-slate-300">Organization Name</label>
                                    <input
                                        required
                                        type="text"
                                        value={orgData.name}
                                        onChange={e => setOrgData({ ...orgData, name: e.target.value })}
                                        className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-3 outline-none focus:ring-2 ring-brand-500 transition-all placeholder-slate-400"
                                        placeholder="e.g. Acme Corp"
                                    />
                                </div>
                                <div className="pt-2">
                                    <button type="submit" className="w-full bg-brand-600 text-white py-3 rounded-xl font-bold hover:bg-brand-700 transition-all shadow-md shadow-brand-500/20 active:scale-95">
                                        Create Organization
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    if (loading) return <div className="p-8">Loading organization data...</div>;

    // Optional: Determine if user is org owner
    const isOwner = membership?.roleId?.name === 'Owner' || activeOrg.ownerId === localStorage.getItem('userId');

    return (
        <div className="space-y-8 pb-12">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-700/50 pb-6">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
                        {activeOrg.name} Organization
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400">
                        {isOwner
                            ? 'Manage your team, roles, and access permissions.'
                            : 'View your assigned role and permissions within this organization.'}
                    </p>
                </div>

                {isOwner && (
                    <div className="flex gap-3">
                        {/* Only Owner or specific Admins can invite/manage roles realistically, simplifying for now */}
                        <button
                            onClick={openCreateRoleModal}
                            className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 px-4 py-2 rounded-xl flex items-center gap-2 font-medium transition-colors"
                        >
                            <Shield size={18} /> New Role
                        </button>
                        <button
                            onClick={() => setIsInviteModalOpen(true)}
                            className="bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-xl flex items-center gap-2 font-medium transition-colors shadow-sm shadow-brand-500/20"
                        >
                            <Mail size={18} /> Invite Member
                        </button>
                    </div>
                )}
            </div>

            <div className={`grid grid-cols-1 ${isOwner ? 'lg:grid-cols-2' : ''} gap-8`}>
                {/* Members List - Only Visible to Owners */}
                {isOwner && (
                    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-3xl p-6 shadow-sm">
                        <h3 className="text-lg font-bold flex items-center gap-2 mb-6 text-slate-800 dark:text-slate-200 border-b border-slate-100 dark:border-slate-700 pb-3">
                            <Users className="text-brand-500" /> Team Members ({members.length})
                        </h3>
                        <div className="space-y-3">
                            {members.map(m => (
                                <div key={m._id} className="flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors border border-transparent hover:border-slate-100 dark:hover:border-slate-700">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
                                            {m.userId?.name?.substring(0, 1).toUpperCase()}
                                        </div>
                                        <div>
                                            <p className="font-semibold text-slate-900 dark:text-white">{m.userId?.name}</p>
                                            <p className="text-xs text-slate-500">{m.userId?.email}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <span className="px-3 py-1 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-full text-xs font-medium">
                                            {m.roleId?.name}
                                        </span>
                                        {isOwner && m.userId._id !== activeOrg.ownerId && (
                                            <button onClick={() => handleRemoveMember(m._id)} className="text-slate-400 hover:text-red-500 transition-colors">
                                                <Trash2 size={18} />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Roles List */}
                <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-3xl p-6 shadow-sm">
                    <h3 className="text-lg font-bold flex items-center gap-2 mb-6 text-slate-800 dark:text-slate-200 border-b border-slate-100 dark:border-slate-700 pb-3">
                        <Shield className="text-purple-500" /> {isOwner ? 'Roles & Permissions' : 'My Role & Permissions'}
                    </h3>
                    <div className="space-y-4">
                        {roles.filter(r => isOwner || r._id === membership?.roleId?._id).map(r => (
                            <div key={r._id} className="border border-slate-200 dark:border-slate-700 rounded-xl p-4">
                                <div className="flex items-center justify-between mb-3">
                                    <h4 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                                        {r.name}
                                        {r.name === 'Owner' && <span className="bg-amber-100 text-amber-600 text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider font-bold">System</span>}
                                    </h4>
                                    <div className="flex gap-2">
                                        {isOwner && r.name !== 'Owner' && <button onClick={() => openEditRoleModal(r)} className="text-slate-400 hover:text-brand-500"><Edit2 size={16} /></button>}
                                        {isOwner && r.name !== 'Owner' && <button onClick={async () => {
                                            if (!confirm('Are you sure you want to delete this role?')) return;
                                            try {
                                                await axios.delete(`/api/organizations/${activeOrg._id}/roles/${r._id}`);
                                                addToast('Success', 'Role deleted', 'success');
                                                fetchOrgData();
                                            } catch (error) {
                                                addToast('Error', error.response?.data?.message || 'Failed to delete role', 'error');
                                            }
                                        }} className="text-slate-400 hover:text-red-500"><Trash2 size={16} /></button>}
                                    </div>
                                </div>
                                <div className="flex flex-wrap gap-2 mt-2">
                                    {Object.entries(r.permissions).filter(([k, v]) => v).map(([key]) => (
                                        <span key={key} className="px-2 py-1 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 rounded text-xs font-mono">
                                            {key}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Pending Invites (Full width) - Only Visible to Owners */}
                {isOwner && invites.length > 0 && (
                    <div className="lg:col-span-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-3xl p-6 shadow-sm">
                        <h3 className="text-lg font-bold flex items-center gap-2 mb-6 text-slate-800 dark:text-slate-200 border-b border-slate-100 dark:border-slate-700 pb-3">
                            <Mail className="text-amber-500" /> Pending Invitations
                        </h3>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm whitespace-nowrap">
                                <thead>
                                    <tr className="text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
                                        <th className="pb-3 px-2">Email</th>
                                        <th className="pb-3 px-2">Role</th>
                                        <th className="pb-3 px-2">Expires</th>
                                        <th className="pb-3 px-2">Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {invites.map(inv => (
                                        <tr key={inv._id} className="border-b border-slate-100 dark:border-slate-700/50 last:border-0 hover:bg-slate-50 dark:hover:bg-slate-700/30">
                                            <td className="py-3 px-2 text-slate-800 dark:text-slate-200">{inv.email}</td>
                                            <td className="py-3 px-2 text-slate-500">{inv.roleId?.name}</td>
                                            <td className="py-3 px-2 text-slate-500">{new Date(inv.expiresAt).toLocaleDateString()}</td>
                                            <td className="py-3 px-2">
                                                <button onClick={async () => {
                                                    // In a real app, delete invite endpoint
                                                    addToast('Info', 'Invite revoked (mock)', 'info');
                                                    fetchOrgData();
                                                }} className="text-red-500 hover:text-red-600 font-medium">
                                                    Revoke
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>

            {/* Modals placed here (simplified for brevity) */}
            {isInviteModalOpen && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl w-full max-w-md overflow-hidden">
                        <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex justify-between">
                            <h3 className="font-bold text-lg">Invite Team Member</h3>
                            <button onClick={() => setIsInviteModalOpen(false)}>✕</button>
                        </div>
                        <form onSubmit={handleInviteUser} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-1">Email Address</label>
                                <input required type="email" value={inviteData.email} onChange={e => setInviteData({ ...inviteData, email: e.target.value })} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 outline-none focus:ring-2 ring-brand-500" placeholder="colleague@company.com" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Assign Role</label>
                                <select required value={inviteData.roleId} onChange={e => setInviteData({ ...inviteData, roleId: e.target.value })} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 outline-none focus:ring-2 ring-brand-500">
                                    <option value="" disabled>Select a role</option>
                                    {roles.map(r => (
                                        <option key={r._id} value={r._id}>{r.name}</option>
                                    ))}
                                </select>
                            </div>
                            <button type="submit" className="w-full bg-brand-600 text-white py-2.5 rounded-lg font-bold hover:bg-brand-700 transition-colors mt-4">
                                Send Invite Link
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {isCreateRoleModalOpen && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl w-full max-w-lg overflow-hidden max-h-[90vh] flex flex-col">
                        <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex justify-between shrink-0">
                            <h3 className="font-bold text-lg flex items-center gap-2"><Shield size={20} className="text-purple-500" /> {isEditingRole ? 'Edit Custom Role' : 'Create Custom Role'}</h3>
                            <button onClick={closeRoleModal}>✕</button>
                        </div>
                        <form onSubmit={handleCreateRole} className="p-6 space-y-6 overflow-y-auto custom-scrollbar">
                            <div>
                                <label className="block text-sm font-bold mb-1">Role Name</label>
                                <input required type="text" value={roleData.name} onChange={e => setRoleData({ ...roleData, name: e.target.value })} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 outline-none focus:ring-2 ring-brand-500 font-medium" placeholder="e.g. DevOps Engineer" />
                            </div>

                            <div>
                                <label className="block text-sm font-bold mb-3 border-b border-slate-100 dark:border-slate-700 pb-2">Permissions Overview</label>
                                <div className="space-y-3">
                                    {Object.keys(roleData.permissions).map(perm => (
                                        <label key={perm} className="flex items-center justify-between p-3 rounded-xl border border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors">
                                            <span className="font-mono text-sm text-slate-700 dark:text-slate-300">{perm}</span>
                                            <div className="relative inline-block w-12 h-6 rounded-full transition-colors duration-200 ease-in-out">
                                                <input
                                                    type="checkbox"
                                                    className="peer sr-only"
                                                    checked={roleData.permissions[perm]}
                                                    onChange={e => setRoleData({ ...roleData, permissions: { ...roleData.permissions, [perm]: e.target.checked } })}
                                                />
                                                <div className="absolute inset-0 bg-slate-200 dark:bg-slate-700 rounded-full peer-checked:bg-brand-500 transition-colors"></div>
                                                <div className="absolute w-4 h-4 bg-white rounded-full top-1 left-1 peer-checked:translate-x-6 transition-transform shadow-sm"></div>
                                            </div>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            <button type="submit" className="w-full bg-brand-600 text-white py-3 rounded-xl font-bold hover:bg-brand-700 transition-colors mt-4">
                                {isEditingRole ? 'Update Role' : 'Save Role'}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default OrganizationDashboard;
