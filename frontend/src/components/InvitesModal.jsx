import { useTranslation } from "react-i18next";import React from 'react';
import { Mail, Check, X, Building2 } from 'lucide-react';
import { useNotifications } from '../context/NotificationContext';
import { useOrg } from '../context/OrgContext';
import { useNavigate } from 'react-router-dom';

const InvitesModal = ({ isOpen, onClose }) => {const { t } = useTranslation();
  const { invites, acceptInvite, declineInvite } = useNotifications();
  const { refreshOrgs } = useOrg();
  const navigate = useNavigate();

  if (!isOpen) return null;

  const handleAccept = async (inviteId) => {
    try {
      const data = await acceptInvite(inviteId);
      // Refresh org context to show the new organization in the switcher
      await refreshOrgs();
      // Automatically switch to the org?
      if (data?.organizationId && typeof data.organizationId === 'string') {
        localStorage.setItem('activeOrgId', data.organizationId);
      } else if (data?.organizationId?._id) {
        localStorage.setItem('activeOrgId', data.organizationId._id);
      }

      navigate('/app/organization'); // Or just close
    } catch (e) {

      // Error handled by context toaster
    }};

  const handleDecline = async (inviteId) => {
    try {
      await declineInvite(inviteId);
    } catch (e) {

      // Error handled by context toaster
    }};

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-fade-in relative">
                <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
                    <h3 className="font-bold flex items-center gap-2 text-lg text-slate-800 dark:text-slate-200">
                        <Mail size={20} className="text-brand-500" /> {t("auto.pending_invitations")}
                        {invites.length > 0 && <span className="bg-brand-500 text-white text-xs px-2 py-0.5 rounded-full">{invites.length}</span>}
                    </h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors">✕</button>
                </div>

                <div className="p-4 max-h-[60vh] overflow-y-auto custom-scrollbar">
                    {invites.length === 0 ?
          <div className="text-center py-8 text-slate-500 dark:text-slate-400 flex flex-col items-center">
                            <Mail size={40} className="text-slate-300 dark:text-slate-600 mb-3" />
                            <p>{t("auto.you_have_no_pending_invitations_")}</p>
                        </div> :

          <div className="space-y-3">
                            {invites.map((inv) =>
            <div key={inv._id} className="border border-slate-100 dark:border-slate-700 rounded-xl p-4 flex flex-col gap-3 bg-slate-50/50 dark:bg-slate-900/30">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-brand-500/10 text-brand-600 dark:text-brand-400 flex items-center justify-center shrink-0">
                                            <Building2 size={20} />
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-slate-800 dark:text-slate-200">{inv.organizationName}</h4>
                                            <p className="text-sm text-slate-500 dark:text-slate-400">{t("auto.role_")} <span className="font-medium text-slate-700 dark:text-slate-300">{inv.roleName}</span></p>
                                        </div>
                                    </div>

                                    <div className="flex gap-2 mt-1">
                                        <button
                  onClick={() => handleAccept(inv._id)}
                  className="flex-1 bg-brand-600 hover:bg-brand-700 text-white font-medium py-2 rounded-lg flex items-center justify-center gap-2 transition-all">
                  
                                            <Check size={16} /> {t("auto.accept")}
                                        </button>
                                        <button
                  onClick={() => handleDecline(inv._id)}
                  className="flex-1 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-medium py-2 rounded-lg flex items-center justify-center gap-2 transition-all">
                  
                                            <X size={16} /> {t("auto.decline")}
                                        </button>
                                    </div>
                                    <p className="text-xs text-center text-slate-400 mt-1">{t("auto.expires_")} {new Date(inv.expiresAt).toLocaleDateString()}</p>
                                </div>
            )}
                        </div>
          }
                </div>
            </div>
        </div>);

};

export default InvitesModal;