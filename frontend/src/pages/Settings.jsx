import React, { useState, useEffect } from 'react';
import { User, Shield, Bell, Save, AlertCircle } from 'lucide-react';

const Settings = () => {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [theme, setTheme] = useState('dark');
    const [notifications, setNotifications] = useState(true);
    const [saved, setSaved] = useState(false);
    const [role, setRole] = useState('user');

    useEffect(() => {
        const storedName = localStorage.getItem('name');
        const storedEmail = localStorage.getItem('email');
        const storedRole = localStorage.getItem('role');
        if (storedName) setName(storedName);
        if (storedEmail) setEmail(storedEmail);
        if (storedRole) setRole(storedRole);
    }, []);

    const handleSave = (e) => {
        e.preventDefault();
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
    };

    return (
        <div className="p-8 pb-20 text-slate-900 dark:text-white max-w-4xl mx-auto">
            <div className="mb-10">
                <h1 className="text-4xl font-extrabold tracking-tight mb-2">Settings</h1>
                <p className="text-slate-600 dark:text-slate-400 text-lg">Manage your account preferences and application layout.</p>
            </div>

            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-3xl p-8 shadow-xl">
                <h3 className="text-xl font-bold mb-6 flex items-center space-x-2 border-b border-slate-200 dark:border-slate-700 pb-4">
                    <User className="text-brand-500 dark:text-brand-400" />
                    <span>Profile Management</span>
                </h3>

                <form onSubmit={handleSave} className="space-y-6">
                    {saved && (
                        <div className="bg-emerald-50 border border-emerald-200 text-emerald-600 dark:bg-emerald-500/10 dark:border-emerald-500/50 dark:text-emerald-500 text-sm py-4 px-4 rounded-xl flex items-start space-x-3">
                            <Save size={20} className="shrink-0 mt-0.5" />
                            <span>Settings saved successfully.</span>
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Full Name</label>
                            <input
                                type="text"
                                disabled
                                value={name}
                                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl text-slate-500 dark:text-slate-400 cursor-not-allowed mb-4"
                            />
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Email Address</label>
                            <input
                                type="email"
                                disabled
                                value={email}
                                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl text-slate-500 dark:text-slate-400 cursor-not-allowed"
                            />
                            <p className="text-xs text-slate-500 mt-2">Credentials cannot be changed after registration.</p>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Role</label>
                            <div className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl text-slate-600 dark:text-slate-400 flex items-center space-x-2">
                                {role === 'admin' ? (
                                    <>
                                        <Shield size={16} className="text-purple-600 dark:text-purple-400" />
                                        <span className="text-purple-600 dark:text-purple-400 font-semibold">Administrator</span>
                                    </>
                                ) : (
                                    <>
                                        <User size={16} className="text-slate-600 dark:text-slate-400" />
                                        <span>Standard User</span>
                                    </>
                                )}
                            </div>
                            {role === 'admin' && <p className="text-xs text-purple-600/80 dark:text-purple-400/80 mt-2">You have unrestricted administrative access.</p>}
                        </div>
                    </div>

                    <h3 className="text-xl font-bold mt-10 mb-6 flex items-center space-x-2 border-b border-slate-200 dark:border-slate-700 pb-4">
                        <Bell className="text-amber-500 dark:text-amber-400" />
                        <span>Preferences</span>
                    </h3>

                    <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl">
                        <div>
                            <h4 className="font-semibold text-slate-900 dark:text-white">Receive Alert Notifications</h4>
                            <p className="text-sm text-slate-600 dark:text-slate-400">Get notified when a container crashes or exits unexpectedly.</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" className="sr-only peer" checked={notifications} onChange={(e) => setNotifications(e.target.checked)} />
                            <div className="w-11 h-6 bg-slate-300 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-500"></div>
                        </label>
                    </div>

                    <div className="pt-6">
                        <button
                            type="submit"
                            className="flex justify-center items-center space-x-2 py-3 px-8 rounded-xl shadow-lg text-sm font-bold text-white bg-brand-500 hover:bg-brand-600 transition-all hover:shadow-[0_0_20px_rgba(14,165,233,0.4)]"
                        >
                            <span>Save Changes</span>
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default Settings;
