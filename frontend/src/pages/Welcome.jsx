import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
    ArrowRight, Zap, ShieldCheck, Activity, Terminal,
    GitBranch, Globe, Lock, ChevronRight, Cpu,
    HardDrive, BarChart2, Layers, Sun, Moon, Aperture
} from 'lucide-react';
import { useTheme } from '../components/ThemeContext';

/* ─── Animated Grid Background ───────────────────────────── */
const AnimatedGrid = () => (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {/* Fixed explicit colors to avoid currentColor inheritance issues */}
        <div
            className="absolute inset-0"
            style={{
                backgroundImage: `
                    linear-gradient(to right, rgba(100,116,139,0.08) 1px, transparent 1px),
                    linear-gradient(to bottom, rgba(100,116,139,0.08) 1px, transparent 1px)
                `,
                backgroundSize: '80px 80px',
            }}
        />
        <div className="absolute top-[-20%] left-[-10%] w-[60vw] h-[60vw] rounded-full bg-brand-500/10 blur-[130px] animate-pulse-slow" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[50vw] h-[50vw] rounded-full bg-indigo-500/10 blur-[130px] animate-pulse-slow" style={{ animationDelay: '2s' }} />
        <div className="absolute top-[40%] left-[40%] w-[30vw] h-[30vw] rounded-full bg-violet-500/8 blur-[100px] animate-pulse-slow" style={{ animationDelay: '4s' }} />
    </div>
);

/* ─── Stats Badge ─────────────────────────────────────────── */
const StatBadge = ({ value, label, icon: Icon, color }) => (
    <div className="flex flex-col items-center p-5 rounded-2xl bg-white/80 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 backdrop-blur-md hover:border-brand-500/50 dark:hover:border-brand-500/40 transition-all hover:-translate-y-1 group shadow-sm">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${color} group-hover:scale-110 transition-transform`}>
            <Icon size={20} />
        </div>
        <span className="text-3xl font-black text-slate-900 dark:text-white mb-1">{value}</span>
        <span className="text-xs text-slate-500 dark:text-slate-400 text-center">{label}</span>
    </div>
);

/* ─── Feature Card ────────────────────────────────────────── */
const FeatureCard = ({ icon: Icon, title, desc, accent, delay }) => (
    <div
        className="relative group p-6 rounded-2xl border border-slate-200 dark:border-slate-700/70 bg-white/80 dark:bg-slate-800/60 backdrop-blur-sm hover:border-brand-500/40 hover:bg-white dark:hover:bg-slate-800/80 transition-all duration-300 hover:-translate-y-1 shadow-sm"
        style={{ animationDelay: delay }}
    >
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center mb-4 border transition-transform group-hover:scale-110 ${accent}`}>
            <Icon size={20} />
        </div>
        <h3 className="font-bold text-slate-900 dark:text-white mb-2">{title}</h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">{desc}</p>
        <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-br from-brand-500/5 to-transparent pointer-events-none" />
    </div>
);

/* ─── Terminal Demo ───────────────────────────────────────── */
const TerminalDemo = () => {
    const lines = [
        { text: '$ orbit deploy my-api --git github.com/pablo/api', color: 'text-slate-700 dark:text-slate-300' },
        { text: '✓ Cloning repository...', color: 'text-emerald-600 dark:text-emerald-400', delay: 600 },
        { text: '✓ Building Docker image (1.2s cache hit)', color: 'text-emerald-600 dark:text-emerald-400', delay: 1100 },
        { text: '✓ Container started on port 3000', color: 'text-emerald-600 dark:text-emerald-400', delay: 1600 },
        { text: '✓ Domain api.pablo.dev → routed via Traefik', color: 'text-brand-600 dark:text-brand-400', delay: 2100 },
        { text: '✓ TLS certificate issued', color: 'text-brand-600 dark:text-brand-400', delay: 2500 },
        { text: '🚀 Deployed in 3.8s', color: 'text-amber-600 dark:text-amber-400 font-bold', delay: 3000 },
    ];

    const [visible, setVisible] = useState(0);
    useEffect(() => {
        const timers = lines.map((l, i) =>
            setTimeout(() => setVisible(i + 1), (l.delay || 0) + 300)
        );
        return () => timers.forEach(clearTimeout);
    }, []);

    return (
        <div className="relative rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 shadow-2xl shadow-slate-200/60 dark:shadow-black/50">
            <div className="flex items-center gap-2 px-4 py-3 bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                <span className="w-3 h-3 rounded-full bg-red-400" />
                <span className="w-3 h-3 rounded-full bg-amber-400" />
                <span className="w-3 h-3 rounded-full bg-emerald-400" />
                <span className="ml-2 text-xs text-slate-400 font-mono">orbit-cli</span>
            </div>
            <div className="bg-slate-50 dark:bg-slate-900 p-5 font-mono text-sm min-h-[200px]">
                {lines.slice(0, visible).map((l, i) => (
                    <div key={i} className={`mb-1.5 ${l.color}`}>
                        {l.text}
                    </div>
                ))}
                {visible < lines.length && (
                    <span className="inline-block w-2 h-4 bg-brand-500 animate-pulse" />
                )}
            </div>
        </div>
    );
};

/* ─── Main Welcome Component ──────────────────────────────── */
const Welcome = () => {
    const { theme, toggleTheme } = useTheme();

    const features = [
        {
            icon: GitBranch, title: 'Git Deploy Pipelines',
            desc: 'Push to GitHub, Orbit builds and deploys your app automatically in seconds.',
            accent: 'bg-violet-100 dark:bg-violet-500/10 border-violet-200 dark:border-violet-500/20 text-violet-600 dark:text-violet-400'
        },
        {
            icon: Globe, title: 'Auto-Routing & TLS',
            desc: 'Assign custom domains instantly. Traefik reverse-proxies and issues certs automatically.',
            accent: 'bg-emerald-100 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20 text-emerald-600 dark:text-emerald-400'
        },
        {
            icon: Layers, title: 'Smart Stack Builder',
            desc: 'Deploy multi-tier apps like WordPress + MySQL in one click with linked env vars.',
            accent: 'bg-brand-100 dark:bg-brand-500/10 border-brand-200 dark:border-brand-500/20 text-brand-600 dark:text-brand-400'
        },
        {
            icon: Terminal, title: 'Live Terminals & Logs',
            desc: 'Browser-based shell access and real-time log streaming. No SSH needed.',
            accent: 'bg-amber-100 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20 text-amber-600 dark:text-amber-400'
        },
        {
            icon: HardDrive, title: 'Persistent Volumes',
            desc: 'Attach Docker volumes to containers so your data survives restarts.',
            accent: 'bg-pink-100 dark:bg-pink-500/10 border-pink-200 dark:border-pink-500/20 text-pink-600 dark:text-pink-400'
        },
        {
            icon: Lock, title: 'Secrets & Registries',
            desc: 'Store encrypted environment secrets and connect private Docker registries.',
            accent: 'bg-indigo-100 dark:bg-indigo-500/10 border-indigo-200 dark:border-indigo-500/20 text-indigo-600 dark:text-indigo-400'
        },
    ];

    const plans = [
        {
            name: 'Hobby', price: '$0', desc: 'Perfect for learning Docker and running small personal projects.',
            features: [
                { text: 'Up to 2 Containers limit', included: true },
                { text: '1 GB RAM quota', included: true },
                { text: '1 CPU Core equivalent', included: true },
                { text: '1 GB Persistent Storage (1 Disk)', included: true },
                { text: 'No Custom Domains', included: false },
                { text: 'Community Support', included: true },
            ],
            cta: 'Start Free', highlighted: false
        },
        {
            name: 'Professional', price: '$12', desc: 'For active developers needing more resources and flexibility.',
            tag: 'Most Popular',
            features: [
                { text: 'Up to 10 Containers limit', included: true },
                { text: '8 GB RAM quota', included: true },
                { text: '4 CPU Cores equivalent', included: true },
                { text: '10 GB Persistent Storage (5 Disks)', included: true },
                { text: '3 Custom Domains', included: true },
                { text: 'Priority Support', included: true },
                { text: 'Advanced Network Modes', included: true },
            ],
            cta: 'Upgrade Now', highlighted: true
        },
        {
            name: 'Enterprise', price: '$45', desc: 'Uncapped potential for heavy applications and production workloads.',
            features: [
                { text: 'Up to 50 Containers limit', included: true },
                { text: '32 GB RAM quota', included: true },
                { text: '16 CPU Cores equivalent', included: true },
                { text: '100 GB Persistent Storage (20 Disks)', included: true },
                { text: 'Unlimited Custom Domains', included: true },
                { text: '24/7 Dedicated Support', included: true },
                { text: 'Custom Node Mapping', included: true },
            ],
            cta: 'Upgrade Now', highlighted: false
        },
        {
            name: 'Agency / MSP', price: '$199', desc: 'Provide managed Docker environments to your clients with sub-organizations.',
            tag: 'For Teams',
            features: [
                { text: 'Unlimited Containers limit', included: true },
                { text: '128 GB RAM quota', included: true },
                { text: '64 CPU Cores equivalent', included: true },
                { text: '1 TB Persistent Storage', included: true },
                { text: 'Multi-Tenant Organization Management', included: true },
                { text: 'Custom Roles & RBAC', included: true },
                { text: 'White-glove 24/7 Support', included: true },
            ],
            cta: 'Contact Sales', highlighted: false
        }
    ];

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 selection:bg-brand-500/30 overflow-x-hidden transition-colors duration-200">
            <AnimatedGrid />

            {/* ── Navbar ── */}
            <nav className="relative z-50 border-b border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-950/80 backdrop-blur-xl sticky top-0 transition-colors duration-200">
                <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-brand-500/15 rounded-lg flex items-center justify-center border border-brand-500/25 text-brand-500 dark:text-brand-400">
                            <Aperture size={18} className="animate-[spin_15s_linear_infinite]" />
                        </div>
                        <span className="text-base font-bold tracking-wide text-slate-900 dark:text-white">Orbit</span>
                    </div>

                    <div className="hidden md:flex items-center gap-7 text-sm text-slate-500 dark:text-slate-400">
                        <a href="#features" className="hover:text-slate-900 dark:hover:text-white transition-colors">Features</a>
                        <a href="#pricing" className="hover:text-slate-900 dark:hover:text-white transition-colors">Pricing</a>
                        <a href="#stats" className="hover:text-slate-900 dark:hover:text-white transition-colors">Stats</a>
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            onClick={toggleTheme}
                            className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-700 transition-all border border-slate-200 dark:border-slate-700"
                            title="Toggle Theme"
                        >
                            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
                        </button>
                        <Link to="/login" className="text-sm text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors px-3 py-1.5">
                            Log in
                        </Link>
                        <Link
                            to="/register"
                            className="text-sm bg-brand-500 hover:bg-brand-400 text-white px-4 py-2 rounded-lg font-medium transition-all shadow-lg shadow-brand-500/20 flex items-center gap-1.5"
                        >
                            Get Started <ArrowRight size={14} />
                        </Link>
                    </div>
                </div>
            </nav>

            {/* ── Hero ── */}
            <section className="relative max-w-7xl mx-auto px-6 pt-24 pb-20 text-center">
                <div className="inline-flex items-center gap-2 bg-brand-500/10 border border-brand-500/20 rounded-full px-4 py-1.5 text-brand-600 dark:text-brand-300 text-xs font-semibold mb-8">
                    <span className="relative flex h-1.5 w-1.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-brand-500" />
                    </span>
                    v1.0 — Now Live
                </div>

                <h1 className="text-5xl md:text-7xl font-black tracking-tight mb-6 leading-[1.1]">
                    <span className="text-slate-900 dark:text-white">Ship containers.</span><br />
                    <span className="bg-gradient-to-r from-brand-500 via-violet-500 to-indigo-500 dark:from-brand-400 dark:via-violet-400 dark:to-indigo-400 bg-clip-text text-transparent">
                        Not complexity.
                    </span>
                </h1>

                <p className="text-lg text-slate-600 dark:text-slate-400 max-w-xl mx-auto mb-10 leading-relaxed">
                    Orbit is a self-hosted PaaS that wraps Docker Engine in a premium developer experience.
                    Deploy, monitor, and scale — all from one place.
                </p>

                <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                    <Link
                        to="/register"
                        className="px-7 py-3.5 bg-brand-500 hover:bg-brand-400 text-white font-semibold rounded-xl transition-all shadow-[0_0_40px_rgba(14,165,233,0.3)] hover:shadow-[0_0_50px_rgba(14,165,233,0.45)] flex items-center gap-2 text-sm"
                    >
                        Start Deploying Now <ArrowRight size={16} />
                    </Link>
                    <a
                        href="#features"
                        className="px-7 py-3.5 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold rounded-xl transition-all border border-slate-200 dark:border-slate-700 text-sm shadow-sm"
                    >
                        Explore Features
                    </a>
                </div>

                {/* Terminal visual */}
                <div className="relative mt-20 max-w-3xl mx-auto">
                    <div className="absolute -inset-1 rounded-3xl bg-gradient-to-r from-brand-500/20 via-violet-500/20 to-indigo-500/20 blur-xl opacity-50 dark:opacity-100" />
                    <div className="relative">
                        <TerminalDemo />
                    </div>
                </div>
            </section>

            {/* ── Stats ── */}
            <section id="stats" className="relative max-w-7xl mx-auto px-6 py-16">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <StatBadge value="30+" label="Container Templates" icon={Layers} color="bg-brand-100 dark:bg-brand-500/15 text-brand-600 dark:text-brand-400 border border-brand-200 dark:border-brand-500/20" />
                    <StatBadge value="99.9%" label="Uptime SLA" icon={Activity} color="bg-emerald-100 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20" />
                    <StatBadge value="<4s" label="Average Deploy Time" icon={Zap} color="bg-amber-100 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20" />
                    <StatBadge value="∞" label="Scale Potential" icon={Cpu} color="bg-violet-100 dark:bg-violet-500/15 text-violet-600 dark:text-violet-400 border border-violet-200 dark:border-violet-500/20" />
                </div>
            </section>

            {/* ── Features ── */}
            <section id="features" className="relative max-w-7xl mx-auto px-6 py-24 border-t border-slate-200 dark:border-slate-800">
                <div className="text-center mb-14">
                    <div className="inline-flex items-center gap-2 text-xs text-brand-600 dark:text-brand-400 font-semibold uppercase tracking-widest mb-4">
                        <span className="w-8 h-px bg-brand-400/50" /> Features <span className="w-8 h-px bg-brand-400/50" />
                    </div>
                    <h2 className="text-4xl md:text-5xl font-black text-slate-900 dark:text-white mb-4">Everything to ship faster</h2>
                    <p className="text-slate-500 dark:text-slate-400 max-w-xl mx-auto">
                        A complete PaaS experience, built directly on top of your Docker Engine.
                    </p>
                </div>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {features.map((f, i) => (
                        <FeatureCard key={i} {...f} delay={`${i * 80}ms`} />
                    ))}
                </div>
            </section>

            {/* ── How it works ── */}
            <section className="relative max-w-7xl mx-auto px-6 py-24 border-t border-slate-200 dark:border-slate-800">
                <div className="text-center mb-14">
                    <div className="inline-flex items-center gap-2 text-xs text-brand-600 dark:text-brand-400 font-semibold uppercase tracking-widest mb-4">
                        <span className="w-8 h-px bg-brand-400/50" /> How It Works <span className="w-8 h-px bg-brand-400/50" />
                    </div>
                    <h2 className="text-4xl font-black text-slate-900 dark:text-white mb-4">Deploy in three steps</h2>
                </div>
                <div className="grid md:grid-cols-3 gap-6">
                    {[
                        { step: '01', title: 'Create your account', desc: 'Sign up and choose your plan. Be up and running in under a minute.', icon: ShieldCheck },
                        { step: '02', title: 'Connect your code', desc: 'Link a GitHub repo or pick a template from our marketplace.', icon: GitBranch },
                        { step: '03', title: 'Deploy & monitor', desc: 'Hit deploy. Watch your app go live. Monitor resources in real time.', icon: BarChart2 },
                    ].map((s, i) => (
                        <div key={i} className="relative p-7 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800/60 group hover:border-brand-500/40 transition-all shadow-sm">
                            <div className="text-7xl font-black text-slate-100 dark:text-slate-700 absolute top-4 right-6 select-none font-mono">{s.step}</div>
                            <div className="w-11 h-11 rounded-xl bg-brand-100 dark:bg-brand-500/15 border border-brand-200 dark:border-brand-500/30 flex items-center justify-center text-brand-600 dark:text-brand-400 mb-5 group-hover:scale-110 transition-transform">
                                <s.icon size={20} />
                            </div>
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">{s.title}</h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">{s.desc}</p>
                            {i < 2 && (
                                <ChevronRight className="hidden md:block absolute -right-3 top-1/2 -translate-y-1/2 text-brand-500/40" size={24} />
                            )}
                        </div>
                    ))}
                </div>
            </section>

            {/* ── Pricing ── */}
            <section id="pricing" className="relative max-w-7xl mx-auto px-6 py-24 border-t border-slate-200 dark:border-slate-800">
                <div className="text-center mb-14">
                    <div className="inline-flex items-center gap-2 text-xs text-brand-600 dark:text-brand-400 font-semibold uppercase tracking-widest mb-4">
                        <span className="w-8 h-px bg-brand-400/50" /> Pricing <span className="w-8 h-px bg-brand-400/50" />
                    </div>
                    <h2 className="text-4xl md:text-5xl font-black text-slate-900 dark:text-white mb-4">Simple, transparent pricing</h2>
                    <p className="text-slate-500 dark:text-slate-400 max-w-lg mx-auto">Start for free, scale when you're ready.</p>
                </div>

                {/* Comparison grid */}
                <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                    <table className="w-full min-w-[700px] border-collapse">
                        {/* Header row */}
                        <thead>
                            <tr>
                                <th className="text-left px-6 py-5 text-sm font-semibold text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/80 w-[240px] border-b border-slate-200 dark:border-slate-700">
                                    Feature
                                </th>
                                {plans.map((p, i) => (
                                    <th key={i} className={`px-6 py-5 text-center border-b border-slate-200 dark:border-slate-700 ${p.highlighted
                                        ? 'bg-gradient-to-b from-brand-500 to-brand-600 text-white'
                                        : 'bg-slate-50 dark:bg-slate-800/80'
                                        }`}>
                                        {p.tag && (
                                            <div className={`inline-flex text-[10px] font-bold uppercase tracking-wide rounded-full px-2 py-0.5 mb-2 ${p.highlighted ? 'bg-white/20 text-white' : 'bg-brand-100 dark:bg-brand-500/15 text-brand-600 dark:text-brand-400'
                                                }`}>
                                                {p.tag}
                                            </div>
                                        )}
                                        <div className={`font-black text-lg ${p.highlighted ? 'text-white' : 'text-slate-900 dark:text-white'
                                            }`}>{p.name}</div>
                                        <div className={`text-2xl font-black mt-1 ${p.highlighted ? 'text-white' : 'text-slate-900 dark:text-white'
                                            }`}>
                                            {p.price}<span className={`text-sm font-normal ${p.highlighted ? 'text-brand-200' : 'text-slate-400 dark:text-slate-500'
                                                }`}>/mo</span>
                                        </div>
                                        <p className={`text-xs mt-1 leading-tight ${p.highlighted ? 'text-brand-100' : 'text-slate-500 dark:text-slate-400'
                                            }`}>{p.desc}</p>
                                    </th>
                                ))}
                            </tr>
                        </thead>

                        {/* Feature rows */}
                        <tbody>
                            {[
                                'Containers limit',
                                'RAM quota',
                                'CPU Cores',
                                'Persistent Storage',
                                'S3-Compatible Buckets',
                                'Custom Domains',
                                'Support level',
                                'Advanced Network Modes',
                                'Custom Node Mapping',
                                'Multi-Tenant Org Management',
                                'Custom Roles & RBAC',
                                'White-glove Support',
                            ].map((feature, rowIdx) => {
                                const values = {
                                    'Containers limit': ['Up to 2', 'Up to 10', 'Up to 50', 'Unlimited'],
                                    'RAM quota': ['1 GB', '8 GB', '32 GB', '128 GB'],
                                    'CPU Cores': ['1 Core', '4 Cores', '16 Cores', '64 Cores'],
                                    'Persistent Storage': ['1 GB (1 Disk)', '10 GB (5 Disks)', '100 GB (20 Disks)', '1 TB'],
                                    'Custom Domains': [false, '3 Domains', 'Unlimited', 'Unlimited'],
                                    'Support level': ['Community', 'Priority', '24/7 Dedicated', 'White-glove SRE'],
                                    'Advanced Network Modes': [false, true, true, true],
                                    'Custom Node Mapping': [false, false, true, true],
                                    'Multi-Tenant Org Management': [false, false, false, true],
                                    'Custom Roles & RBAC': [false, false, false, true],
                                    'White-glove Support': [false, false, false, true],
                                };
                                const rowValues = values[feature] || [false, false, false, false];
                                const isEven = rowIdx % 2 === 0;
                                return (
                                    <tr key={rowIdx} className={isEven
                                        ? 'bg-white dark:bg-slate-900'
                                        : 'bg-slate-50/60 dark:bg-slate-800/40'
                                    }>
                                        <td className="px-6 py-4 text-sm font-medium text-slate-600 dark:text-slate-300 border-b border-slate-100 dark:border-slate-700/60">
                                            {feature}
                                        </td>
                                        {rowValues.map((val, colIdx) => (
                                            <td key={colIdx} className={`px-6 py-4 text-center text-sm border-b border-slate-100 dark:border-slate-700/60 ${plans[colIdx].highlighted
                                                ? 'bg-brand-500/8 dark:bg-brand-500/10'
                                                : ''
                                                }`}>
                                                {val === false ? (
                                                    <span className="text-slate-300 dark:text-slate-600 text-lg">—</span>
                                                ) : val === true ? (
                                                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-xs font-bold">✓</span>
                                                ) : (
                                                    <span className="font-medium text-slate-700 dark:text-slate-200">{val}</span>
                                                )}
                                            </td>
                                        ))}
                                    </tr>
                                );
                            })}
                        </tbody>

                        {/* CTA row */}
                        <tfoot>
                            <tr>
                                <td className="px-6 py-5 bg-slate-50 dark:bg-slate-800/80 rounded-bl-2xl" />
                                {plans.map((p, i) => (
                                    <td key={i} className={`px-6 py-5 text-center ${p.highlighted
                                        ? 'bg-brand-600/15 dark:bg-brand-500/15'
                                        : 'bg-slate-50 dark:bg-slate-800/80'
                                        } ${i === plans.length - 1 ? 'rounded-br-2xl' : ''}`}>
                                        <Link
                                            to="/register"
                                            className={`inline-flex items-center justify-center w-full py-2.5 rounded-xl text-sm font-semibold transition-all ${p.highlighted
                                                ? 'bg-brand-500 hover:bg-brand-400 text-white shadow-lg shadow-brand-500/20'
                                                : 'bg-white dark:bg-slate-700 hover:bg-slate-100 dark:hover:bg-slate-600 text-slate-800 dark:text-white border border-slate-200 dark:border-slate-600'
                                                }`}
                                        >
                                            {p.cta}
                                        </Link>
                                    </td>
                                ))}
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </section>

            {/* ── CTA Banner ── */}
            <section className="relative max-w-7xl mx-auto px-6 py-16">
                <div className="relative overflow-hidden rounded-3xl border border-brand-200 dark:border-brand-500/20 bg-gradient-to-br from-brand-50 via-indigo-50 to-violet-50 dark:from-brand-600/20 dark:via-indigo-600/15 dark:to-violet-600/20 p-12 text-center shadow-sm">
                    <div className="absolute inset-0 opacity-10 dark:opacity-20" style={{
                        backgroundImage: 'radial-gradient(circle at 50% 50%, rgba(14,165,233,0.5) 0%, transparent 70%)'
                    }} />
                    <h2 className="relative text-4xl font-black text-slate-900 dark:text-white mb-4">Ready to take off?</h2>
                    <p className="relative text-slate-600 dark:text-slate-300 max-w-md mx-auto mb-8">
                        Join Orbit today — deploy your first container in under 60 seconds, no DevOps experience needed.
                    </p>
                    <div className="relative flex flex-col sm:flex-row gap-4 justify-center">
                        <Link
                            to="/register"
                            className="px-8 py-4 bg-brand-500 hover:bg-brand-400 text-white font-bold rounded-xl transition-all shadow-[0_0_30px_rgba(14,165,233,0.3)] hover:shadow-[0_0_40px_rgba(14,165,233,0.5)] flex items-center justify-center gap-2"
                        >
                            Create Free Account <ArrowRight size={18} />
                        </Link>
                        <Link
                            to="/login"
                            className="px-8 py-4 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-800 dark:text-white font-bold rounded-xl transition-all border border-slate-200 dark:border-slate-700 shadow-sm"
                        >
                            Sign In
                        </Link>
                    </div>
                </div>
            </section>

            {/* ── Footer ── */}
            <footer className="border-t border-slate-200 dark:border-slate-800 py-10 text-center text-slate-400 dark:text-slate-500 text-sm">
                <div className="flex items-center justify-center gap-2 mb-2">
                    <Aperture size={14} className="text-brand-500" />
                    <span className="font-bold text-slate-500 dark:text-slate-400">Orbit</span>
                </div>
                <p>© 2026 Orbit — Pablo Jiménez Prieto · Institut Pedralbes</p>
            </footer>
        </div>
    );
};

export default Welcome;
