import React, { useState, useEffect } from 'react';
import { User, Shield, Bell, Save, AlertCircle, CreditCard, CalendarX2 } from 'lucide-react';
import axios from 'axios';
import { useToast } from '../components/ToastContext';

const Settings = () => {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [theme, setTheme] = useState('dark');
    const [notifications, setNotifications] = useState(true);
    const [saved, setSaved] = useState(false);
    const [role, setRole] = useState('user');
    
    // Subscription states
    const [planData, setPlanData] = useState(null);
    const [cancelling, setCancelling] = useState(false);
    const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
    const [cancelStep, setCancelStep] = useState(1);
    const [cancelConfirmText, setCancelConfirmText] = useState('');
    const [cancelReason, setCancelReason] = useState('');
    const [countdown, setCountdown] = useState(0);
    const { addToast } = useToast();

    useEffect(() => {
        const storedName = localStorage.getItem('name');
        const storedEmail = localStorage.getItem('email');
        const storedRole = localStorage.getItem('role');
        if (storedName) setName(storedName);
        if (storedEmail) setEmail(storedEmail);
        if (storedRole) setRole(storedRole);

        // Fetch fresh subscription data
        const fetchUserData = async () => {
            try {
                const res = await axios.get('/api/auth/me');
                setPlanData({
                    planType: res.data.planType,
                    planExpiresAt: res.data.planExpiresAt,
                    autoRenew: res.data.autoRenew
                });
            } catch (err) {
                console.error("Failed to fetch user data for settings", err);
            }
        };
        fetchUserData();
    }, []);

    useEffect(() => {
        let timer;
        if (cancelStep === 4 && countdown > 0) {
            timer = setTimeout(() => setCountdown(prev => prev - 1), 1000);
        }
        return () => clearTimeout(timer);
    }, [cancelStep, countdown]);

    const startCancelProcess = () => {
        setCancelStep(1);
        setCancelConfirmText('');
        setCancelReason('');
        setIsCancelModalOpen(true);
    };

    const goToFinalStep = () => {
        setCancelStep(4);
        setCountdown(5);
    };

    const executeCancelPlan = async () => {
        setCancelling(true);
        try {
            const res = await axios.post('/api/plans/cancel');
            setPlanData(prev => ({ ...prev, autoRenew: false, planExpiresAt: res.data.planExpiresAt }));
            addToast('Plan Cancelled', res.data.message, 'success');
            setIsCancelModalOpen(false);
        } catch (error) {
            addToast('Error', error.response?.data?.message || 'Failed to cancel plan', 'error');
        } finally {
            setCancelling(false);
        }
    };

    const handleSave = (e) => {
        e.preventDefault();
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
    };

    return (
        <div className="p-4 md:p-8 pb-20 text-slate-900 dark:text-white max-w-4xl mx-auto">
            <div className="mb-10">
                <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-2">Settings</h1>
                <p className="text-slate-600 dark:text-slate-400 text-base sm:text-lg">Manage your account preferences and application layout.</p>
            </div>

            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-sm p-8 shadow-sm">
                <h3 className="text-xl font-bold mb-6 flex items-center space-x-2 border-b border-slate-200 dark:border-slate-700 pb-4">
                    <User className="text-brand-500 dark:text-brand-400" />
                    <span>Profile Management</span>
                </h3>

                <form onSubmit={handleSave} className="space-y-6">
                    {saved && (
                        <div className="bg-emerald-50 border border-emerald-200 text-emerald-600 dark:bg-emerald-500/10 dark:border-emerald-500/50 dark:text-emerald-500 text-sm py-4 px-4 rounded-sm flex items-start space-x-3">
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
                                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-sm text-slate-500 dark:text-slate-400 cursor-not-allowed mb-4"
                            />
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Email Address</label>
                            <input
                                type="email"
                                disabled
                                value={email}
                                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-sm text-slate-500 dark:text-slate-400 cursor-not-allowed"
                            />
                            <p className="text-xs text-slate-500 mt-2">Credentials cannot be changed after registration.</p>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Role</label>
                            <div className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-sm text-slate-600 dark:text-slate-400 flex items-center space-x-2">
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

                    <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-sm">
                        <div>
                            <h4 className="font-semibold text-slate-900 dark:text-white">Receive Alert Notifications</h4>
                            <p className="text-sm text-slate-600 dark:text-slate-400">Get notified when a container crashes or exits unexpectedly.</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" className="sr-only peer" checked={notifications} onChange={(e) => setNotifications(e.target.checked)} />
                            <div className="w-11 h-6 bg-slate-300 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-500"></div>
                        </label>
                    </div>

                    <h3 className="text-xl font-bold mt-10 mb-6 flex items-center space-x-2 border-b border-slate-200 dark:border-slate-700 pb-4">
                        <CreditCard className="text-indigo-500 dark:text-indigo-400" />
                        <span>Subscription Management</span>
                    </h3>

                    <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-sm p-6">
                        {planData ? (
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                                <div className="space-y-1">
                                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Current Plan</p>
                                    <div className="flex items-center gap-3">
                                        <h4 className="text-2xl font-black text-slate-900 dark:text-white capitalize">{planData.planType}</h4>
                                        {planData.planType !== 'free' && (
                                            <span className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${planData.autoRenew ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400' : 'bg-amber-100 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400'}`}>
                                                {planData.autoRenew ? 'Auto-Renews' : 'Cancels Automatically'}
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
                                        {planData.planType === 'free' ? 'You are on the permanently free hobby tier.' : `Your billing cycle ends on ${new Date(planData.planExpiresAt).toLocaleDateString()}.`}
                                    </p>
                                </div>
                                
                                {planData.planType !== 'free' && planData.autoRenew && (
                                    <button
                                        type="button"
                                        disabled={cancelling}
                                        onClick={startCancelProcess}
                                        className="shrink-0 flex items-center justify-center space-x-2 py-2.5 px-6 rounded-sm text-sm font-bold border border-red-200 text-red-600 bg-red-50 hover:bg-red-100 dark:border-red-500/20 dark:text-red-400 dark:bg-red-500/10 dark:hover:bg-red-500/20 transition-all active:scale-95"
                                    >
                                        <CalendarX2 size={18} />
                                        <span>{cancelling ? 'Cancelling...' : 'Cancel Plan'}</span>
                                    </button>
                                )}
                            </div>
                        ) : (
                            <div className="animate-pulse text-sm text-slate-500">Loading subscription data...</div>
                        )}
                    </div>

                    <div className="pt-6">
                        <button
                            type="submit"
                            className="flex justify-center items-center space-x-2 py-3 px-8 rounded-sm shadow-sm text-sm font-bold text-white bg-brand-500 hover:bg-brand-600 transition-all hover:shadow-[0_0_20px_rgba(14,165,233,0.4)]"
                        >
                            <span>Save Changes</span>
                        </button>
                    </div>
                </form>
            </div>
            {isCancelModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                    <div className="bg-white dark:bg-slate-800 rounded-sm w-full max-w-lg shadow-md overflow-hidden animate-fade-in border border-slate-200 dark:border-slate-700">
                        <div className="p-8">
                            <div className="w-16 h-16 bg-red-100 dark:bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm">
                                <AlertCircle size={32} />
                            </div>
                            
                            {cancelStep === 1 ? (
                                <div className="text-center space-y-4">
                                    <h3 className="text-2xl font-bold text-slate-900 dark:text-white">Are you completely sure?</h3>
                                    <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                                        If you cancel your <strong className="capitalize">{planData?.planType}</strong> plan, at the end of the current billing cycle your account will be forcefully downgraded to the <strong>Hobby</strong> tier.
                                    </p>
                                    <div className="bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-500/20 rounded-sm p-4 text-left mt-4 mb-2">
                                        <h4 className="font-bold text-red-800 dark:text-red-400 mb-2 flex items-center gap-2">
                                            <AlertCircle size={16} /> You will lose access to:
                                        </h4>
                                        <ul className="list-disc list-inside text-sm text-red-700/80 dark:text-red-400/80 space-y-1 ml-1">
                                            <li>Increased container and RAM limits</li>
                                            <li>Advanced Custom Domains</li>
                                            <li>Premium Support SLA</li>
                                            <li>Organization management capabilities</li>
                                        </ul>
                                        <p className="text-xs font-bold text-red-800 dark:text-red-400 mt-3 uppercase tracking-wider">
                                            Any containers exceeding hobby limits will automatically be stopped.
                                        </p>
                                    </div>
                                    <div className="flex gap-3 pt-4">
                                        <button 
                                            onClick={() => setIsCancelModalOpen(false)}
                                            className="flex-1 py-3 px-4 rounded-sm bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                                        >
                                            Keep My Plan
                                        </button>
                                        <button 
                                            onClick={() => setCancelStep(2)}
                                            className="flex-1 py-3 px-4 rounded-sm bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/30 dark:hover:bg-red-500/20 font-bold transition-colors"
                                        >
                                            Continue Cancellation
                                        </button>
                                    </div>
                                </div>
                            ) : cancelStep === 2 ? (
                                <div className="text-center space-y-4 animate-fade-in">
                                    <h3 className="text-2xl font-bold text-slate-900 dark:text-white">We hate to see you go...</h3>
                                    <p className="text-slate-600 dark:text-slate-400">Please tell us why you are leaving so we can understand where to improve.</p>
                                    
                                    <div className="space-y-3 mt-4 text-left max-h-48 overflow-y-auto px-2 custom-scrollbar">
                                        {['Too expensive', 'Missing features', 'Don\'t use it enough', 'Switching to a competitor', 'Other / Prefer not to say'].map(reason => (
                                            <label key={reason} className={`flex items-center p-3.5 rounded-sm border cursor-pointer transition-colors ${cancelReason === reason ? 'border-brand-500 bg-brand-50 dark:bg-brand-500/10' : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
                                                <input type="radio" className="mr-3 w-4 h-4 text-brand-600" name="cancelReason" checked={cancelReason === reason} onChange={() => setCancelReason(reason)} />
                                                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{reason}</span>
                                            </label>
                                        ))}
                                    </div>

                                    <div className="flex gap-3 pt-4">
                                        <button 
                                            onClick={() => setCancelStep(1)}
                                            className="flex-1 py-3 px-4 rounded-sm bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                                        >
                                            Go Back
                                        </button>
                                        <button 
                                            onClick={() => setCancelStep(3)}
                                            disabled={!cancelReason}
                                            className="flex-1 py-3 px-4 rounded-sm bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/30 dark:hover:bg-red-500/20 font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            Next Step
                                        </button>
                                    </div>
                                </div>
                            ) : cancelStep === 3 ? (
                                <div className="text-center space-y-4 animate-fade-in pb-2">
                                    <h3 className="text-2xl font-bold text-slate-900 dark:text-white pt-2">Are you sure?</h3>
                                    <p className="text-slate-600 dark:text-slate-400 max-w-sm mx-auto leading-relaxed">
                                        We really don't want to lose you! Our platform is constantly evolving and we have awesome new features on the roadmap that we'd love for you to experience. Stay with us!
                                    </p>
                                    <div className="flex gap-3 pt-6">
                                        <button 
                                            onClick={() => setIsCancelModalOpen(false)}
                                            className="flex-1 py-3 px-4 rounded-sm bg-brand-600 text-white font-bold hover:bg-brand-700 transition-colors shadow-sm shadow-brand-500/30"
                                        >
                                            I'll Stay
                                        </button>
                                        <button 
                                            onClick={goToFinalStep}
                                            className="flex-1 py-3 px-4 rounded-sm bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 font-bold hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                                        >
                                            No, Continue
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center space-y-4 animate-fade-in">
                                    <h3 className="text-2xl font-bold text-slate-900 dark:text-white">Final Confirmation</h3>
                                    <p className="text-slate-600 dark:text-slate-400 text-sm">
                                        This process cannot be undone. To definitively cancel your subscription, please type <strong className="select-none inline-block bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded">I AGREE TO CANCEL</strong> below. You cannot copy-paste it.
                                    </p>
                                    <input 
                                        type="text" 
                                        placeholder="Type exactly: I AGREE TO CANCEL"
                                        value={cancelConfirmText}
                                        onChange={(e) => setCancelConfirmText(e.target.value)}
                                        onPaste={(e) => { e.preventDefault(); addToast('Warning', 'Copy-pasting is not allowed for this confirmation', 'error') }}
                                        className="w-full mt-4 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-sm p-3 text-center tracking-wide font-bold text-slate-800 dark:text-white outline-none focus:ring-2 ring-red-500"
                                    />
                                    <div className="flex gap-3 pt-6">
                                        <button 
                                            onClick={() => setIsCancelModalOpen(false)}
                                            className="flex-1 py-3 px-4 rounded-sm bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                                        >
                                            Change Mind, Keep Plan
                                        </button>
                                        <button 
                                            onClick={executeCancelPlan}
                                            disabled={cancelConfirmText !== 'I AGREE TO CANCEL' || cancelling || countdown > 0}
                                            className="flex-1 py-3 px-4 rounded-sm bg-red-600 text-white font-bold hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm shadow-red-500/30"
                                        >
                                            {cancelling ? 'Scheduling...' : countdown > 0 ? `Wait ${countdown}s...` : 'Confirm Cancellation'}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Settings;
