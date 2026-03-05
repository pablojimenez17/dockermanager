import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import { ToastProvider } from './ToastContext';
import ChatAssistant from './ChatAssistant';

const Layout = () => {
    return (
        <ToastProvider>
            <div className="flex relative h-screen bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white transition-colors duration-200">
                <Sidebar />
                <main className="flex-1 overflow-x-hidden overflow-y-auto bg-slate-50 dark:bg-slate-900 transition-colors duration-200">
                    <div className="container mx-auto max-w-7xl">
                        <Outlet />
                    </div>
                </main>
                <ChatAssistant />
            </div>
        </ToastProvider>
    );
};

export default Layout;
