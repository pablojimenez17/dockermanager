import React, { useState } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, PlusSquare, Server, Settings, LogOut, ShieldAlert, Sun, Moon, Network, CreditCard, GitBranch, HardDrive, Lock, ShieldCheck, Aperture, ChevronDown, Rocket, Box, Briefcase, Database, Camera } from 'lucide-react';
import { useTheme } from './ThemeContext';
import axios from 'axios';

const Sidebar = () => {
    const navigate = useNavigate();
    const { theme, toggleTheme } = useTheme();

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
                { name: 'Running Apps', path: '/app/containers', icon: <Server size={18} /> },
            ]
        },
        {
            title: 'Resources',
            icon: <HardDrive size={18} />,
            items: [
                { name: 'View Containers', path: '/app/containers', icon: <Server size={20} /> },
                { name: 'Snapshots', path: '/app/snapshots', icon: <Camera size={20} /> },
                { name: 'Networks', path: '/app/networks', icon: <Network size={20} /> },
                { name: 'Buckets', path: '/app/buckets', icon: <Database size={20} /> },
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

    navGroups.push({
        title: 'User',
        icon: <Settings size={18} />,
        items: [
            { name: 'Billing & Plans', path: '/app/plans', icon: <CreditCard size={18} /> },
            { name: 'Settings', path: '/app/settings', icon: <Settings size={18} /> },
        ]
    });

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
        <div className="w-64 bg-white dark:bg-slate-800 h-full flex flex-col border-r border-slate-200 dark:border-slate-700 shadow-xl transition-colors duration-200 shrink-0 overflow-hidden">
            <div className="p-6 flex items-center space-x-3 shrink-0">
                <div className="w-8 h-8 rounded-lg bg-brand-500/10 flex items-center justify-center border border-brand-500/20 text-brand-500 dark:text-brand-400">
                    <Aperture size={20} className="animate-[spin_10s_linear_infinite]" />
                </div>
                <span className="text-xl font-bold text-slate-800 dark:text-white whitespace-nowrap tracking-wide">Orbit</span>
            </div>

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
                                        className={({ isActive }) =>
                                            `flex items-center space-x-3 px-3 py-2.5 rounded-r-xl transition-all duration-200 ${isActive
                                                ? 'bg-brand-50 text-brand-600 border-l-2 border-brand-500 dark:bg-brand-500/10 dark:text-brand-400'
                                                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 border-l-2 border-transparent dark:text-slate-400 dark:hover:bg-slate-700/30 dark:hover:text-slate-200'
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
                    onClick={toggleTheme}
                    className="flex items-center space-x-3 px-4 py-3 w-full text-slate-600 dark:text-slate-400 hover:bg-slate-100 top hover:text-slate-900 dark:hover:bg-slate-700/50 dark:hover:text-slate-200 rounded-xl transition-all duration-200"
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
        </div>
    );
};

export default Sidebar;

