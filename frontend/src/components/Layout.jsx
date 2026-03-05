import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import { ToastProvider } from './ToastContext';

const Layout = () => {
    return (
        <ToastProvider>
            <div className="flex h-screen overflow-hidden bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white transition-colors duration-200 relative w-full">
                <Sidebar />
                <main className="flex-1 flex flex-col h-screen overflow-y-auto overflow-x-hidden bg-slate-50 dark:bg-slate-900 transition-colors duration-200 relative">
                    <div className="container mx-auto max-w-7xl pt-4 md:pt-0">
                        <Outlet />
                    </div>
                </main>
            </div>
        </ToastProvider>
    );
};

export default Layout;
