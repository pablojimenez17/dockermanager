import React, { useEffect, useState } from 'react';
import { Check, Star, Zap, Shield, AlertCircle } from 'lucide-react';
import axios from 'axios';
import { useToast } from '../components/ToastContext';

const Plans = () => {
    const [currentPlan, setCurrentPlan] = useState('free');
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState(false);
    const { addToast } = useToast();

    const fetchCurrentPlan = async () => {
        try {
            const res = await axios.get('http://localhost:5000/api/auth/me');
            setCurrentPlan(res.data.planType || 'free');
            // Update local storage just in case
            localStorage.setItem('planType', res.data.planType);
        } catch (error) {
            console.error('Failed to fetch user profile:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchCurrentPlan();
    }, []);

    const handleUpgrade = async (planType) => {
        if (planType === currentPlan) return;

        setProcessing(true);
        try {
            const res = await axios.post('http://localhost:5000/api/plans/upgrade', { planType });

            setCurrentPlan(res.data.planType);
            localStorage.setItem('planType', res.data.planType);
            localStorage.setItem('limits', JSON.stringify(res.data.limits));

            addToast(
                'Plan Upgraded',
                `Successfully changed your subscription to ${planType.toUpperCase()}`,
                'success'
            );
        } catch (error) {
            addToast('Upgrade Failed', error.response?.data?.message || 'There was an error upgrading your plan.', 'error');
        } finally {
            setProcessing(false);
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
                'No Custom Domains',
                'Community Support'
            ],
            color: 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200',
            buttonColor: 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 dark:bg-slate-700 dark:border-slate-600 dark:text-white dark:hover:bg-slate-600'
        },
        {
            id: 'pro',
            name: 'Professional',
            price: '$12',
            period: '/mo',
            description: 'For active developers needing more resources and flexibility.',
            icon: <Zap className="text-brand-500" size={32} />,
            features: [
                'Up to 10 Containers limit',
                '8 GB RAM quota',
                '4 CPU Cores equivalent',
                '10 GB Persistent Storage (5 Disks)',
                '3 Custom Domains',
                'Priority Support',
                'Advanced Network Modes'
            ],
            color: 'bg-brand-50 border-brand-200 dark:bg-brand-900/20 dark:border-brand-500/30 text-brand-900 dark:text-brand-100 transform md:-translate-y-4 shadow-xl relative',
            buttonColor: 'bg-brand-500 border-brand-500 text-white hover:bg-brand-600 shadow-lg shadow-brand-500/30'
        },
        {
            id: 'enterprise',
            name: 'Enterprise',
            price: '$45',
            period: '/mo',
            description: 'Uncapped potential for heavy applications and production workloads.',
            icon: <Shield className="text-purple-500" size={32} />,
            features: [
                'Up to 50 Containers limit',
                '32 GB RAM quota',
                '16 CPU Cores equivalent',
                '100 GB Persistent Storage (20 Disks)',
                'Unlimited Custom Domains',
                '24/7 Dedicated Support',
                'Custom Node Mapping'
            ],
            color: 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200',
            buttonColor: 'bg-purple-500 border-purple-500 text-white hover:bg-purple-600'
        }
    ];

    if (loading) return <div className="p-8 text-center animate-pulse text-slate-500">Loading plans...</div>;

    return (
        <div className="p-4 md:p-8 pb-20 max-w-7xl mx-auto">
            <div className="text-center max-w-3xl mx-auto mb-16">
                <h1 className="text-4xl md:text-5xl font-extrabold text-slate-900 dark:text-white mb-6">Simple, transparent pricing</h1>
                <p className="text-lg md:text-xl text-slate-600 dark:text-slate-400">
                    Grow your infrastructure linearly. Start free and pay only when your fleet requires it. No hidden fees.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-start">
                {plans.map((plan) => {
                    const isActive = currentPlan === plan.id;
                    return (
                        <div key={plan.id} className={`rounded-3xl p-8 border ${plan.color} ${plan.id === 'pro' && 'ring-2 ring-brand-500 ring-offset-4 ring-offset-slate-50 dark:ring-offset-slate-900'} transition-all duration-300`}>
                            {plan.id === 'pro' && (
                                <div className="absolute top-0 right-1/2 translate-x-1/2 -translate-y-1/2 bg-brand-500 text-white text-xs font-bold uppercase tracking-widest py-1 px-4 rounded-full shadow-md">
                                    Most Popular
                                </div>
                            )}
                            <div className="mb-6 flex justify-between items-start">
                                <div>
                                    <h3 className="text-xl font-bold mb-2">{plan.name}</h3>
                                    <p className="text-sm opacity-80 h-10">{plan.description}</p>
                                </div>
                                <div className="p-3 bg-white dark:bg-slate-900/50 rounded-2xl shadow-sm">
                                    {plan.icon}
                                </div>
                            </div>

                            <div className="mb-8">
                                <span className="text-4xl font-extrabold">{plan.price}</span>
                                <span className="opacity-70 font-medium">{plan.period}</span>
                            </div>

                            <ul className="mb-8 space-y-4">
                                {plan.features.map((feature, idx) => (
                                    <li key={idx} className="flex items-start">
                                        <Check className={`shrink-0 mr-3 mt-0.5 ${plan.id === 'pro' ? 'text-brand-500' : 'text-emerald-500'}`} size={20} />
                                        <span className="text-sm font-medium opacity-90">{feature}</span>
                                    </li>
                                ))}
                            </ul>

                            <button
                                onClick={() => handleUpgrade(plan.id)}
                                disabled={isActive || processing}
                                className={`w-full py-4 rounded-xl font-bold border transition-all duration-200 flex justify-center items-center ${plan.buttonColor} ${isActive ? 'opacity-50 cursor-not-allowed bg-slate-200 border-slate-300 text-slate-500 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-500' : ''}`}
                            >
                                {processing ? (
                                    <span className="animate-pulse">Processing...</span>
                                ) : isActive ? (
                                    <>Current Plan <Check className="ml-2" size={18} /></>
                                ) : (
                                    `Upgrade to ${plan.name}`
                                )}
                            </button>
                        </div>
                    );
                })}
            </div>

            <div className="mt-16 bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-500/20 rounded-2xl p-6 flex items-start text-blue-800 dark:text-blue-300 max-w-3xl mx-auto shadow-sm">
                <AlertCircle className="shrink-0 mr-4 mt-0.5" />
                <div>
                    <h4 className="font-bold mb-1">Billing Simulation</h4>
                    <p className="text-sm opacity-90">In this development environment, payments are not processed. Clicking "Upgrade" will instantly apply the mock limits to your registered user and immediately unlock resources.</p>
                </div>
            </div>
        </div>
    );
};

export default Plans;
