import React, { useState } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, PlusSquare, Server, Settings, LogOut, ShieldAlert, Sun, Moon, Network, CreditCard, GitBranch, HardDrive, Lock, ShieldCheck, Aperture, ChevronDown, Rocket, Briefcase, Database, Camera, X, Building2, Bell } from 'lucide-react';
import { useTheme } from './ThemeContext';
import OrgSwitcher from './OrgSwitcher';
import axios from 'axios';
import { useOrg } from '../context/OrgContext';
import { useNotifications } from '../context/NotificationContext';
import InvitesModal from './InvitesModal';
import AdBanner from './AdBanner';

const Sidebar = ({ isOpen, setIsOpen }) => {
    const navigate = useNavigate();
    const { theme, toggleTheme } = useTheme();
    const { unreadCount } = useNotifications();
    const [isInvitesModalOpen, setIsInvitesModalOpen] = useState(false);

    const handleLogout = async () => {
        try {
            await axios.post('/api/auth/logout');
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
        <div className={`w-64 panel-glass border-r-0 metallic-edge flex flex-col h-full shadow-[4px_0_32px_rgba(0,0,0,0.5)] transition-transform duration-aero ease-in-out overflow-hidden z-40 fixed md:relative left-0 top-0 bottom-0 ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
            <div className="p-6 flex items-center justify-between shrink-0 border-b border-surface-border/50">
                <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-brand-500/10 flex items-center justify-center border border-brand-500/30 text-brand-500 shadow-hud">
                        <Aperture size={20} className="animate-[spin_10s_linear_infinite]" />
                    </div>
                    <span className="text-xl font-display font-bold text-white whitespace-nowrap tracking-wider uppercase">Orbit</span>
                </div>
                {/* Mobile Close Button */}
                <button
                    onClick={() => setIsOpen(false)}
                    className="md:hidden p-2 rounded bg-surface border border-surface-border text-slate-400 hover:text-white active:scale-95 transition-aero"
                >
                    <X size={20} />
                </button>
            </div>

            {shouldShowOrgSetup && (
                <div className="px-4 mt-4">
                    <OrgSwitcher />
                </div>
            )}

            <nav className="flex-1 px-3 space-y-2 mt-4 overflow-y-auto pb-4 custom-scrollbar">
                {navGroups.map((group, index) => (
                    <div key={group.title} className="mb-2">
                        <button
                            onClick={() => toggleGroup(index)}
                            className="w-full flex items-center justify-between px-3 py-2 text-xs font-display font-semibold text-slate-500 hover:text-white transition-colors uppercase tracking-[0.1em] group"
                        >
                            <div className="flex items-center space-x-2">
                                {group.icon}
                                <span>{group.title}</span>
                            </div>
                            <ChevronDown
                                size={14}
                                className={`transform transition-transform duration-300 ${openGroups[index] ? 'rotate-180 text-brand-500' : ''}`}
                            />
                        </button>

                        <div className={`overflow-hidden transition-all duration-aero ease-in-out ${openGroups[index] ? 'max-h-96 opacity-100 mt-2' : 'max-h-0 opacity-0'}`}>
                            <div className="space-y-1 pl-2 border-l border-surface-border ml-4 py-1">
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
                                            `flex items-center space-x-3 px-3 py-2.5 transition-all duration-300 ease-out ${isActive
                                                ? 'bg-brand-500/10 text-white border-l-[3px] border-brand-500 shadow-hud'
                                                : 'text-slate-400 hover:bg-surface-hover hover:text-slate-200 border-l-[3px] border-transparent hover:border-surface-border'
                                            }`
                                        }
                                    >
                                        <div className={`${({isActive}) => isActive ? 'text-brand-400' : 'opacity-80'}`}>{item.icon}</div>
                                        <span className="font-medium text-sm truncate tracking-wide">{item.name}</span>
                                    </NavLink>
                                ))}
                            </div>
                        </div>
                    </div>
                ))}
            </nav>

            {planType === 'free' && (
                <div className="px-4 shrink-0 mb-4">
                    <AdBanner />
                </div>
            )}

            <div className="p-4 border-t border-surface-border space-y-2 shrink-0 bg-surface/30">
                <button
                    onClick={() => setIsInvitesModalOpen(true)}
                    className="flex items-center space-x-3 px-4 py-3 w-full text-slate-400 hover:bg-surface-hover hover:text-white transition-all duration-300 relative group"
                >
                    <Bell size={18} className="group-hover:text-brand-400 transition-colors" />
                    <span className="font-medium text-sm tracking-wide">Notifications</span>
                    {unreadCount > 0 && (
                        <span className="absolute right-4 bg-brand-600 border border-brand-500 text-white text-[10px] font-bold px-2 py-0.5 rounded shadow-hud flex items-center justify-center animate-pulse">
                            {unreadCount}
                        </span>
                    )}
                </button>
                
                {/* Theme toggle removed as requested to stick to Dark mode/Cockpit feel, or keep it but force dark icons */}
                <button
                    onClick={handleLogout}
                    className="flex items-center space-x-3 px-4 py-3 w-full text-slate-400 hover:bg-brand-900/40 hover:text-brand-400 hover:border-l-2 hover:border-brand-500 transition-all duration-300 group"
                >
                    <LogOut size={18} className="group-hover:text-brand-500 transition-colors" />
                    <span className="font-medium text-sm tracking-wide">Disconnect</span>
                </button>
            </div>

            <InvitesModal isOpen={isInvitesModalOpen} onClose={() => setIsInvitesModalOpen(false)} />
        </div>
    );
};

export default Sidebar;

