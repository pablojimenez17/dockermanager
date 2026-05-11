import { useTranslation } from "react-i18next";
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Star, Zap, Shield, AlertCircle, Building2 } from 'lucide-react';
import axios from 'axios';
import { useToast } from '../components/ToastContext';
import { useOrg } from '../context/OrgContext';

// Lower number = higher tier (must match backend/config/plans.js PLAN_PRIORITY).
const PLAN_PRIORITY = {
  agency: 0,
  enterprise: 1,
  pro: 2,
  free: 3
};

const Plans = () => {
  const { t } = useTranslation();
  const { setUserPlan } = useOrg();
  const [currentPlan, setCurrentPlan] = useState('free');
  const [pendingPlanType, setPendingPlanType] = useState(null);
  const [planChangeAt, setPlanChangeAt] = useState(null);
  const [subscriptionStatus, setSubscriptionStatus] = useState(null);
  const [currentPeriodEnd, setCurrentPeriodEnd] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [openingPortal, setOpeningPortal] = useState(false);
  const { addToast } = useToast();

  const fetchCurrentPlan = async () => {
    try {
      const res = await axios.get('/api/billing/subscription');
      const normalizedPlan = (res.data.planType || 'free').toLowerCase();
      setCurrentPlan(normalizedPlan);
      setPendingPlanType(res.data.pendingPlanType || null);
      setPlanChangeAt(res.data.planChangeAt || null);
      setSubscriptionStatus(res.data.subscriptionStatus || null);
      setCurrentPeriodEnd(res.data.currentPeriodEnd || res.data.planExpiresAt || null);
      localStorage.setItem('planType', normalizedPlan);
      setUserPlan(normalizedPlan);
      // Fetch payment method only for paid plans
      if (normalizedPlan !== 'free') {
        try {
          const pmRes = await axios.get('/api/billing/payment-method');
          setPaymentMethod(pmRes.data.paymentMethod || null);
        } catch { setPaymentMethod(null); }
      }
    } catch {
      const fallbackRes = await axios.get('/api/auth/me');
      const fallbackPlan = (fallbackRes.data.planType || 'free').toLowerCase();
      setCurrentPlan(fallbackPlan);
      setPendingPlanType(fallbackRes.data.pendingPlanType || null);
      setPlanChangeAt(fallbackRes.data.planChangeAt || null);
      setSubscriptionStatus(fallbackRes.data.subscriptionStatus || null);
      setCurrentPeriodEnd(fallbackRes.data.currentPeriodEnd || fallbackRes.data.planExpiresAt || null);
      localStorage.setItem('planType', fallbackPlan);
      setUserPlan(fallbackPlan);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCurrentPlan();
  }, []);

  // Build a human-readable payment method label
  const paymentMethodLabel = (() => {
    if (!paymentMethod) return null;
    const { type, brand, last4, wallet, email, bank } = paymentMethod;
    if (type === 'card') {
      const walletName = wallet === 'google_pay' ? 'Google Pay'
        : wallet === 'apple_pay' ? 'Apple Pay'
        : wallet === 'link' ? 'Link'
        : null;
      const brandLabel = brand ? brand.charAt(0).toUpperCase() + brand.slice(1) : 'Card';
      if (walletName) return `${walletName} (${brandLabel} ••••${last4})`;
      return `${brandLabel} ••••${last4}`;
    }
    if (type === 'paypal') return email ? `PayPal (${email})` : 'PayPal';
    if (type === 'sepa_debit') return `SEPA Debit ••••${last4}`;
    if (type === 'us_bank_account') return bank ? `${bank} ••••${last4}` : `Bank ••••${last4}`;
    return type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  })();

  /** True only for upgrades: paid tier strictly higher than current (Checkout / Stripe). */
  const canUpgradeViaCheckout = (targetPlan) => {
    if (targetPlan === 'free') return false;
    if (targetPlan === currentPlan) return false;
    const currentP = PLAN_PRIORITY[currentPlan] ?? PLAN_PRIORITY.free;
    const targetP = PLAN_PRIORITY[targetPlan];
    return targetP < currentP;
  };

  /** Lower or equal paid tier than current → user must use Settings / Portal, not Checkout. */
  const isPlanDowngradeOrSameTierBlocked = (targetPlan) =>
    targetPlan !== 'free' &&
    targetPlan !== currentPlan &&
    !canUpgradeViaCheckout(targetPlan);

  const handlePlanChange = async (planType) => {
    if (!canUpgradeViaCheckout(planType)) return;

    setProcessing(true);
    try {
      const res = await axios.post('/api/billing/checkout-session', { planType });
      if (!res.data?.url) {
        throw new Error('Stripe checkout URL not returned');
      }
      window.location.href = res.data.url;
    } catch (error) {
      addToast(t("auto.plan_change_failed_title"), error.response?.data?.message || t("auto.plan_change_failed_message"), 'error');
    } finally {
      setProcessing(false);
    }
  };

  const handleManageBilling = async () => {
    setOpeningPortal(true);
    try {
      const res = await axios.post('/api/billing/portal-session');
      if (!res.data?.url) {
        throw new Error('Stripe portal URL not returned');
      }
      window.location.href = res.data.url;
    } catch (error) {
      addToast(t("auto.plan_change_failed_title"), error.response?.data?.message || t("auto.plan_change_failed_message"), 'error');
      setOpeningPortal(false);
    }
  };

  const plans = [
  {
    id: 'free',
    name: 'Hobby',
    price: '$0',
    period: '/mo',
    description: 'Perfect for learning Docker and running small personal projects.',
    icon: <Star className="text-slate-400" size={32} />,
    features: [
    'Up to 2 Containers limit',
    '1 GB RAM quota',
    '1 CPU Core equivalent',
    '1 GB Persistent Storage (1 Disk)',
    '1 Public Access Container',
    'Ad-supported experience',
    'Community Support'],

    color: 'bg-white/80 dark:bg-slate-800/80 backdrop-blur-md text-slate-800 dark:text-slate-200 hover:-translate-y-2 hover:shadow-md transition-all duration-300',
    buttonColor: 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200 dark:bg-slate-700 dark:border-slate-600 dark:text-white dark:hover:bg-slate-600 hover:-translate-y-0.5 shadow-md'
  },
  {
    id: 'pro',
    name: 'Professional',
    price: '$19.95',
    period: '/mo',
    description: 'For active developers needing more resources and flexibility.',
    icon: <Zap className="text-brand-500" size={32} />,
    features: [
    'Up to 10 Containers limit',
    '8 GB RAM quota',
    '4 CPU Cores equivalent',
    '10 GB Persistent Storage (5 Disks)',
    '8 Public Access Containers',
    '✨ Ad-free experience',
    'Priority Support',
    'Advanced Network Modes'],

    color: 'bg-brand-50/90 border-brand-200 dark:bg-brand-900/40 dark:border-brand-500/30 backdrop-blur-xl text-brand-900 dark:text-brand-100 transform md:-translate-y-4 shadow-sm hover:-translate-y-6 hover:shadow-md hover:shadow-brand-500/20 relative transition-all duration-300',
    buttonColor: 'bg-brand-600 hover:bg-brand-700 border-transparent text-white hover:from-brand-500 hover:to-indigo-500 shadow-sm shadow-brand-500/30 hover:-translate-y-0.5'
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: '$59.95',
    period: '/mo',
    description: 'Uncapped potential for heavy applications and production workloads.',
    icon: <Shield className="text-purple-500" size={32} />,
    features: [
    'Up to 50 Containers limit',
    '32 GB RAM quota',
    '16 CPU Cores equivalent',
    '100 GB Persistent Storage (20 Disks)',
    '50 Public Access Containers',
    '✨ Ad-free experience',
    '24/7 Dedicated Support',
    'Custom Node Mapping'],

    color: 'bg-white/80 dark:bg-slate-800/80 backdrop-blur-md text-slate-800 dark:text-slate-200 hover:-translate-y-2 hover:shadow-md transition-all duration-300',
    buttonColor: 'bg-brand-600 hover:bg-brand-700 border-transparent text-white hover:from-purple-500 hover:to-fuchsia-500 shadow-sm shadow-purple-500/30 hover:-translate-y-0.5'
  },
  {
    id: 'agency',
    name: 'Agency / MSP',
    price: '$149.95',
    period: '/mo',
    description: 'Provide managed Docker environments to your clients with sub-organizations.',
    icon: <Building2 className="text-amber-500" size={32} />,
    features: [
    'Unlimited Containers limit',
    '128 GB RAM quota',
    '64 CPU Cores equivalent',
    '1 TB Persistent Storage',
    'Unlimited Public Access Containers',
    'Multi-Tenant Organization Management',
    'Custom Roles & RBAC',
    '✨ Ad-free experience',
    'White-glove 24/7 Support'],

    color: 'bg-brand-600 hover:bg-brand-700 dark:from-amber-900/20 dark:to-orange-900/20 border-amber-200 dark:border-amber-500/30 backdrop-blur-md text-amber-900 dark:text-amber-100 hover:-translate-y-2 hover:shadow-md transition-all duration-300 ring-1 ring-amber-500/20',
    buttonColor: 'bg-brand-600 hover:bg-brand-700 border-transparent text-white hover:from-amber-500 hover:to-orange-500 shadow-sm shadow-amber-500/30 hover:-translate-y-0.5'
  }];

  const currentPlanDisplayName = plans.find((p) => p.id === currentPlan)?.name || currentPlan;

  const stripeSubscriptionStatusDisplay = (() => {
    if (subscriptionStatus) {
      return subscriptionStatus.replace(/_/g, ' ').toUpperCase();
    }
    if (currentPlan === 'free') {
      return t('auto.billing_stripe_free_tier');
    }
    return t('auto.billing_stripe_status_unavailable');
  })();

  if (loading) return <div className="p-8 text-center animate-pulse text-slate-500">{t("auto.loading_plans_")}</div>;

  return (
    <div className="p-4 md:p-8 pb-20 max-w-7xl mx-auto">
            <div className="text-center max-w-3xl mx-auto mb-16">
                <h1 className="text-4xl md:text-5xl font-extrabold text-slate-900 dark:text-white mb-6">{t("auto.simple_transparent_pricing")}</h1>
                <p className="text-lg md:text-xl text-slate-600 dark:text-slate-400">
                    {t("auto.grow_your_infrastructure_linearly_start_")}
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 items-start">
                {plans.map((plan) => {
          const isActive = currentPlan === plan.id;
          const canCheckout = canUpgradeViaCheckout(plan.id);
          const downgradeBlocked = isPlanDowngradeOrSameTierBlocked(plan.id);
          const isFreePlan = plan.id === 'free';

          let buttonText = t("auto.upgrade_to_plan", { plan: plan.name });
          if (isActive) buttonText = t("auto.current_plan");
          if (isFreePlan) buttonText = t("auto.available_only_via_cancellation");
          if (downgradeBlocked) buttonText = t("auto.change_available_in_settings");

          return (
            <div key={plan.id} className={`rounded-sm p-8 border ${plan.color} ${plan.id === 'pro' && 'ring-2 ring-brand-500 ring-offset-4 ring-offset-slate-50 dark:ring-offset-slate-900'} transition-all duration-300`}>
                            {plan.id === 'pro' &&
              <div className="absolute top-0 right-1/2 translate-x-1/2 -translate-y-1/2 bg-brand-500 text-white text-xs font-bold uppercase tracking-widest py-1 px-4 rounded-full shadow-md">
                                    {t("auto.most_popular")}
                                </div>
              }
                            <div className="mb-6 flex justify-between items-start">
                                <div>
                                    <h3 className="text-xl font-bold mb-2">{plan.name}</h3>
                                    <p className="text-sm opacity-80 min-h-[5.5rem]">{plan.description}</p>
                                </div>
                                <div className="p-3 bg-white dark:bg-slate-900/50 rounded-sm shadow-sm">
                                    {plan.icon}
                                </div>
                            </div>

                            <div className="mb-8">
                                <span className="text-4xl font-extrabold">{plan.price}</span>
                                <span className="opacity-70 font-medium">{plan.period}</span>
                            </div>

                            <ul className="mb-8 space-y-4">
                                {plan.features.map((feature, idx) =>
                <li key={idx} className="flex items-start">
                                        <Check className={`shrink-0 mr-3 mt-0.5 ${plan.id === 'pro' ? 'text-brand-500' : 'text-emerald-500'}`} size={20} />
                                        <span className="text-sm font-medium opacity-90">{feature}</span>
                                    </li>
                )}
                            </ul>

                            {downgradeBlocked ? (
                <p className="w-full py-3 text-center text-sm text-slate-500 dark:text-slate-400">
                  {t("auto.to_change_plan_go_to")}{' '}
                  <Link to="/app/settings" className="underline font-semibold hover:opacity-70 transition-opacity">
                    Settings
                  </Link>
                </p>
              ) :
                            <button
                onClick={() => handlePlanChange(plan.id)}
                disabled={isActive || processing || !canCheckout}
                className={`w-full py-4 rounded-sm font-bold border transition-all duration-200 flex justify-center items-center ${plan.buttonColor} ${(isActive || !canCheckout) ? 'opacity-50 cursor-not-allowed bg-slate-200 border-slate-300 text-slate-500 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-500' : ''}`}>
                
                                {processing ?
                <span className="animate-pulse">{t("auto.processing_")}</span> :
                isActive ?
                <>{t("auto.current_plan")} <Check className="ml-2" size={18} /></> :
                buttonText
                }
                            </button>
              }
                        </div>);

        })}
            </div>



            <div className="mt-6 bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-500/20 rounded-sm p-6 flex items-start text-blue-800 dark:text-blue-300 max-w-3xl mx-auto shadow-sm">
                <AlertCircle className="shrink-0 mr-4 mt-0.5" />
                <div>
                    <h4 className="font-bold mb-1">{t("auto.billing_status_title")}</h4>
                    <p className="text-sm opacity-90">
                        {t("auto.billing_your_plan_label")}{' '}
                        <strong>{currentPlanDisplayName}</strong>
                    </p>
                    {currentPlan !== 'free' && (
                      <p className="text-sm mt-2 opacity-90">
                        {t("auto.billing_stripe_status_label")}{' '}
                        <strong>{stripeSubscriptionStatusDisplay}</strong>
                        {paymentMethodLabel && (
                          <span className="ml-2 text-xs opacity-75 font-normal">({paymentMethodLabel})</span>
                        )}
                        {' · '}
                        <button
                          onClick={handleManageBilling}
                          disabled={openingPortal}
                          className="underline font-semibold hover:opacity-70 transition-opacity disabled:opacity-40"
                        >
                          {openingPortal ? t("auto.processing_") : t("auto.manage_billing_portal")}
                        </button>
                      </p>
                    )}
                    {currentPeriodEnd && (
                      <p className="text-sm mt-2 opacity-90">
                        {t("auto.billing_cycle_ends_on", { date: new Date(currentPeriodEnd).toLocaleString() })}
                      </p>
                    )}
                    {pendingPlanType && (
                      <p className="text-sm mt-3 opacity-90">
                        {t("auto.scheduled_change_to")} <strong>{pendingPlanType.toUpperCase()}</strong>
                        {planChangeAt ? ` ${t("auto.on_date")} ${new Date(planChangeAt).toLocaleString()}` : ''}.
                      </p>
                    )}
                    {!pendingPlanType && (
                      <p className="text-sm mt-3 opacity-90">
                        {t("auto.no_pending_change_current_plan_active")}
                      </p>
                    )}
                </div>
            </div>

            <div className="max-w-3xl mx-auto mt-12 pt-8 border-t border-slate-200 dark:border-slate-800 text-center">
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed max-w-2xl mx-auto">
                    {t("auto._subscription_terms_conditions_by_upgrad")}
                


        </p>
            </div>
        </div>);

};

export default Plans;