import React from 'react';
import { useNotifications } from '../context/NotificationContext';
import { useNavigate } from 'react-router-dom';
import { Loader2, CheckCircle2, XCircle, ChevronRight, Server, Activity } from 'lucide-react';

const DeploymentModal = () => {
    const { activeDeployment, clearDeployment } = useNotifications();
    const navigate = useNavigate();

    if (!activeDeployment) return null;

    const { status, isFinished, isError, details } = activeDeployment;

    const handleClose = () => {
        clearDeployment();
        if (isFinished && !isError) {
            navigate('/app/containers');
        }
    };

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/40 backdrop-blur-md p-4 animate-in fade-in duration-300">
            <div className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-2xl shadow-brand-500/10 w-full max-w-md overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-4 duration-500">
                
                {/* Top decorative gradient bar */}
                <div className={`h-1.5 w-full ${isError ? 'bg-gradient-to-r from-red-500 to-rose-600' : isFinished ? 'bg-gradient-to-r from-emerald-400 to-green-500' : 'bg-gradient-to-r from-brand-400 to-brand-600'}`}></div>

                <div className="p-8">
                    <div className="flex flex-col items-center text-center">
                        
                        {/* Animated Icon Container */}
                        <div className="relative mb-6">
                            {!isFinished && (
                                <>
                                    <div className="absolute inset-0 bg-brand-500/20 rounded-full animate-ping opacity-75"></div>
                                    <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-brand-50 dark:bg-brand-900/20 border border-brand-100 dark:border-brand-800 shadow-inner">
                                        <Loader2 size={36} className="text-brand-600 dark:text-brand-400 animate-spin" />
                                    </div>
                                </>
                            )}
                            
                            {isFinished && !isError && (
                                <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800 shadow-sm animate-in zoom-in-50 duration-500">
                                    <CheckCircle2 size={40} className="text-emerald-600 dark:text-emerald-400" />
                                </div>
                            )}

                            {isFinished && isError && (
                                <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 shadow-sm animate-in zoom-in-50 duration-500">
                                    <XCircle size={40} className="text-red-600 dark:text-red-400" />
                                </div>
                            )}
                        </div>

                        {/* Text Content */}
                        <h3 className="text-2xl font-bold text-slate-800 dark:text-white mb-3 tracking-tight">
                            {!isFinished ? 'Deploying Infrastructure' : isError ? 'Deployment Failed' : 'Deployment Successful'}
                        </h3>
                        
                        <div className="flex items-center justify-center space-x-2 text-sm text-slate-500 dark:text-slate-400 mb-8 font-medium">
                            <Activity size={16} className={!isFinished ? "animate-pulse text-brand-500" : (isError ? "text-red-500" : "text-emerald-500")} />
                            <span className={!isFinished ? "animate-pulse" : ""}>
                                {status || 'Initializing orchestration...'}
                            </span>
                        </div>

                        {/* Error Details if any */}
                        {details && (
                            <div className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 p-4 rounded-xl text-left text-xs text-slate-600 dark:text-slate-400 font-mono mb-8 max-h-40 overflow-y-auto shadow-inner">
                                {details}
                            </div>
                        )}

                        {/* Action Button */}
                        {isFinished && (
                            <button
                                onClick={handleClose}
                                className={`group relative w-full flex items-center justify-center py-3.5 px-6 rounded-xl font-bold text-white transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 ${
                                    isError 
                                    ? 'bg-red-600 hover:bg-red-500 hover:shadow-red-500/25' 
                                    : 'bg-slate-900 hover:bg-slate-800 dark:bg-brand-600 dark:hover:bg-brand-500 dark:hover:shadow-brand-500/25'
                                }`}
                            >
                                <span>{isError ? 'Dismiss Error' : 'Manage Containers'}</span>
                                {!isError && <ChevronRight size={18} className="ml-2 transition-transform group-hover:translate-x-1" />}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DeploymentModal;
