import { useTranslation } from "react-i18next";
import React, { useState, useEffect } from 'react';
import { User, Shield, Bell, Save, AlertCircle, CreditCard, CalendarX2 } from 'lucide-react';
import axios from 'axios';
import { useToast } from '../components/ToastContext';

const PLAN_PRIORITY = {
  agency: 0,
  enterprise: 1,
  pro: 2,
  free: 3
};
const PAID_PLANS_SORTED = ['agency', 'enterprise', 'pro'];

const Settings = () => {
  const { t } = useTranslation();
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
  const [showChangePlan, setShowChangePlan] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState('');
  const [changingPlan, setChangingPlan] = useState(false);
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
        const normalizedPlan = (res.data.planType || 'free').toLowerCase();
        setPlanData({
          planType: normalizedPlan,
          planExpiresAt: res.data.planExpiresAt,
          autoRenew: res.data.autoRenew,
          pendingPlanType: res.data.pendingPlanType || null,
          planChangeAt: res.data.planChangeAt || null
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
      timer = setTimeout(() => setCountdown((prev) => prev - 1), 1000);
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
      setPlanData((prev) => ({
        ...prev,
        autoRenew: false,
        planExpiresAt: res.data.planExpiresAt,
        pendingPlanType: res.data.pendingPlanType || 'free',
        planChangeAt: res.data.planChangeAt || null
      }));
      addToast(t("auto.plan_cancelled_title"), res.data.message, 'success');
      setIsCancelModalOpen(false);
    } catch (error) {
      addToast(t("common.error"), error.response?.data?.message || t("auto.failed_to_cancel_plan"), 'error');
    } finally {
      setCancelling(false);
    }
  };

  const availableDowngradePlans = (() => {
    if (!planData?.planType || planData.planType === 'free') return [];
    const currentPriority = PLAN_PRIORITY[planData.planType];
    return PAID_PLANS_SORTED.filter((plan) =>
      PLAN_PRIORITY[plan] > currentPriority && plan !== 'free'
    );
  })();

  useEffect(() => {
    if (!showChangePlan) return;
    if (availableDowngradePlans.length === 0) {
      setSelectedPlan('');
      return;
    }
    setSelectedPlan((prev) => (prev && availableDowngradePlans.includes(prev) ? prev : availableDowngradePlans[0]));
  }, [showChangePlan, planData?.planType]);

  const executePlanChange = async () => {
    if (!selectedPlan) return;
    setChangingPlan(true);
    try {
      const res = await axios.post('/api/plans/upgrade', { planType: selectedPlan });
      setPlanData((prev) => ({
        ...prev,
        planType: (res.data.planType || prev.planType).toLowerCase(),
        pendingPlanType: res.data.pendingPlanType || null,
        planChangeAt: res.data.planChangeAt || null,
        autoRenew: res.data.autoRenew
      }));
      addToast(t("auto.plan_change_scheduled_title"), t("auto.plan_change_success_to", { plan: selectedPlan.toUpperCase() }), 'success');
      setShowChangePlan(false);
      setSelectedPlan('');
    } catch (error) {
      addToast(t("auto.plan_change_failed_title"), error.response?.data?.message || t("auto.plan_change_failed_message"), 'error');
    } finally {
      setChangingPlan(false);
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
                <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-2">{t("auto.settings")}</h1>
                <p className="text-slate-600 dark:text-slate-400 text-base sm:text-lg">{t("auto.manage_your_account_preferences_and_appl")}</p>
            </div>

            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-sm p-8 shadow-sm">
                <h3 className="text-xl font-bold mb-6 flex items-center space-x-2 border-b border-slate-200 dark:border-slate-700 pb-4">
                    <User className="text-brand-500 dark:text-brand-400" />
                    <span>{t("auto.profile_management")}</span>
                </h3>

                <form onSubmit={handleSave} className="space-y-6">
                    {saved &&
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-600 dark:bg-emerald-500/10 dark:border-emerald-500/50 dark:text-emerald-500 text-sm py-4 px-4 rounded-sm flex items-start space-x-3">
                            <Save size={20} className="shrink-0 mt-0.5" />
                            <span>{t("auto.settings_saved_successfully_")}</span>
                        </div>
          }

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">{t("auto.full_name")}</label>
                            <input
                type="text"
                disabled
                value={name}
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-sm text-slate-500 dark:text-slate-400 cursor-not-allowed mb-4" />
              
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">{t("auto.email_address")}</label>
                            <input
                type="email"
                disabled
                value={email}
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-sm text-slate-500 dark:text-slate-400 cursor-not-allowed" />
              
                            <p className="text-xs text-slate-500 mt-2">{t("auto.credentials_cannot_be_changed_after_regi")}</p>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">{t("auto.role")}</label>
                            <div className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-sm text-slate-600 dark:text-slate-400 flex items-center space-x-2">
                                {role === 'admin' ?
                <>
                                        <Shield size={16} className="text-purple-600 dark:text-purple-400" />
                                        <span className="text-purple-600 dark:text-purple-400 font-semibold">{t("auto.administrator")}</span>
                                    </> :

                <>
                                        <User size={16} className="text-slate-600 dark:text-slate-400" />
                                        <span>{t("auto.standard_user")}</span>
                                    </>
                }
                            </div>
                            {role === 'admin' && <p className="text-xs text-purple-600/80 dark:text-purple-400/80 mt-2">{t("auto.you_have_unrestricted_administrative_acc")}</p>}
                        </div>
                    </div>

                    <h3 className="text-xl font-bold mt-10 mb-6 flex items-center space-x-2 border-b border-slate-200 dark:border-slate-700 pb-4">
                        <Bell className="text-amber-500 dark:text-amber-400" />
                        <span>{t("auto.preferences")}</span>
                    </h3>

                    <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-sm">
                        <div>
                            <h4 className="font-semibold text-slate-900 dark:text-white">{t("auto.receive_alert_notifications")}</h4>
                            <p className="text-sm text-slate-600 dark:text-slate-400">{t("auto.get_notified_when_a_container_crashes_or")}</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" className="sr-only peer" checked={notifications} onChange={(e) => setNotifications(e.target.checked)} />
                            <div className="w-11 h-6 bg-slate-300 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-500"></div>
                        </label>
                    </div>

                    <h3 className="text-xl font-bold mt-10 mb-6 flex items-center space-x-2 border-b border-slate-200 dark:border-slate-700 pb-4">
                        <CreditCard className="text-indigo-500 dark:text-indigo-400" />
                        <span>{t("auto.subscription_management")}</span>
                    </h3>

                    <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-sm p-6">
                        {planData ?
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                                <div className="space-y-1">
                                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">{t("auto.current_plan")}</p>
                                    <div className="flex items-center gap-3">
                                        <h4 className="text-2xl font-black text-slate-900 dark:text-white capitalize">{planData.planType}</h4>
                                        {planData.planType !== 'free' &&
                  <span className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${planData.autoRenew ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400' : 'bg-amber-100 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400'}`}>
                                                {planData.autoRenew ? t("auto.auto_renews") : t("auto.cancels_automatically")}
                                            </span>
                  }
                                    </div>
                                    <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
                                        {planData.planType === 'free' ? t("auto.you_are_on_hobby_forever") : t("auto.billing_cycle_ends_on", { date: new Date(planData.planExpiresAt).toLocaleDateString() })}
                                    </p>
                                    {planData.pendingPlanType && (
                                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                        {t("auto.scheduled_change_to")} {String(planData.pendingPlanType).toUpperCase()}
                                        {planData.planChangeAt ? ` ${t("auto.on_date")} ${new Date(planData.planChangeAt).toLocaleDateString()}` : ''}
                                      </p>
                                    )}
                                </div>
                                
                                {planData.planType !== 'free' &&
                                  <div className="shrink-0 flex flex-col sm:flex-row gap-2">
                                    <button
                                      type="button"
                                      disabled={changingPlan || cancelling || availableDowngradePlans.length === 0}
                                      onClick={() => setShowChangePlan((prev) => !prev)}
                                      className="flex items-center justify-center space-x-2 py-2.5 px-6 rounded-sm text-sm font-bold border border-amber-200 text-amber-700 bg-amber-50 hover:bg-amber-100 dark:border-amber-500/20 dark:text-amber-300 dark:bg-amber-500/10 dark:hover:bg-amber-500/20 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                      <span>{t("auto.change_plan_button")}</span>
                                    </button>
                                    {planData.autoRenew &&
                                      <button
                                        type="button"
                                        disabled={cancelling || changingPlan}
                                        onClick={startCancelProcess}
                                        className="flex items-center justify-center space-x-2 py-2.5 px-6 rounded-sm text-sm font-bold border border-red-200 text-red-600 bg-red-50 hover:bg-red-100 dark:border-red-500/20 dark:text-red-400 dark:bg-red-500/10 dark:hover:bg-red-500/20 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                                      >
                                        <CalendarX2 size={18} />
                                        <span>{cancelling ? t("auto.cancelling_") : t("auto.cancel_plan_button")}</span>
                                      </button>
                                    }
                                  </div>
                                }
                            </div> :

            <div className="animate-pulse text-sm text-slate-500">{t("auto.loading_subscription_data_")}</div>
            }
                    </div>
                    {planData?.planType !== 'free' && showChangePlan && (
                      <div className="mt-4 border border-slate-200 dark:border-slate-700 rounded-sm p-4 bg-slate-50 dark:bg-slate-900">
                        <p className="text-sm font-semibold mb-3">{t("auto.choose_lower_plan")}</p>
                        <div className="flex flex-col sm:flex-row gap-2">
                          <select
                            value={selectedPlan}
                            onChange={(e) => setSelectedPlan(e.target.value)}
                            className="flex-1 px-3 py-2 rounded-sm border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800"
                          >
                            <option value="">{t("auto.select_a_plan")}</option>
                            {availableDowngradePlans.map((plan) => (
                              <option key={plan} value={plan}>{plan.toUpperCase()}</option>
                            ))}
                          </select>
                          <button
                            type="button"
                            onClick={executePlanChange}
                            disabled={!selectedPlan || changingPlan}
                            className="px-4 py-2 rounded-sm border border-amber-300 text-amber-700 dark:text-amber-300 dark:border-amber-500/40 hover:bg-amber-50 dark:hover:bg-amber-900/20 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {changingPlan ? t("auto.processing_") : t("auto.confirm_change")}
                          </button>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">{t("auto.change_plan_scheduled_note")}</p>
                      </div>
                    )}

                    <div className="pt-6">
                        <button
              type="submit"
              className="flex justify-center items-center space-x-2 py-3 px-8 rounded-sm shadow-sm text-sm font-bold text-white bg-brand-500 hover:bg-brand-600 transition-all hover:shadow-[0_0_20px_rgba(14,165,233,0.4)]">
              
                            <span>{t("auto.save_changes")}</span>
                        </button>
                    </div>
                </form>
            </div>
            {isCancelModalOpen &&
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                    <div className="bg-white dark:bg-slate-800 rounded-sm w-full max-w-lg shadow-md overflow-hidden animate-fade-in border border-slate-200 dark:border-slate-700">
                        <div className="p-8">
                            <div className="w-16 h-16 bg-red-100 dark:bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm">
                                <AlertCircle size={32} />
                            </div>
                            
                            {cancelStep === 1 ?
            <div className="text-center space-y-4">
                                    <h3 className="text-2xl font-bold text-slate-900 dark:text-white">{t("auto.are_you_completely_sure_")}</h3>
                                    <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                                        {t("auto.if_you_cancel_your")} <strong className="capitalize">{planData?.planType}</strong> {t("auto.plan_at_the_end_of_the_current_billing_c")} <strong>{t("auto.hobby")}</strong> {t("auto.tier_")}
                                    </p>
                                    <div className="bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-500/20 rounded-sm p-4 text-left mt-4 mb-2">
                                        <h4 className="font-bold text-red-800 dark:text-red-400 mb-2 flex items-center gap-2">
                                            <AlertCircle size={16} /> {t("auto.you_will_lose_access_to_")}
                                        </h4>
                                        <ul className="list-disc list-inside text-sm text-red-700/80 dark:text-red-400/80 space-y-1 ml-1">
                                            <li>{t("auto.increased_container_and_ram_limits")}</li>
                                            <li>{t("auto.advanced_custom_domains")}</li>
                                            <li>{t("auto.premium_support_sla")}</li>
                                            <li>{t("auto.organization_management_capabilities")}</li>
                                        </ul>
                                        <p className="text-xs font-bold text-red-800 dark:text-red-400 mt-3 uppercase tracking-wider">
                                            {t("auto.any_containers_exceeding_hobby_limits_wi")}
                                        </p>
                                    </div>
                                    <div className="flex gap-3 pt-4">
                                        <button
                  onClick={() => setIsCancelModalOpen(false)}
                  className="flex-1 py-3 px-4 rounded-sm bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors">
                                            {t("auto.keep_my_plan")}
                                        
                </button>
                                        <button
                  onClick={() => setCancelStep(2)}
                  className="flex-1 py-3 px-4 rounded-sm bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/30 dark:hover:bg-red-500/20 font-bold transition-colors">
                                            {t("auto.continue_cancellation")}
                                        
                </button>
                                    </div>
                                </div> :
            cancelStep === 2 ?
            <div className="text-center space-y-4 animate-fade-in">
                                    <h3 className="text-2xl font-bold text-slate-900 dark:text-white">{t("auto.we_hate_to_see_you_go_")}</h3>
                                    <p className="text-slate-600 dark:text-slate-400">{t("auto.please_tell_us_why_you_are_leaving_so_we")}</p>
                                    
                                    <div className="space-y-3 mt-4 text-left max-h-48 overflow-y-auto px-2 custom-scrollbar">
                                        {['Too expensive', 'Missing features', 'Don\'t use it enough', 'Switching to a competitor', 'Other / Prefer not to say'].map((reason) =>
                <label key={reason} className={`flex items-center p-3.5 rounded-sm border cursor-pointer transition-colors ${cancelReason === reason ? 'border-brand-500 bg-brand-50 dark:bg-brand-500/10' : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
                                                <input type="radio" className="mr-3 w-4 h-4 text-brand-600" name="cancelReason" checked={cancelReason === reason} onChange={() => setCancelReason(reason)} />
                                                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{reason}</span>
                                            </label>
                )}
                                    </div>

                                    <div className="flex gap-3 pt-4">
                                        <button
                  onClick={() => setCancelStep(1)}
                  className="flex-1 py-3 px-4 rounded-sm bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors">
                                            {t("auto.go_back")}
                                        
                </button>
                                        <button
                  onClick={() => setCancelStep(3)}
                  disabled={!cancelReason}
                  className="flex-1 py-3 px-4 rounded-sm bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/30 dark:hover:bg-red-500/20 font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                                            {t("auto.next_step")}
                                        
                </button>
                                    </div>
                                </div> :
            cancelStep === 3 ?
            <div className="text-center space-y-4 animate-fade-in pb-2">
                                    <h3 className="text-2xl font-bold text-slate-900 dark:text-white pt-2">{t("auto.are_you_sure_")}</h3>
                                    <p className="text-slate-600 dark:text-slate-400 max-w-sm mx-auto leading-relaxed">
                                        {t("auto.we_really_don_t_want_to_lose_you_our_pla")}
                                    </p>
                                    <div className="flex gap-3 pt-6">
                                        <button
                  onClick={() => setIsCancelModalOpen(false)}
                  className="flex-1 py-3 px-4 rounded-sm bg-brand-600 text-white font-bold hover:bg-brand-700 transition-colors shadow-sm shadow-brand-500/30">
                                            {t("auto.i_ll_stay")}
                                        
                </button>
                                        <button
                  onClick={goToFinalStep}
                  className="flex-1 py-3 px-4 rounded-sm bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 font-bold hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors">
                                            {t("auto.no_continue")}
                                        
                </button>
                                    </div>
                                </div> :

            <div className="text-center space-y-4 animate-fade-in">
                                    <h3 className="text-2xl font-bold text-slate-900 dark:text-white">{t("auto.final_confirmation")}</h3>
                                    <p className="text-slate-600 dark:text-slate-400 text-sm">
                                        {t("auto.this_process_cannot_be_undone_to_definit")} <strong className="select-none inline-block bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded">{t("auto.i_agree_to_cancel")}</strong> {t("auto.below_you_cannot_copy_paste_it_")}
                                    </p>
                                    <input
                type="text"
                placeholder={t("auto.type_exactly_i_agree_to_cancel")}
                value={cancelConfirmText}
                onChange={(e) => setCancelConfirmText(e.target.value)}
                onPaste={(e) => {e.preventDefault();addToast('Warning', 'Copy-pasting is not allowed for this confirmation', 'error');}}
                className="w-full mt-4 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-sm p-3 text-center tracking-wide font-bold text-slate-800 dark:text-white outline-none focus:ring-2 ring-red-500" />
              
                                    <div className="flex gap-3 pt-6">
                                        <button
                  onClick={() => setIsCancelModalOpen(false)}
                  className="flex-1 py-3 px-4 rounded-sm bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors">
                                            {t("auto.change_mind_keep_plan")}
                                        
                </button>
                                        <button
                  onClick={executeCancelPlan}
                  disabled={cancelConfirmText !== 'I AGREE TO CANCEL' || cancelling || countdown > 0}
                  className="flex-1 py-3 px-4 rounded-sm bg-red-600 text-white font-bold hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm shadow-red-500/30">
                  
                                            {cancelling ? 'Scheduling...' : countdown > 0 ? `Wait ${countdown}s...` : 'Confirm Cancellation'}
                                        </button>
                                    </div>
                                </div>
            }
                        </div>
                    </div>
                </div>
      }
        </div>);

};

export default Settings;