import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Sun, Moon, Aperture, Eye, EyeOff } from 'lucide-react';
import axios from 'axios';
import { useTheme } from '../components/ThemeContext';

const Login = () => {
    const { theme, toggleTheme } = useTheme();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [step, setStep] = useState('login'); // 'login' or 'verify'
    const [verificationCode, setVerificationCode] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            const res = await axios.post('/api/auth/login', { email, password });
            if (res.data.requireVerification) {
                setStep('verify');
            } else {
                // Fallback if verification not needed (though backend always requires it now)
                localStorage.setItem('name', res.data.name);
                localStorage.setItem('email', res.data.email);
                localStorage.setItem('role', res.data.role);
                localStorage.setItem('planType', res.data.planType || 'free');
                window.location.href = '/app';
            }
        } catch (err) {
            setError(err.response?.data?.message || 'Login failed. Please check your credentials.');
        } finally {
            setLoading(false);
        }
    };

    const handleVerify = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            const res = await axios.post('/api/auth/verify-code', { email, code: verificationCode });
            localStorage.setItem('name', res.data.name);
            localStorage.setItem('email', res.data.email);
            localStorage.setItem('role', res.data.role);
            localStorage.setItem('planType', res.data.planType || 'free');
            window.location.href = '/app';
        } catch (err) {
            setError(err.response?.data?.message || 'Verification failed. Please check your code.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex selection:bg-brand-500/30 overflow-hidden transition-colors duration-200">

            {/* ── Left decorative panel (hidden on mobile) ── */}
            <div className="hidden lg:flex lg:w-1/2 relative flex-col justify-between p-12 overflow-hidden bg-white dark:bg-transparent border-r border-slate-200 dark:border-white/6">
                {/* Background effects */}
                <div className="absolute inset-0 dark:block hidden"
                    style={{
                        backgroundImage: `
                            linear-gradient(to right, rgba(148,163,184,0.04) 1px, transparent 1px),
                            linear-gradient(to bottom, rgba(148,163,184,0.04) 1px, transparent 1px)
                        `,
                        backgroundSize: '60px 60px',
                    }}
                />
                <div className="absolute inset-0 block dark:hidden"
                    style={{
                        backgroundImage: `
                            linear-gradient(to right, rgba(148,163,184,0.12) 1px, transparent 1px),
                            linear-gradient(to bottom, rgba(148,163,184,0.12) 1px, transparent 1px)
                        `,
                        backgroundSize: '60px 60px',
                    }}
                />
                <div className="absolute top-[-15%] left-[-10%] w-[70%] h-[70%] rounded-full bg-brand-500/10 blur-[120px] opacity-60 dark:opacity-100" />
                <div className="absolute bottom-[-10%] right-[-5%] w-[50%] h-[50%] rounded-full bg-violet-500/8 blur-[100px] opacity-60 dark:opacity-100" />

                {/* Logo */}
                <div className="relative flex items-center gap-3 z-10">
                    <div className="w-9 h-9 bg-brand-500/15 rounded-xl flex items-center justify-center border border-brand-500/25 text-brand-500 dark:text-brand-400">
                        <Aperture size={20} className="animate-[spin_15s_linear_infinite]" />
                    </div>
                    <span className="text-lg font-bold tracking-wide text-slate-900 dark:text-white">Orbit</span>
                </div>

                {/* Central content */}
                <div className="relative z-10 space-y-8">
                    <div>
                        <div className="inline-flex items-center gap-2 bg-brand-500/10 border border-brand-500/20 rounded-full px-3 py-1 text-brand-600 dark:text-brand-300 text-xs font-semibold mb-6">
                            <span className="relative flex h-1.5 w-1.5">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-400 opacity-75" />
                                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-brand-500" />
                            </span>
                            Self-hosted PaaS
                        </div>
                        <h1 className="text-4xl font-black text-slate-900 dark:text-white leading-tight mb-4">
                            Your containers,<br />
                            <span className="bg-gradient-to-r from-brand-500 to-violet-500 dark:from-brand-400 dark:to-violet-400 bg-clip-text text-transparent">
                                under control.
                            </span>
                        </h1>
                        <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed max-w-sm">
                            Deploy, monitor, and scale Docker containers from a single premium dashboard. No DevOps expertise required.
                        </p>
                    </div>

                    {/* Feature list */}
                    <div className="flex flex-col gap-3">
                        {[
                            'Git-powered deployments in seconds',
                            'Auto-routing with custom domains & TLS',
                            'Live terminals and real-time log streaming',
                        ].map((f, i) => (
                            <div key={i} className="flex items-center gap-3 text-sm text-slate-700 dark:text-slate-300">
                                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-500/15 border border-emerald-200 dark:border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400 text-xs font-bold">✓</span>
                                {f}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Quote */}
                <div className="relative z-10 border-l-2 border-brand-500/30 pl-4">
                    <p className="text-slate-500 dark:text-slate-400 text-sm italic">"The developer experience I always wanted for Docker."</p>
                    <p className="text-xs text-slate-400 dark:text-slate-600 mt-1">— Final Year Project, Institut Pedralbes</p>
                </div>
            </div>

            {/* ── Right login panel ── */}
            <div className="flex-1 flex flex-col justify-center items-center px-6 py-12 relative">
                {/* Top right controls */}
                <div className="absolute top-6 right-6 flex items-center gap-2">
                    <button
                        onClick={toggleTheme}
                        className="p-2 rounded-lg bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-white/10 transition-all border border-slate-200 dark:border-white/8"
                        title="Toggle Theme"
                    >
                        {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
                    </button>
                </div>

                {/* Mobile logo */}
                <div className="lg:hidden flex items-center gap-3 mb-10">
                    <div className="w-9 h-9 bg-brand-500/15 rounded-xl flex items-center justify-center border border-brand-500/25 text-brand-500 dark:text-brand-400">
                        <Aperture size={20} className="animate-[spin_15s_linear_infinite]" />
                    </div>
                    <span className="text-lg font-bold tracking-wide text-slate-900 dark:text-white">Orbit</span>
                </div>

                <div className="w-full max-w-sm">
                    {/* Header */}
                    <div className="mb-8">
                        <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-1.5">
                            {step === 'login' ? 'Welcome back' : 'Verification Required'}
                        </h2>
                        <p className="text-sm text-slate-500 dark:text-slate-500">
                            {step === 'login' ? (
                                <>
                                    Don't have an account?{' '}
                                    <Link to="/register" className="text-brand-500 dark:text-brand-400 hover:text-brand-600 dark:hover:text-brand-300 font-medium transition-colors">
                                        Sign up free
                                    </Link>
                                </>
                            ) : (
                                `We sent a 6-digit code to ${email}`
                            )}
                        </p>
                    </div>

                    {/* Error */}
                    {error && (
                        <div className="mb-5 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/25 text-red-600 dark:text-red-400 text-sm py-3 px-4 rounded-xl">
                            {error}
                        </div>
                    )}

                    {/* Form */}
                    {step === 'login' ? (
                        <form onSubmit={handleLogin} className="space-y-4">
                            {/* Email */}
                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                                    Email Address
                                </label>
                                <input
                                    type="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full px-4 py-3 rounded-xl
                                               bg-white dark:bg-white/5
                                               border border-slate-200 dark:border-white/10
                                               text-slate-900 dark:text-white
                                               placeholder-slate-400 dark:placeholder-slate-600
                                               text-sm
                                               focus:outline-none focus:border-brand-500/60 focus:ring-1 focus:ring-brand-500/30
                                               dark:focus:bg-white/8 focus:bg-slate-50
                                               shadow-sm dark:shadow-none
                                               transition-all"
                                    placeholder="you@example.com"
                                />
                            </div>

                            {/* Password */}
                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                                    Password
                                </label>
                                <div className="relative">
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        required
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="w-full px-4 py-3 pr-11 rounded-xl
                                                   bg-white dark:bg-white/5
                                                   border border-slate-200 dark:border-white/10
                                                   text-slate-900 dark:text-white
                                                   placeholder-slate-400 dark:placeholder-slate-600
                                                   text-sm
                                                   focus:outline-none focus:border-brand-500/60 focus:ring-1 focus:ring-brand-500/30
                                                   dark:focus:bg-white/8 focus:bg-slate-50
                                                   shadow-sm dark:shadow-none
                                                   transition-all"
                                        placeholder="••••••••"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
                                    >
                                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                    </button>
                                </div>
                            </div>

                            {/* Submit */}
                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full mt-2 flex justify-center items-center gap-2 py-3 px-4 rounded-xl
                                           bg-brand-500 hover:bg-brand-400 text-white font-semibold text-sm
                                           shadow-lg shadow-brand-500/20 hover:shadow-brand-500/30
                                           transition-all disabled:opacity-60 disabled:cursor-not-allowed
                                           active:scale-[0.98]"
                            >
                                {loading ? (
                                    <>
                                        <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                                        </svg>
                                        Signing in...
                                    </>
                                ) : (
                                    <>Sign in <ArrowRight size={16} /></>
                                )}
                            </button>
                        </form>
                    ) : (
                        <form onSubmit={handleVerify} className="space-y-4">
                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                                    6-Digit Code
                                </label>
                                <input
                                    type="text"
                                    required
                                    maxLength={6}
                                    value={verificationCode}
                                    onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ''))}
                                    className="w-full px-4 py-3 rounded-xl
                                               bg-white dark:bg-white/5
                                               border border-slate-200 dark:border-white/10
                                               text-slate-900 dark:text-white
                                               placeholder-slate-400 dark:placeholder-slate-600
                                               text-center text-2xl tracking-[0.5em] font-mono
                                               focus:outline-none focus:border-brand-500/60 focus:ring-1 focus:ring-brand-500/30
                                               dark:focus:bg-white/8 focus:bg-slate-50
                                               shadow-sm dark:shadow-none
                                               transition-all"
                                    placeholder="------"
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={loading || verificationCode.length !== 6}
                                className="w-full mt-2 flex justify-center items-center gap-2 py-3 px-4 rounded-xl
                                           bg-brand-500 hover:bg-brand-400 text-white font-semibold text-sm
                                           shadow-lg shadow-brand-500/20 hover:shadow-brand-500/30
                                           transition-all disabled:opacity-60 disabled:cursor-not-allowed
                                           active:scale-[0.98]"
                            >
                                {loading ? (
                                    <>
                                        <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                                        </svg>
                                        Verifying...
                                    </>
                                ) : (
                                    <>Verify & Enter <ArrowRight size={16} /></>
                                )}
                            </button>
                            
                            <button
                                type="button"
                                onClick={() => setStep('login')}
                                className="w-full py-2 text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                            >
                                Back to login
                            </button>
                        </form>
                    )}

                    {/* Divider */}
                    <div className="relative my-6">
                        <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-slate-200 dark:border-white/8" />
                        </div>
                        <div className="relative flex justify-center text-xs text-slate-400 dark:text-slate-600">
                            <span className="bg-slate-50 dark:bg-slate-950 px-3">or continue without account</span>
                        </div>
                    </div>

                    <Link
                        to="/"
                        className="w-full flex justify-center items-center gap-2 py-3 px-4 rounded-xl
                                   bg-white dark:bg-white/4 hover:bg-slate-100 dark:hover:bg-white/8
                                   text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200
                                   border border-slate-200 dark:border-white/8 hover:border-slate-300 dark:hover:border-white/15
                                   text-sm font-medium shadow-sm dark:shadow-none
                                   transition-all"
                    >
                        ← Back to home
                    </Link>
                </div>

                {/* Footer */}
                <p className="absolute bottom-6 text-xs text-slate-400 dark:text-slate-700 text-center px-6">
                    By signing in, you agree to the{' '}
                    <span className="text-slate-500 dark:text-slate-600">Terms of Service</span> and{' '}
                    <span className="text-slate-500 dark:text-slate-600">Privacy Policy</span>.
                </p>
            </div>
        </div>
    );
};

export default Login;
