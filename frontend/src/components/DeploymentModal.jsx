import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNotifications } from '../context/NotificationContext';
import { useNavigate } from 'react-router-dom';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';

const DeploymentModal = () => {
    const { t } = useTranslation();
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
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-md p-6 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                <div className="text-center">
                    {!isFinished && (
                        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-brand-100 dark:bg-brand-900/30 mb-6">
                            <Loader2 size={32} className="text-brand-600 dark:text-brand-400 animate-spin" />
                        </div>
                    )}
                    
                    {isFinished && !isError && (
                        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30 mb-6">
                            <CheckCircle2 size={32} className="text-green-600 dark:text-green-400" />
                        </div>
                    )}

                    {isFinished && isError && (
                        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30 mb-6">
                            <XCircle size={32} className="text-red-600 dark:text-red-400" />
                        </div>
                    )}

                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                        {!isFinished ? t('auto.deploying_container') || 'Deploying...' : isError ? t('auto.deployment_failed') || 'Deployment Failed' : t('auto.deployment_successful') || 'Deployment Successful'}
                    </h3>
                    
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-6 font-medium animate-pulse">
                        {status || 'Initializing deployment...'}
                    </p>

                    {details && (
                        <div className="bg-gray-100 dark:bg-slate-800 p-3 rounded text-left text-xs text-gray-600 dark:text-gray-400 font-mono mb-6 max-h-32 overflow-y-auto">
                            {details}
                        </div>
                    )}

                    {isFinished && (
                        <button
                            onClick={handleClose}
                            className={`w-full py-2.5 px-4 rounded font-medium transition-colors ${
                                isError 
                                ? 'bg-red-600 hover:bg-red-700 text-white' 
                                : 'bg-brand-600 hover:bg-brand-700 text-white'
                            }`}
                        >
                            {isError ? t('auto.close') || 'Close' : t('auto.go_to_containers') || 'Go to Containers'}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default DeploymentModal;
