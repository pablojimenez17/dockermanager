import React, { useState } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, PlusSquare, Server, Settings, LogOut, ShieldAlert, Sun, Moon, Network, CreditCard, GitBranch, HardDrive, Lock, ShieldCheck, Aperture, ChevronDown, Rocket, Briefcase, Database, Camera, X, Building2, Bell } from 'lucide-react';
import { useTheme } from './ThemeContext';
import OrgSwitcher from './OrgSwitcher';
import axios from 'axios';
import { useOrg } from '../context/OrgContext';
import { useNotifications } from '../context/NotificationContext';
import InvitesModal from './InvitesModal';

const Sidebar = ({ isOpen, setIsOpen }) => {
    const navigate = useNavigate();
    const { theme, toggleTheme } = useTheme();
    const { unreadCount } = useNotifications();
    const [isInvitesModalOpen, setIsInvitesModalOpen] = useState(false);

    const handleLogout = async () => {
        try {
            await axios.post('http://localhost:5000/api/auth/logout');
        } catch (e) {
            console.error('Logout error', e);
        }
        localStorage.clear();
        navigate('/');
    };

    const role = localStorage.getItem('role') || 'user';
    const location = useLocation();
    const { organizations, userPlan } = useOrg();

    const planType = userPlan || 'free';
    const hasOrgs = organizations && organizations.length > 0;
    const canCreateOrgs = ['agency', 'msp', 'partner'].includes(planType);
    const shouldShowOrgSetup = hasOrgs || canCreateOrgs;

    // Group definition
    const navGroups = [
        {
            title: 'Overview',
            icon: <LayoutDashboard size={18} />,
            items: [
                { name: 'Dashboard', path: '/app', icon: <LayoutDashboard size={18} /> },
            ]
        },
        {
            title: 'Deployments',
            icon: <Rocket size={18} />,
            items: [
                { name: 'Create Container', path: '/app/create', icon: <PlusSquare size={18} /> },
                { name: 'Deploy from Git', path: '/app/git-deploy', icon: <GitBranch size={18} /> },
                { name: 'Templates', path: '/app/marketplace', icon: <Briefcase size={18} /> },
            ]
        },
        {
            title: 'Resources',
            icon: <HardDrive size={18} />,
            items: [
                { name: 'View Containers', path: '/app/containers', icon: <Server size={20} /> },
                { name: 'Volumes', path: '/app/volumes', icon: <HardDrive size={20} /> },
                { name: 'Snapshots', path: '/app/snapshots', icon: <Camera size={20} /> },
                { name: 'Networks', path: '/app/networks', icon: <Network size={20} /> },
                { name: 'Secret Manager', path: '/app/secrets', icon: <Lock size={18} /> },
                { name: 'Private Registries', path: '/app/registries', icon: <ShieldCheck size={18} /> },
            ]
        }
    ];

    if (role === 'admin') {
        navGroups.push({
            title: 'Platform',
            icon: <ShieldAlert size={18} />,
            items: [
                { name: 'Administration', path: '/app/admin', icon: <ShieldAlert size={18} /> },
            ]
        });
    }

    const userGroup = {
        title: 'User',
        icon: <Settings size={18} />,
        items: [
            { name: 'Billing & Plans', path: '/app/plans', icon: <CreditCard size={18} /> },
            { name: 'Settings', path: '/app/settings', icon: <Settings size={18} /> },
        ]
    };

    if (shouldShowOrgSetup) {
        // Insert org settings before regular settings
        userGroup.items.splice(1, 0, { name: 'Org Settings', path: '/app/organization', icon: <Building2 size={18} /> });
    }

    navGroups.push(userGroup);

    // Helper to determine if a group should be open by default based on current path
    const isGroupActive = (items) => {
        return items.some(item => location.pathname === item.path || (item.path !== '/app' && location.pathname.startsWith(item.path)));
    };

    // State for open accordions
    const [openGroups, setOpenGroups] = useState(
        navGroups.reduce((acc, group, index) => {
            acc[index] = isGroupActive(group.items) || index === 0; // Open if active or if it's the first group
            return acc;
        }, {})
    );

    const toggleGroup = (index) => {
        setOpenGroups(prev => ({ ...prev, [index]: !prev[index] }));
    };

    return (
        <div className={`w-64 bg-white/50 dark:bg-slate-900/40 backdrop-blur-2xl h-full flex flex-col border-r border-white/80 dark:border-white/10 shadow-[4px_0_32px_rgba(0,0,0,0.08)] dark:shadow-[4px_0_32px_rgba(0,0,0,0.2)] transition-transform duration-300 overflow-hidden z-40 fixed md:relative left-0 top-0 bottom-0 ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
            <div className="p-6 flex items-center justify-between shrink-0">
                <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 rounded-lg bg-brand-500/10 flex items-center justify-center border border-brand-500/20 text-brand-500 dark:text-brand-400">
                        <Aperture size={20} className="animate-[spin_10s_linear_infinite]" />
                    </div>
                    <span className="text-xl font-bold text-slate-800 dark:text-white whitespace-nowrap tracking-wide">Orbit</span>
                </div>
                {/* Mobile Close Button */}
                <button
                    onClick={() => setIsOpen(false)}
                    className="md:hidden p-2 rounded-lg bg-slate-200/50 dark:bg-slate-800/50 text-slate-500 hover:text-slate-800 dark:hover:text-white active:scale-95 transition-all"
                >
                    <X size={20} />
                </button>
            </div>

            {shouldShowOrgSetup && (
                <div className="px-4 mt-2">
                    <OrgSwitcher />
                </div>
            )}

            <nav className="flex-1 px-3 space-y-1 mt-2 overflow-y-auto pb-4 custom-scrollbar">
                {navGroups.map((group, index) => (
                    <div key={group.title} className="mb-2">
                        <button
                            onClick={() => toggleGroup(index)}
                            className="w-full flex items-center justify-between px-3 py-2 text-sm font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors uppercase tracking-wider group"
                        >
                            <div className="flex items-center space-x-2">
                                {group.icon}
                                <span>{group.title}</span>
                            </div>
                            <ChevronDown
                                size={16}
                                className={`transform transition-transform duration-200 ${openGroups[index] ? 'rotate-180' : ''}`}
                            />
                        </button>

                        <div className={`overflow-hidden transition-all duration-300 ease-in-out ${openGroups[index] ? 'max-h-96 opacity-100 mt-1' : 'max-h-0 opacity-0'}`}>
                            <div className="space-y-1 pl-2 border-l border-slate-200 dark:border-slate-700 ml-4 py-1">
                                {group.items.map((item) => (
                                    <NavLink
                                        key={item.name}
                                        to={item.path}
                                        end={item.path === '/app'}
                                        title={item.name}
                                        onClick={() => {
                                            if (window.innerWidth < 768) setIsOpen(false);
                                        }}
                                        className={({ isActive }) =>
                                            `flex items-center space-x-3 px-3 py-2.5 rounded-r-xl transition-all duration-200 ${isActive
                                                ? 'bg-slate-100 text-brand-700 border-l-4 border-brand-600 dark:bg-brand-500/20 dark:text-brand-300 dark:border-brand-400 font-semibold'
                                                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 border-l-4 border-transparent dark:text-slate-400 dark:hover:bg-slate-700/30 dark:hover:text-slate-200'
                                            }`
                                        }
                                    >
                                        <div className="opacity-80">{item.icon}</div>
                                        <span className="font-medium text-sm truncate">{item.name}</span>
                                    </NavLink>
                                ))}
                            </div>
                        </div>
                    </div>
                ))}
            </nav>

            <div className="p-4 border-t border-slate-200 dark:border-slate-700 space-y-2 shrink-0 border-b">
                <button
                    onClick={() => setIsInvitesModalOpen(true)}
                    className="flex items-center space-x-3 px-4 py-3 w-full text-slate-600 dark:text-slate-400 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-700/50 dark:hover:text-slate-200 rounded-xl transition-all duration-200 relative"
                >
                    <Bell size={20} />
                    <span className="font-medium">Notifications</span>
                    {unreadCount > 0 && (
                        <span className="absolute right-4 bg-brand-500 text-white text-xs font-bold px-2 py-0.5 rounded-full flex items-center justify-center animate-pulse">
                            {unreadCount}
                        </span>
                    )}
                </button>
                <button
                    onClick={toggleTheme}
                    className="flex items-center space-x-3 px-4 py-3 w-full text-slate-600 dark:text-slate-400 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-700/50 dark:hover:text-slate-200 rounded-xl transition-all duration-200"
                >
                    {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
                    <span className="font-medium">{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
                </button>
                <button
                    onClick={handleLogout}
                    className="flex items-center space-x-3 px-4 py-3 w-full text-slate-600 dark:text-slate-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-500/10 dark:hover:text-red-400 rounded-xl transition-all duration-200"
                >
                    <LogOut size={20} />
                    <span className="font-medium">Logout</span>
                </button>
            </div>

            <InvitesModal isOpen={isInvitesModalOpen} onClose={() => setIsInvitesModalOpen(false)} />
        </div>
    );
};

export default Sidebar;

