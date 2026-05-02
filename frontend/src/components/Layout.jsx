import React, { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import { Menu } from 'lucide-react';
import AdBanner from './AdBanner';
import { useOrg } from '../context/OrgContext';

const Layout = () => {
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const location = useLocation();
    const { userPlan } = useOrg();
    const planType = userPlan || 'free';

    useEffect(() => {
        const routeTitles = {
            '/app': 'Dashboard',
            '/app/create': 'Create Container',
            '/app/git-deploy': 'Deploy from Git',
            '/app/containers': 'My Containers',
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
        document.title = `${pageTitle} | OrbitCloud`;
    }, [location]);

    return (
        <div className="flex h-screen overflow-hidden bg-[#050508] text-slate-200 transition-colors duration-300 relative w-full font-sans selection:bg-brand-500/30">
            {/* Aero Ambient Background Gradients (Engine Glow) */}
            <div className="absolute top-[-15%] left-[-10%] w-[60%] h-[60%] rounded-full bg-brand-600/10 blur-[150px] pointer-events-none z-0 mix-blend-screen animate-pulse-slow"></div>
            <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-surface-border/50 blur-[120px] pointer-events-none z-0"></div>

            <Sidebar isOpen={isMobileMenuOpen} setIsOpen={setIsMobileMenuOpen} />

            <main className="flex-1 flex flex-col h-screen overflow-y-auto overflow-x-hidden relative z-10 custom-scrollbar">
                {/* Mobile Header with Hamburger Menu */}
                <div className="md:hidden flex items-center p-4 panel-glass metallic-edge-bottom sticky top-0 z-30">
                    <button
                        onClick={() => setIsMobileMenuOpen(true)}
                        className="p-2 mr-4 rounded bg-surface hover:bg-surface-hover border border-surface-border text-slate-300 hover:text-white transition-aero shadow-hud"
                    >
                        <Menu size={24} />
                    </button>
                    <span className="font-display font-bold text-lg tracking-wide text-white uppercase">Orbit</span>
                </div>

                {/* Mobile Ad Banner Strip */}
                {planType === 'free' && (
                    <div className="md:hidden px-4 pt-4 shrink-0">
                        <AdBanner />
                    </div>
                )}

                <div className="container mx-auto max-w-7xl p-4 md:p-8 lg:p-12 xl:p-16">
                    <Outlet />
                </div>
            </main>

            {/* Mobile Overlay */}
            {isMobileMenuOpen && (
                <div
                    className="fixed inset-0 bg-[#050508]/80 backdrop-blur-md z-30 md:hidden transition-opacity duration-300"
                    onClick={() => setIsMobileMenuOpen(false)}
                ></div>
            )}
        </div>
    );
};

export default Layout;
