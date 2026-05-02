import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
    ArrowRight, Zap, ShieldCheck, Activity, Terminal,
    GitBranch, Globe, Lock, ChevronRight, Cpu,
    HardDrive, BarChart2, Layers, Sun, Moon, Aperture,
    Code, Server, Database, Mail, CheckCircle2, Send, Star, Quote
} from 'lucide-react';
import { useTheme } from '../components/ThemeContext';

/* ─── Optimized Background ───────────────────────────── */
const AnimatedBackground = () => {
    // Removed expensive framer-motion loops and huge blurs to improve scroll performance
    return (
        <div className="pointer-events-none fixed inset-0 overflow-hidden -z-10 bg-slate-50 dark:bg-slate-950">
        </div>
    );
};

/* ─── Shared Animation Variants ───────────────────────────── */
const fadeInUp = {
    hidden: { opacity: 0, y: 30 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } }
};

const staggerContainer = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: {
            staggerChildren: 0.1
        }
    }
};

const scaleIn = {
    hidden: { opacity: 0, scale: 0.95 },
    visible: { opacity: 1, scale: 1, transition: { duration: 0.5, ease: "easeOut" } }
};

/* ─── Terminal Demo ───────────────────────────────────────── */
const TerminalDemo = () => {
    const lines = [
        { text: '$ orbit deploy my-api --git github.com/orbit/api', color: 'text-slate-700 dark:text-slate-300' },
        { text: '✓ Cloning repository...', color: 'text-emerald-600 dark:text-emerald-400', delay: 400 },
        { text: '✓ Building Docker image (1.2s cache hit)', color: 'text-emerald-600 dark:text-emerald-400', delay: 800 },
        { text: '✓ Container started on port 3000', color: 'text-emerald-600 dark:text-emerald-400', delay: 1200 },
        { text: '✓ Domain https://orbitcloud.app/ → routed via Traefik', color: 'text-brand-600 dark:text-brand-400', delay: 1600 },
        { text: '✓ TLS certificate issued', color: 'text-brand-600 dark:text-brand-400', delay: 2000 },
        { text: '🚀 Deployed in 3.8s', color: 'text-amber-600 dark:text-amber-400 font-bold', delay: 2400 },
    ];

    const [visible, setVisible] = useState(0);
    useEffect(() => {
        const timers = lines.map((l, i) =>
            setTimeout(() => setVisible(i + 1), (l.delay || 0) + 300)
        );
        return () => timers.forEach(clearTimeout);
    }, []);

    return (
        <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="relative lg:col-span-3 rounded-sm overflow-hidden border border-slate-200/50 dark:border-slate-700/50 shadow-sm shadow-brand-500/5 dark:shadow-black/20 bg-white/50 dark:bg-slate-900/50 backdrop-blur-md group"
        >
            <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-white/10 dark:from-slate-800/40 dark:to-slate-900/10 pointer-events-none" />
            <div className="relative flex items-center gap-2 px-4 py-3 bg-slate-100/80 dark:bg-slate-800/80 border-b border-slate-200/50 dark:border-slate-700/50">
                <span className="w-3 h-3 rounded-full bg-red-400" />
                <span className="w-3 h-3 rounded-full bg-amber-400" />
                <span className="w-3 h-3 rounded-full bg-emerald-400" />
                <span className="ml-2 text-xs text-slate-500 dark:text-slate-400 font-mono flex-1 text-center mr-8">orbit-cli</span>
            </div>
            <div className="relative p-6 font-mono text-sm min-h-[260px]">
                {lines.slice(0, visible).map((l, i) => (
                    <motion.div
                        initial={{ opacity: 0, x: -5 }}
                        animate={{ opacity: 1, x: 0 }}
                        key={i}
                        className={`mb-2.5 ${l.color}`}
                    >
                        {l.text}
                    </motion.div>
                ))}
                {visible < lines.length && (
                    <span className="inline-block w-2 h-4 bg-brand-500 animate-pulse mt-1" />
                )}
            </div>
        </motion.div>
    );
};

/* ─── Main Component ──────────────────────────────────────── */
const Welcome = () => {
    const { theme, toggleTheme } = useTheme();

    // Pricing Plans Array
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
        <div className="bg-transparent text-slate-900 dark:text-slate-100 selection:bg-brand-500/30 overflow-x-hidden min-h-screen">
            <AnimatedBackground />

            {/* ── Sticky Navbar ── */}
            <motion.nav
                initial={{ y: -100 }}
                animate={{ y: 0 }}
                transition={{ duration: 0.6, ease: "easeOut" }}
                className="fixed top-0 left-0 right-0 z-50 border-b border-slate-200/50 dark:border-slate-800/50 bg-white/70 dark:bg-slate-950/70 backdrop-blur-xl shadow-sm"
            >
                <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
                    <Link to="/" className="flex items-center gap-3 group">
                        <div className="w-8 h-8 rounded-sm bg-brand-600 hover:bg-brand-700 flex items-center justify-center text-white shadow-sm shadow-brand-500/20 group-hover:scale-105 transition-transform">
                            <Aperture size={18} className="animate-[spin_15s_linear_infinite]" />
                        </div>
                        <span className="text-lg font-black tracking-wide text-slate-900 dark:text-white">Orbit</span>
                    </Link>

                    {/* Navbar Middle Links Removed */}
                    <div className="flex-1" />

                    <div className="flex items-center gap-4">
                        <button
                            onClick={toggleTheme}
                            className="p-2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                            title="Toggle Theme"
                        >
                            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
                        </button>
                        <Link to="/login" className="hidden sm:block text-sm font-semibold text-slate-600 dark:text-slate-300 hover:text-brand-500 transition-colors">
                            Log in
                        </Link>
                            className="text-sm bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-brand-500 dark:hover:bg-brand-400 px-5 py-2 rounded-sm font-bold transition-all shadow-md"
                            Get Started
                        </Link>
                    </div>
                </div>
            </motion.nav>

            {/* ── Hero Section ── */}
            <section className="relative pt-32 pb-20 md:pt-40 md:pb-32 px-6 flex items-center justify-center">
                <div className="max-w-7xl mx-auto text-center w-full z-10">
                    <motion.div
                        initial="hidden" animate="visible" variants={staggerContainer}
                        className="max-w-4xl mx-auto"
                    >
                        {/* Live for students badge removed */}

                        <motion.h1 variants={fadeInUp} className="text-5xl md:text-7xl lg:text-8xl font-black tracking-tight mb-8 leading-[1.1]">
                            Manage Infrastructure <br className="hidden md:block" />
                            <span className="text-brand-500">
                                Without Friction.
                            </span>
                        </motion.h1>

                        <motion.p variants={fadeInUp} className="text-lg md:text-xl text-slate-600 dark:text-slate-400 mb-10 max-w-2xl mx-auto leading-relaxed">
                            A powerful, intuitive orchestration platform inspired by modern standards.
                            Deploy, scale, and monitor containers with a beautifully crafted experience.
                        </motion.p>

                        <motion.div variants={fadeInUp} className="flex flex-col sm:flex-row items-center justify-center gap-4">
                            <Link
                                to="/register"
                                className="w-full sm:w-auto px-8 py-4 bg-brand-500 hover:bg-brand-600 text-white font-bold rounded-sm transition-all shadow-sm shadow-brand-500/30 flex items-center justify-center gap-2"
                            >
                                Start Building <ArrowRight size={18} />
                            </Link>
                        </motion.div>
                    </motion.div>
                </div>
                {/* Hero gradient fade removed for better scroll performance */}
            </section>

            {/* ── About Section ── */}
            <section className="relative py-20 px-6 border-t border-slate-200/50 dark:border-slate-800/50 bg-white/40 dark:bg-slate-900/40 backdrop-blur-sm">
                <div className="max-w-7xl mx-auto">
                    <motion.div
                        initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-50px" }}
                        variants={staggerContainer}
                        className="grid grid-cols-1 lg:grid-cols-5 gap-12 items-center"
                    >
                        <motion.div variants={fadeInUp} className="lg:col-span-2">
                            <h2 className="text-3xl md:text-5xl font-black mb-6 text-slate-900 dark:text-white">
                                Built for <span className="text-brand-500">Developers</span>, Designed for <span className="text-indigo-500">Humans</span>.
                            </h2>
                            <p className="text-lg text-slate-600 dark:text-slate-400 mb-6 leading-relaxed">
                                Orbit removes the complexities of Docker and server management.
                                We provide a seamless, premium interface to control your architecture
                                so you can focus on writing code, not configuring servers.
                            </p>

                            <ul className="space-y-4 mb-8">
                                {[
                                    "Zero configuration deployments",
                                    "Real-time metrics and logs",
                                    "SSL & Custom Domains built-in",
                                    "Role-based access control"
                                ].map((item, i) => (
                                    <li key={i} className="flex items-center gap-3 text-slate-700 dark:text-slate-300 font-medium">
                                        <div className="w-6 h-6 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                                            <CheckCircle2 size={14} />
                                        </div>
                                        {item}
                                    </li>
                                ))}
                            </ul>
                        </motion.div>

                        <TerminalDemo />
                    </motion.div>
                </div>
            </section>

            {/* ── Features Section ── */}
            <section className="relative py-20 px-6 bg-slate-100/50 dark:bg-slate-900/10">
                <div className="max-w-7xl mx-auto">
                    <motion.div
                        initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-50px" }}
                        variants={fadeInUp}
                        className="text-center mb-16"
                    >
                        <span className="text-brand-500 font-bold uppercase tracking-widest text-sm mb-4 block">Platform Capabilities</span>
                        <h2 className="text-4xl md:text-5xl font-black text-slate-900 dark:text-white max-w-2xl mx-auto">
                            Everything you need to ship production-ready apps.
                        </h2>
                    </motion.div>

                    <motion.div
                        initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-50px" }}
                        variants={staggerContainer}
                        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
                    >
                        {[
                            { icon: GitBranch, title: 'Git Integration', desc: 'Push code, and we will build, containerize, and deploy it automatically.', color: 'from-violet-500 to-indigo-500' },
                            { icon: Globe, title: 'Instant Routing', desc: 'Automatic subdomains, SSL certificates, and intelligent load balancing via Traefik.', color: 'from-brand-400 to-brand-600' },
                            { icon: Database, title: 'Persistent Volumes', desc: 'Attach stateful storage to any container ensuring your data survives restarts.', color: 'from-emerald-400 to-emerald-600' },
                            { icon: ShieldCheck, title: 'Secure Secrets', desc: 'Inject encrypted environment variables safely into your application runtime.', color: 'from-amber-400 to-orange-500' },
                            { icon: Activity, title: 'Live Telemetry', desc: 'Visualize CPU, memory usage, and stream logs directly in your browser.', color: 'from-pink-500 to-rose-500' },
                            { icon: Layers, title: 'Template Market', desc: 'Deploy databases, message queues, and full stacks in a single click.', color: 'from-blue-500 to-cyan-500' }
                        ].map((feature, i) => (
                            <motion.div
                                key={i}
                                variants={scaleIn}
                                className="group p-8 rounded-sm bg-white/60 dark:bg-slate-800/40 border border-slate-200/50 dark:border-slate-700/50 backdrop-blur-sm hover:bg-white dark:hover:bg-slate-800 shadow-sm hover:shadow-sm transition-all duration-300"
                            >
                                <div className={`w-14 h-14 rounded-sm flex items-center justify-center mb-6 bg-gradient-to-br ${feature.color} text-white shadow-sm shadow-black/10 group-hover:scale-110 transition-transform duration-300`}>
                                    <feature.icon size={26} strokeWidth={2.5} />
                                </div>
                                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-3">{feature.title}</h3>
                                <p className="text-slate-500 dark:text-slate-400 leading-relaxed">
                                    {feature.desc}
                                </p>
                            </motion.div>
                        ))}
                    </motion.div>
                </div>
            </section>

            {/* ── Projects / Showcase Section ── */}
            <section className="relative py-20 px-6">
                <div className="max-w-7xl mx-auto">
                    <motion.div
                        initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-50px" }}
                        variants={staggerContainer}
                        className="mb-16"
                    >
                        <motion.div variants={fadeInUp} className="max-w-2xl">
                            <span className="text-indigo-500 font-bold uppercase tracking-widest text-sm mb-4 block">Built For Scale</span>
                            <h2 className="text-4xl md:text-5xl font-black text-slate-900 dark:text-white mb-4">
                                One platform, infinite possibilities.
                            </h2>
                            <p className="text-lg text-slate-600 dark:text-slate-400">
                                Whether you're running a personal blog or a microservices architecture, Orbit adapts to your topology.
                            </p>
                        </motion.div>
                        {/* View Documentation removed */}
                    </motion.div>

                    <div className="grid md:grid-cols-2 gap-6">
                        {[
                            {
                                title: 'Modern Web Apps',
                                tech: 'React, Node.js, Redis',
                                bg: 'bg-brand-900/20',
                                stats: [
                                    { label: 'Avg Build Time', value: '4.2s' },
                                    { label: 'Deployments', value: '1,200+' }
                                ]
                            },
                            {
                                title: 'Data Pipelines',
                                tech: 'Python, Postgres, Airflow',
                                bg: 'bg-brand-900/20',
                                stats: [
                                    { label: 'Uptime', value: '99.9%' },
                                    { label: 'Logs Processed', value: '50M+' }
                                ]
                            }
                        ].map((item, i) => (
                            <motion.div
                                initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-50px" }}
                                variants={fadeInUp}
                                key={i}
                                className={`relative h-auto md:h-64 rounded-sm p-8 border border-slate-200 dark:border-slate-800 ${item.bg} overflow-hidden group`}
                            >
                                <div className="relative z-10 h-full flex flex-col justify-between gap-6">
                                    <div className="inline-flex px-4 py-1.5 rounded-full bg-white/80 dark:bg-slate-900/80 backdrop-blur-md text-slate-900 dark:text-white text-sm font-bold shadow-sm w-fit">
                                        {item.tech}
                                    </div>
                                    <div>
                                        <h3 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white mb-4 group-hover:text-brand-500 transition-colors">{item.title}</h3>
                                        <div className="flex gap-6">
                                            {item.stats.map((stat, idx) => (
                                                <div key={idx}>
                                                    <div className="text-xl font-bold text-slate-900 dark:text-white">{stat.value}</div>
                                                    <div className="text-sm font-medium text-slate-500 dark:text-slate-400">{stat.label}</div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                                {/* Removed hover blur orb for sober design */}
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── Testimonials / Social Proof ── */}
            <section className="relative py-24 px-6 overflow-hidden">
                {/* Orbs removed for industrial design */}

                <div className="max-w-7xl mx-auto relative z-10">
                    <motion.div
                        initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-50px" }}
                        variants={fadeInUp}
                        className="text-center mb-16"
                    >
                        <span className="text-emerald-500 font-bold uppercase tracking-widest text-sm mb-4 block">Loved by Engineering Teams</span>
                        <h2 className="text-4xl md:text-5xl font-black text-slate-900 dark:text-white max-w-3xl mx-auto">
                            Don't just take our word for it.
                        </h2>
                    </motion.div>

                    <motion.div
                        initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-50px" }}
                        variants={staggerContainer}
                        className="grid grid-cols-1 md:grid-cols-3 gap-8"
                    >
                        {[
                            {
                                quote: "Orbit transformed how we deploy. No more writing endless YAML files; everything just works out of the box. Absolutely game-changing.",
                                author: "Sarah Jenkins",
                                role: "Lead DevOps, TechFlow",
                                avatar: "https://ui-avatars.com/api/?name=Sarah+Jenkins&background=0D8ABC&color=fff"
                            },
                            {
                                quote: "The real-time metrics and beautiful interface make monitoring our microservices a breeze. It's like having a dedicated SRE on the team.",
                                author: "Michael Chen",
                                role: "CTO, StartupX",
                                avatar: "https://ui-avatars.com/api/?name=Michael+Chen&background=10B981&color=fff"
                            },
                            {
                                quote: "We migrated 50+ containers to Orbit in hours. The built-in Traefik routing and SSL management saved us weeks of engineering time.",
                                author: "Elena Rodriguez",
                                role: "Backend Lead, CloudSync",
                                avatar: "https://ui-avatars.com/api/?name=Elena+Rodriguez&background=8B5CF6&color=fff"
                            }
                        ].map((testimonial, i) => (
                            <motion.div
                                key={i}
                                variants={scaleIn}
                                className="relative p-8 rounded-sm bg-white/70 dark:bg-slate-900/60 border border-slate-200/50 dark:border-slate-800/50 backdrop-blur-xl hover:-translate-y-2 transition-transform duration-300 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.1)] group overflow-hidden"
                            >
                                <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent dark:from-white/5 dark:to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                                <Quote className="absolute -top-4 -right-2 text-slate-100 dark:text-slate-800/50 w-32 h-32 -z-10 rotate-12 transition-transform duration-500 group-hover:rotate-0 group-hover:scale-110" />
                                <div className="flex gap-1 mb-6 text-amber-400">
                                    {[...Array(5)].map((_, i) => <Star key={i} size={18} fill="currentColor" />)}
                                </div>
                                <p className="text-slate-700 dark:text-slate-300 text-lg mb-8 leading-relaxed font-medium relative z-10">
                                    "{testimonial.quote}"
                                </p>
                                <div className="flex items-center gap-4 relative z-10">
                                    <img src={testimonial.avatar} alt={testimonial.author} className="w-12 h-12 rounded-full ring-4 ring-white dark:ring-slate-800 shadow-md" />
                                    <div>
                                        <h4 className="font-bold text-slate-900 dark:text-white">{testimonial.author}</h4>
                                        <span className="text-sm font-semibold text-brand-500 dark:text-brand-400">{testimonial.role}</span>
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </motion.div>
                </div>
            </section>

            {/* ── Pricing Table Section (Restored) ── */}
            <section className="relative max-w-7xl mx-auto px-6 py-20 border-t border-slate-200/50 dark:border-slate-800/50">
                <div className="text-center mb-16">
                    <span className="text-brand-500 font-bold uppercase tracking-widest text-sm mb-4 block">Pricing</span>
                    <h2 className="text-4xl md:text-5xl font-black text-slate-900 dark:text-white mb-4">Simple, transparent pricing</h2>
                    <p className="text-slate-500 dark:text-slate-400 max-w-lg mx-auto">Start for free, scale when you're ready.</p>
                </div>

                <div className="overflow-x-auto rounded-sm border border-slate-200 dark:border-slate-800 shadow-sm">
                    <table className="w-full min-w-[800px] border-collapse bg-white dark:bg-slate-900/40">
                        {/* Header row */}
                        <thead>
                            <tr>
                                <th className="text-left px-6 py-5 text-sm font-semibold text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/80 w-[240px] border-b border-slate-200 dark:border-slate-700">
                                    Feature
                                </th>
                                {plans.map((p, i) => (
                                    <th key={i} className={`px-6 py-6 text-center border-b border-slate-200 dark:border-slate-700 ${p.highlighted
                                        ? 'bg-brand-600 hover:bg-brand-700 text-white'
                                        : 'bg-slate-50 dark:bg-slate-800/80'
                                        }`}>
                                        {p.tag && (
                                            <div className={`inline-flex text-[10px] font-bold uppercase tracking-wide rounded-full px-2 py-0.5 mb-2 ${p.highlighted ? 'bg-white/20 text-white' : 'bg-brand-100 dark:bg-brand-500/15 text-brand-600 dark:text-brand-400'}`}>
                                                {p.tag}
                                            </div>
                                        )}
                                        <div className={`font-black text-lg ${p.highlighted ? 'text-white' : 'text-slate-900 dark:text-white'}`}>{p.name}</div>
                                        <div className={`text-2xl font-black mt-1 ${p.highlighted ? 'text-white' : 'text-slate-900 dark:text-white'}`}>
                                            {p.price}<span className={`text-sm font-normal ${p.highlighted ? 'text-brand-200' : 'text-slate-400 dark:text-slate-500'}`}>/mo</span>
                                        </div>
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
                                'Custom Domains',
                                'Support level',
                                'Advanced Network Modes',
                                'Custom Roles & RBAC',
                            ].map((feature, rowIdx) => {
                                const values = {
                                    'Containers limit': ['Up to 2', 'Up to 10', 'Up to 50', 'Unlimited'],
                                    'RAM quota': ['1 GB', '8 GB', '32 GB', '128 GB'],
                                    'CPU Cores': ['1 Core', '4 Cores', '16 Cores', '64 Cores'],
                                    'Persistent Storage': ['1 GB', '10 GB', '100 GB', '1 TB'],
                                    'Custom Domains': [false, '3 Domains', 'Unlimited', 'Unlimited'],
                                    'Support level': ['Community', 'Priority', '24/7 Dedicated', 'White-glove'],
                                    'Advanced Network Modes': [false, true, true, true],
                                    'Custom Roles & RBAC': [false, false, false, true],
                                };
                                const rowValues = values[feature] || [false, false, false, false];
                                const isEven = rowIdx % 2 === 0;
                                return (
                                    <tr key={rowIdx} className={isEven ? 'bg-white dark:bg-slate-900/50' : 'bg-slate-50/60 dark:bg-slate-800/20'}>
                                        <td className="px-6 py-4 text-sm font-medium text-slate-600 dark:text-slate-300 border-b border-slate-100 dark:border-slate-800">
                                            {feature}
                                        </td>
                                        {rowValues.map((val, colIdx) => (
                                            <td key={colIdx} className={`px-6 py-4 text-center text-sm border-b border-slate-100 dark:border-slate-800 ${plans[colIdx].highlighted ? 'bg-brand-500/5 dark:bg-brand-500/10' : ''}`}>
                                                {val === false ? (
                                                    <span className="text-slate-300 dark:text-slate-600 text-lg">—</span>
                                                ) : val === true ? (
                                                    <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-bold">✓</span>
                                                ) : (
                                                    <span className="font-medium text-slate-700 dark:text-slate-300">{val}</span>
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
                                <td className="px-6 py-5 bg-slate-50 dark:bg-slate-800/80 rounded-bl-3xl" />
                                {plans.map((p, i) => (
                                    <td key={i} className={`px-6 py-5 text-center ${p.highlighted ? 'bg-brand-600/10 dark:bg-brand-500/10' : 'bg-slate-50 dark:bg-slate-800/80'} ${i === plans.length - 1 ? 'rounded-br-3xl' : ''}`}>
                                        <Link
                                            to="/register"
                                            className={`inline-flex items-center justify-center w-full py-2.5 rounded-sm text-sm font-semibold transition-all ${p.highlighted ? 'bg-brand-500 hover:bg-brand-400 text-white shadow-sm shadow-brand-500/20' : 'bg-white dark:bg-slate-700 hover:bg-slate-100 dark:hover:bg-slate-600 text-slate-800 dark:text-white border border-slate-200 dark:border-slate-600'}`}
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

            {/* ── Contact / CTA Section ── */}
            <section className="relative py-20 px-6 overflow-hidden">
                <motion.div
                    initial="hidden" whileInView="visible" viewport={{ once: true }}
                    className="max-w-5xl mx-auto rounded-sm bg-slate-900 border border-slate-800 p-10 md:p-20 text-center relative shadow-md"
                >
                    {/* Background effects */}
                    <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4IiBoZWlnaHQ9IjgiPgo8cmVjdCB3aWR0aD0iOCIgaGVpZ2h0PSI4IiBmaWxsPSIjZmZmZmZmIiBmaWxsLW9wYWNpdHk9IjAuMDIiLz4KPC9zdmc+')] opacity-20" />

                    <div className="relative z-10">
                        <h2 className="text-4xl md:text-6xl font-black text-white mb-6">
                            Ready to modernize your infrastructure?
                        </h2>
                        <p className="text-xl text-slate-400 mb-10 max-w-2xl mx-auto">
                            Join thousands of developers using Orbit to push code faster and scale effortlessly.
                        </p>

                            <Link
                                to="/register"
                                className="w-full sm:w-auto px-8 py-4 bg-brand-500 hover:bg-brand-400 text-white font-bold rounded-sm transition-all shadow-sm flex items-center justify-center gap-2"
                            >
                                Get Started for Free <ArrowRight size={18} />
                            </Link>
                            <a
                                href="mailto:hello@orbit.dev"
                                className="w-full sm:w-auto px-8 py-4 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-sm transition-all border border-slate-700 flex items-center justify-center gap-2"
                            >
                                <Mail size={18} /> Contact Sales
                            </a>
                        </div>
                    </div>
                </motion.div>
            </section>

            {/* ── Footer ── */}
            <footer className="border-t border-slate-200/50 dark:border-slate-800/50 py-10 px-6">
                <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
                    <div className="flex items-center gap-3">
                        <Aperture size={20} className="text-brand-500" />
                        <span className="font-black text-lg text-slate-900 dark:text-white">Orbit</span>
                    </div>
                    <div className="text-slate-500 dark:text-slate-400 text-sm font-medium text-center md:text-left">
                        © {new Date().getFullYear()} Orbit — Pablo Jiménez Prieto.
                    </div>
                    <div className="flex items-center gap-4">
                        <a href="https://github.com" target="_blank" rel="noreferrer" className="text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors">
                            <Code size={20} />
                        </a>
                        <a href="mailto:contact@orbit" className="text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors">
                            <Send size={20} />
                        </a>
                    </div>
                </div>
            </footer>
        </div>
    );
};

export default Welcome;
