import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useToast } from '../components/ToastContext';
import { Building2, CheckCircle2, XCircle } from 'lucide-react';

const InviteAccept = () => {
    const { token } = useParams();
    const navigate = useNavigate();
    const { addToast } = useToast();
    const [loading, setLoading] = useState(true);
    const [details, setDetails] = useState(null);
    const [error, setError] = useState('');

    useEffect(() => {
        // Fetch invite details strictly to show what they are accepting
        const fetchInvite = async () => {
            try {
                // We'll create an endpoint in orgRoutes that just reads invite details by token
                const res = await axios.get(`/api/organizations/invite/${token}`);
                setDetails(res.data);
            } catch (err) {
                setError(err.response?.data?.message || 'Invalid or expired invitation token.');
            } finally {
                setLoading(false);
            }
        };

        fetchInvite();
    }, [token]);

    const handleAccept = async () => {
        setLoading(true);
        try {
            await axios.post(`/api/organizations/invite/${token}/accept`);
            addToast('Welcome!', 'You joined the organization successfully.', 'success');
            navigate('/app');
        } catch (err) {
            // If strictly 401, they might need to login
            if (err.response?.status === 401) {
                addToast('Authentication Required', 'Please log in or register before accepting this invite.', 'warning');
                // Could store token in local storage to handle post-login redirect, but let's keep it simple for now
                navigate('/login');
            } else {
                setError(err.response?.data?.message || 'Failed to accept invitation.');
                addToast('Error', err.response?.data?.message || 'Failed to accept invitation.', 'error');
            }
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 dark:bg-[#0b1120] flex items-center justify-center p-4">
                <div className="animate-pulse flex flex-col items-center">
                    <div className="w-16 h-16 border-4 border-brand-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                    <p className="text-slate-500 font-medium">Validating invitation...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-slate-50 dark:bg-[#0b1120] flex items-center justify-center p-4">
                <div className="max-w-md w-full bg-white dark:bg-slate-800 rounded-sm p-8 shadow-sm text-center border border-slate-200 dark:border-slate-700">
                    <div className="w-16 h-16 mx-auto bg-rose-100 dark:bg-rose-900/30 text-rose-500 rounded-full flex items-center justify-center mb-6">
                        <XCircle size={32} />
                    </div>
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Invitation Error</h2>
                    <p className="text-slate-600 dark:text-slate-400 mb-8">{error}</p>
                    <button onClick={() => navigate('/')} className="w-full bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold py-3 rounded-sm hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors">
                        Go Home
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-[#0b1120] flex items-center justify-center p-4 relative overflow-hidden">
            <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] rounded-full bg-brand-500/20 blur-[120px] pointer-events-none z-0"></div>

            <div className="max-w-md w-full bg-white dark:bg-slate-800/80 backdrop-blur-xl rounded-sm p-8 shadow-md border border-slate-200 dark:border-slate-700/50 relative z-10 text-center transform hover:scale-[1.02] transition-transform duration-300">
                <div className="w-20 h-20 mx-auto bg-brand-50 dark:bg-brand-900/20 text-brand-600 dark:text-brand-400 rounded-sm flex items-center justify-center mb-6 shadow-inner border border-brand-200 dark:border-brand-500/30">
                    <Building2 size={40} />
                </div>

                <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white mb-2 tracking-tight">You've Been Invited!</h1>

                <div className="bg-slate-50 dark:bg-slate-900/50 rounded-sm p-6 my-8 border border-slate-100 dark:border-slate-700">
                    <p className="text-slate-600 dark:text-slate-400 mb-4 font-medium">
                        You have been invited to join:
                    </p>
                    <p className="text-2xl font-bold text-brand-600 dark:text-brand-400 mb-2 truncate">
                        {details?.organizationName}
                    </p>
                    <div className="inline-flex items-center space-x-2 bg-slate-200 dark:bg-slate-800 px-4 py-1.5 rounded-full mt-2">
                        <span className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider font-bold">Role:</span>
                        <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">{details?.roleName}</span>
                    </div>
                </div>

                <div className="space-y-3">
                    <button
                        onClick={handleAccept}
                        className="w-full bg-brand-600 hover:bg-brand-700 text-white font-bold py-4 rounded-sm shadow-sm shadow-brand-500/30 hover:shadow-brand-500/50 hover:-translate-y-1 transition-all flex items-center justify-center"
                    >
                        <CheckCircle2 size={20} className="mr-2" />
                        Accept Invitation
                    </button>

                    <button
                        onClick={() => navigate('/')}
                        className="w-full bg-transparent text-slate-500 dark:text-slate-400 font-medium py-3 rounded-sm hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                        Decline & Go Home
                    </button>
                    <p className="text-xs text-slate-400 mt-4">Note: If you do not have an account, you will be asked to create one.</p>
                </div>
            </div>
        </div>
    );
};

export default InviteAccept;
