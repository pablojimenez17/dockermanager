import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, PlusSquare, Server, Settings, LogOut, ShieldAlert, Sun, Moon, Network, CreditCard, GitBranch, HardDrive, Lock, ShieldCheck } from 'lucide-react';
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
    const navItems = [
        { name: 'Dashboard', path: '/app', icon: <LayoutDashboard size={20} /> },
        { name: 'Create Container', path: '/app/create', icon: <PlusSquare size={20} /> },
        { name: 'Deploy from Git', path: '/app/git-deploy', icon: <GitBranch size={20} /> },
        { name: 'View Containers', path: '/app/containers', icon: <Server size={20} /> },
        { name: 'Secret Manager', path: '/app/secrets', icon: <Lock size={20} /> },
        { name: 'Private Registries', path: '/app/registries', icon: <ShieldCheck size={20} /> },
        { name: 'Volumes (Disks)', path: '/app/volumes', icon: <HardDrive size={20} /> },
        { name: 'Networks', path: '/app/networks', icon: <Network size={20} /> },
        { name: 'Billing & Plans', path: '/app/plans', icon: <CreditCard size={20} /> },
    ];

    if (role === 'admin') {
        navItems.push({ name: 'Administration', path: '/app/admin', icon: <ShieldAlert size={20} /> });
    }

    navItems.push({ name: 'Settings', path: '/app/settings', icon: <Settings size={20} /> });

    return (
        <div className="w-64 bg-white dark:bg-slate-800 h-full flex flex-col border-r border-slate-200 dark:border-slate-700 shadow-xl transition-colors duration-200 shrink-0 overflow-y-auto">
            <div className="p-6 flex items-center space-x-3">
                <Server className="text-brand-500 dark:text-brand-400 shrink-0" size={28} />
                <span className="text-xl font-bold text-slate-800 dark:text-white whitespace-nowrap">Docker Manager</span>
            </div>

            <nav className="flex-1 px-4 space-y-2 mt-4">
                {navItems.map((item) => (
                    <NavLink
                        key={item.name}
                        to={item.path}
                        end={item.path === '/app'}
                        className={({ isActive }) =>
                            `flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-200 ${isActive
                                ? 'bg-brand-50 text-brand-600 border border-brand-200 shadow-[0_0_15px_rgba(14,165,233,0.05)] dark:bg-brand-500/10 dark:text-brand-400 dark:border-brand-500/20 dark:shadow-[0_0_15px_rgba(14,165,233,0.15)]'
                                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-700/50 dark:hover:text-slate-200'
                            }`
                        }
                    >
                        {item.icon}
                        <span className="font-medium">{item.name}</span>
                    </NavLink>
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

