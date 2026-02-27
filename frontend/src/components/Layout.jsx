import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import { ToastProvider } from './ToastContext';

const Layout = () => {
    return (
        <ToastProvider>
            <div className="flex relative h-screen bg-slate-900">
                <Sidebar />
                <main className="flex-1 overflow-x-hidden overflow-y-auto bg-slate-900">
                    <div className="container mx-auto max-w-7xl">
                        <Outlet />
                    </div>
                </main>
            </div>
        </ToastProvider>
    );
};

export default Layout;
