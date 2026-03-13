import React, { useState, useRef, useEffect } from 'react';
import { useOrg } from '../context/OrgContext';
import { Building2, UserCircle, Check, ChevronDown, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const OrgSwitcher = () => {
    const { organizations, activeOrg, switchOrganization, loadingOrgs, userPlan } = useOrg();
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef(null);
    const navigate = useNavigate();

    const planType = userPlan || 'free';
    const canManageOrgs = ['enterprise', 'agency', 'msp', 'partner'].includes(planType);

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    if (loadingOrgs) {
        return (
            <div className="animate-pulse flex items-center space-x-3 px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800/50 w-full h-12">
                <div className="w-6 h-6 bg-slate-200 dark:bg-slate-700 rounded-md"></div>
                <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/2"></div>
            </div>
        );
    }

    const currentName = activeOrg ? activeOrg.name : 'Personal Workspace';
    const currentInitials = activeOrg ? activeOrg.name.substring(0, 2).toUpperCase() : 'ME';

    return (
        <div className="relative w-full mb-4" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700/50 bg-white/50 dark:bg-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all group"
            >
                <div className="flex items-center space-x-3 truncate">
                    <div className="w-8 h-8 rounded-lg bg-brand-500/10 text-brand-600 dark:text-brand-400 flex flex-shrink-0 items-center justify-center font-bold text-sm border border-brand-500/20">
                        {activeOrg ? <Building2 size={16} /> : <UserCircle size={18} />}
                    </div>
                    <div className="flex flex-col items-start truncate">
                        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                            {activeOrg ? 'Organization' : 'Workspace'}
                        </span>
                        <span className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[120px]">
                            {currentName}
                        </span>
                    </div>
                </div>
                <ChevronDown size={16} className={`text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Dropdown Menu */}
            {isOpen && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xl overflow-hidden z-50 py-1">
                    <div className="max-h-60 overflow-y-auto custom-scrollbar">
                        {/* Personal Workspace Option */}
                        <button
                            onClick={() => { switchOrganization(null); setIsOpen(false); }}
                            className={`w-full flex items-center justify-between px-4 py-2.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors ${!activeOrg ? 'bg-brand-50/50 dark:bg-brand-500/10' : ''}`}
                        >
                            <div className="flex items-center space-x-3">
                                <UserCircle size={18} className={!activeOrg ? 'text-brand-600 dark:text-brand-400' : 'text-slate-500 dark:text-slate-400'} />
                                <span className={!activeOrg ? 'font-semibold text-brand-700 dark:text-brand-300' : 'font-medium text-slate-700 dark:text-slate-300'}>
                                    Personal Workspace
                                </span>
                            </div>
                            {!activeOrg && <Check size={16} className="text-brand-600 dark:text-brand-400" />}
                        </button>

                        {organizations.length > 0 && (
                            <div className="px-4 py-2 text-xs font-semibold text-slate-400 uppercase tracking-wider border-t border-slate-100 dark:border-slate-700 mt-1">
                                Organizations
                            </div>
                        )}

                        {organizations.map(org => (
                            <button
                                key={org._id}
                                onClick={() => { switchOrganization(org._id); setIsOpen(false); }}
                                className={`w-full flex items-center justify-between px-4 py-2.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors ${activeOrg?._id === org._id ? 'bg-brand-50/50 dark:bg-brand-500/10' : ''}`}
                            >
                                <div className="flex items-center space-x-3 truncate">
                                    <div className={`w-6 h-6 rounded flex flex-shrink-0 items-center justify-center text-xs font-bold ${activeOrg?._id === org._id ? 'bg-brand-500 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}>
                                        {org.name.substring(0, 1).toUpperCase()}
                                    </div>
                                    <span className={`truncate ${activeOrg?._id === org._id ? 'font-semibold text-brand-700 dark:text-brand-300' : 'font-medium text-slate-700 dark:text-slate-300'}`}>
                                        {org.name}
                                    </span>
                                </div>
                                {activeOrg?._id === org._id && <Check size={16} className="text-brand-600 dark:text-brand-400" />}
                            </button>
                        ))}
                    </div>

                    {canManageOrgs && (
                        <div className="border-t border-slate-100 dark:border-slate-700 p-2">
                            <button
                                onClick={() => { switchOrganization(null); setIsOpen(false); navigate('/app/organization'); }}
                                className="w-full flex items-center justify-center space-x-2 px-3 py-2 bg-brand-50/50 dark:bg-slate-700/50 hover:bg-brand-100 dark:hover:bg-brand-900/40 text-brand-700 dark:text-brand-300 rounded-lg transition-colors text-sm font-semibold"
                            >
                                <Plus size={16} />
                                <span>Manage Orgs</span>
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default OrgSwitcher;
