import React, { useState, useEffect } from 'react';
import { Outlet, useLocation, Link } from 'react-router-dom';
import Sidebar from './Sidebar';
import { Menu, ChevronRight, Building } from 'lucide-react';
import AdBanner from './AdBanner';
import { useOrg } from '../context/OrgContext';

const Layout = () => {
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const location = useLocation();
    const { userPlan, activeOrg, orgs } = useOrg();
    const planType = userPlan || 'free';

    const routeTitles = {
        '/app': 'Dashboard',
        '/app/create': 'Create Container',
        '/app/git-deploy': 'Deploy from Git',
        '/app/containers': 'Active Instances',
        '/app/marketplace': 'Templates',
        '/app/snapshots': 'Snapshots',
        '/app/networks': 'Networks',
        '/app/volumes': 'Volumes',
        '/app/secrets': 'Secret Manager',
        '/app/registries': 'Private Registries',
        '/app/settings': 'Platform Settings',
        '/app/profile': 'User Profile',
        '/app/plans': 'Billing & Plans'
    };

    const currentPath = location.pathname.split('/').slice(0, 3).join('/');
    const pageTitle = routeTitles[currentPath] || 'Orbit';

    useEffect(() => {
        document.title = `${pageTitle} | OrbitCloud`;
    }, [location, pageTitle]);

    return (
        <div className="flex h-screen overflow-hidden bg-gray-50 dark:bg-slate-900 text-gray-900 dark:text-slate-100 transition-colors duration-200 relative w-full font-sans">
            <Sidebar isOpen={isMobileMenuOpen} setIsOpen={setIsMobileMenuOpen} />

            <main className="flex-1 flex flex-col h-screen overflow-y-auto overflow-x-hidden relative z-10">
                {/* Top Navigation Bar (AWS Style) */}
                <header className="bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 h-14 flex items-center justify-between px-4 sticky top-0 z-30 shrink-0">
                    <div className="flex items-center">
                        <button
                            onClick={() => setIsMobileMenuOpen(true)}
                            className="md:hidden p-1.5 mr-3 rounded hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-500 dark:text-slate-400 transition-colors"
                        >
                            <Menu size={20} />
                        </button>
                        
                        <div className="md:hidden text-sm font-semibold text-gray-900 dark:text-white ml-2">
                            {pageTitle}
                        </div>
                    </div>

                    <div className="flex items-center space-x-3">
                        {/* Context Selector (OrgSwitcher simplified for header) */}
                        <div className="hidden sm:flex items-center bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded px-3 py-1.5 text-sm font-medium">
                            <Building size={14} className="text-gray-400 dark:text-slate-500 mr-2" />
                            <span className="text-gray-700 dark:text-slate-300 truncate max-w-[150px]">
                                {activeOrg ? activeOrg.name : 'Personal Workspace'}
                            </span>
                        </div>
                    </div>
                </header>

                {/* Mobile Ad Banner Strip */}
                <div className="md:hidden px-4 pt-4 shrink-0">
                    <AdBanner />
                </div>

                <div className="p-4 md:p-6 lg:p-8 w-full max-w-7xl mx-auto">
                    <Outlet />
                </div>
            </main>

            {/* Mobile Overlay */}
            {isMobileMenuOpen && (
                <div
                    className="fixed inset-0 bg-gray-900/50 dark:bg-slate-900/80 backdrop-blur-sm z-30 md:hidden transition-opacity duration-300"
                    onClick={() => setIsMobileMenuOpen(false)}
                ></div>
            )}
        </div>
    );
};

export default Layout;
