import React, { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import { ToastProvider } from './ToastContext';
import { Menu } from 'lucide-react';

const Layout = () => {
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const location = useLocation();

    // Dynamically update document title based on the active route
    useEffect(() => {
        const routeTitles = {
            '/app': 'Dashboard',
            '/app/deploy': 'Create Container',
            '/app/github': 'Deploy from Git',
            '/app/containers': 'My Containers',
            '/app/templates': 'Templates',
            '/app/snapshots': 'Snapshots',
            '/app/networks': 'Networks',
            '/app/buckets': 'Buckets',
            '/app/secrets': 'Secret Manager',
            '/app/registries': 'Private Registries',
            '/app/settings': 'Platform Settings',
            '/app/profile': 'User Profile',
            '/app/plans': 'Billing & Plans'
        };

        const currentPath = location.pathname.split('/').slice(0, 3).join('/'); // Match base routes handling IDs
        const pageTitle = routeTitles[currentPath] || 'App';
        document.title = `${pageTitle} | Orbit`;
    }, [location]);

    return (
        <ToastProvider>
            <div className="flex h-screen overflow-hidden bg-slate-100 dark:bg-[#0b1120] text-slate-900 dark:text-white transition-colors duration-300 relative w-full font-sans">
                {/* Subtle Ambient Background Gradients for Glassmorphism */}
                <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-brand-500/30 dark:bg-brand-500/20 blur-[140px] pointer-events-none z-0"></div>
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-indigo-500/30 dark:bg-indigo-500/20 blur-[120px] pointer-events-none z-0"></div>

                <Sidebar isOpen={isMobileMenuOpen} setIsOpen={setIsMobileMenuOpen} />

                <main className="flex-1 flex flex-col h-screen overflow-y-auto overflow-x-hidden relative z-10">
                    {/* Mobile Header with Hamburger Menu */}
                    <div className="md:hidden flex items-center p-4 bg-white/50 dark:bg-slate-900/40 backdrop-blur-xl border-b border-white/80 dark:border-white/10 sticky top-0 z-30">
                        <button
                            onClick={() => setIsMobileMenuOpen(true)}
                            className="p-2 mr-4 rounded-xl bg-white/80 dark:bg-slate-800 border border-white/50 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-brand-500 hover:text-white dark:hover:bg-brand-500 transition-colors shadow-sm"
                        >
                            <Menu size={24} />
                        </button>
                        <span className="font-bold text-lg tracking-wide text-brand-600 dark:text-brand-400">Orbit</span>
                    </div>

                    <div className="container mx-auto max-w-7xl p-4 md:p-8 lg:p-10">
                        <Outlet />
                    </div>
                </main>

                {/* Mobile Overlay */}
                {isMobileMenuOpen && (
                    <div
                        className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-30 md:hidden transition-opacity"
                        onClick={() => setIsMobileMenuOpen(false)}
                    ></div>
                )}
            </div>
        </ToastProvider>
    );
};

export default Layout;
