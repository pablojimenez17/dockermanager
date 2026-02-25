import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';

const Layout = () => {
    return (
        <div className="flex h-screen bg-slate-900 overflow-hidden">
            <Sidebar />
            <main className="flex-1 overflow-y-auto bg-slate-900">
                <div className="container mx-auto max-w-7xl">
                    <Outlet />
                </div>
            </main>
        </div>
    );
};

export default Layout;
