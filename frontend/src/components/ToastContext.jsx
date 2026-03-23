import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { AlertTriangle, Info, CheckCircle, X, Terminal } from 'lucide-react';

const ToastContext = createContext(null);

export const useToast = () => useContext(ToastContext);

export const ToastProvider = ({ children }) => {
    const [toasts, setToasts] = useState([]);

    const removeToast = useCallback((id) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    const addToast = useCallback((title, message, type = 'info', actionLabel = null, onAction = null) => {
        console.log('[Toast System] Spawning toast:', title, message);
        const id = String(Date.now() + Math.random());
        setToasts(prev => [...prev, { id, title, message, type, actionLabel, onAction }]);
        // Auto remove after 6 seconds unless it has an action
        if (!actionLabel) {
            setTimeout(() => removeToast(id), 6000);
        }
    }, [removeToast]);

    return (
        <ToastContext.Provider value={{ addToast }}>
            {children}
            <div className="fixed bottom-10 right-10 z-[999999] flex flex-col gap-4 pointer-events-none w-80">
                {toasts.map(toast => (
                    <div
                        key={toast.id}
                        className={`p-4 rounded-xl shadow-2xl border backdrop-blur-md flex items-start space-x-3 transform animate-toast-in pointer-events-auto ${toast.type === 'error' ? 'bg-rose-900/90 border-rose-500/50 text-white' :
                            toast.type === 'warning' ? 'bg-amber-900/90 border-amber-500/50 text-white' :
                                toast.type === 'success' ? 'bg-emerald-900/90 border-emerald-500/50 text-white' :
                                    'bg-slate-800/95 border-slate-600/50 text-white'
                            }`}
                    >
                        <div className="mt-0.5 flex-shrink-0">
                            {toast.type === 'error' && <AlertTriangle size={20} className="text-rose-400" />}
                            {toast.type === 'warning' && <AlertTriangle size={20} className="text-amber-400" />}
                            {toast.type === 'success' && <CheckCircle size={20} className="text-emerald-400" />}
                            {toast.type === 'info' && <Info size={20} className="text-brand-400" />}
                        </div>
                        <div className="flex-1">
                            <h4 className="font-bold text-sm mb-1">{toast.title}</h4>
                            <p className="text-sm opacity-90 leading-snug">{toast.message}</p>

                            {toast.actionLabel && (
                                <div className="mt-3">
                                    <button
                                        onClick={() => {
                                            if (toast.onAction) toast.onAction();
                                            removeToast(toast.id);
                                        }}
                                        className="text-xs bg-black/30 hover:bg-black/50 px-3 py-1.5 rounded-lg font-semibold flex items-center transition-colors"
                                    >
                                        <Terminal size={12} className="mr-1.5" />
                                        {toast.actionLabel}
                                    </button>
                                </div>
                            )}
                        </div>
                        <button
                            onClick={() => removeToast(toast.id)}
                            className="text-white/50 hover:text-white transition-colors"
                        >
                            <X size={16} />
                        </button>
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    );
};
