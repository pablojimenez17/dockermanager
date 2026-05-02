import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Server, ArrowRight, Sun, Moon, Eye, EyeOff } from 'lucide-react';
import axios from 'axios';
import { useTheme } from '../components/ThemeContext';
import PasswordStrengthMeter from '../components/PasswordStrengthMeter';

const Register = () => {
    const { theme, toggleTheme } = useTheme();
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [step, setStep] = useState('register'); // 'register' or 'verify'
    const [verificationCode, setVerificationCode] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleRegister = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        // Validar que la contraseña sea segura
        const passwordStrength = validatePasswordStrength(password);
        if (!passwordStrength.isValid) {
            setError(passwordStrength.message);
            setLoading(false);
            return;
        }

        if (password !== confirmPassword) {
            setError('Passwords do not match');
            setLoading(false);
            return;
        }

        try {
            const res = await axios.post('/api/auth/register', { name, email, password });
            
            if (res.data.requireVerification) {
                setStep('verify');
                setSuccess(`Code sent to ${email}`);
            } else {
                // Auto login fallback
                localStorage.setItem('name', res.data.name);
                localStorage.setItem('email', res.data.email);
                localStorage.setItem('role', res.data.role);

                setSuccess('Registration successful. Accessing dashboard...');
                setTimeout(() => window.location.href = '/app', 1000);
            }
        } catch (err) {
            setError(err.response?.data?.message || 'Registration failed');
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
            setSuccess('Verification successful. Accessing dashboard...');
            setTimeout(() => window.location.href = '/app', 1000);
        } catch (err) {
            setError(err.response?.data?.message || 'Verification failed. Please check your code.');
        } finally {
            setLoading(false);
        }
    };

    const validatePasswordStrength = (pwd) => {
        const criteria = {
            length: pwd.length >= 8,
            lowercase: /[a-z]/.test(pwd),
            uppercase: /[A-Z]/.test(pwd),
            numbers: /[0-9]/.test(pwd),
            special: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(pwd),
        };

        const passedCount = Object.values(criteria).filter(Boolean).length;

        if (!criteria.length) {
            return { isValid: false, message: 'Password must be at least 8 characters long' };
        }
        if (!criteria.lowercase) {
            return { isValid: false, message: 'Password must contain lowercase letters' };
        }
        if (!criteria.uppercase) {
            return { isValid: false, message: 'Password must contain uppercase letters' };
        }
        if (!criteria.numbers) {
            return { isValid: false, message: 'Password must contain numbers' };
        }
        if (!criteria.special) {
            return { isValid: false, message: 'Password must contain special characters (!@#$%^&*)' };
        }

        return { isValid: true, message: '' };
    };

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex flex-col justify-center py-12 sm:px-6 lg:px-8 selection:bg-brand-500/30 transition-colors duration-200">
            <div className="absolute top-6 right-6">
                <button
                    onClick={toggleTheme}
                    className="p-2.5 rounded-sm bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 shadow-sm border border-slate-200 dark:border-slate-700 transition-colors"
                    title="Toggle Theme"
                >
                    {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
                </button>
            </div>
            <div className="sm:mx-auto sm:w-full sm:max-w-md">
                <Link to="/" className="flex justify-center items-center space-x-3 mb-8">
                    <div className="w-12 h-12 bg-brand-50 border-brand-200 dark:bg-brand-500/10 rounded-sm flex items-center justify-center border dark:border-brand-500/20 shadow-sm">
                        <Server className="text-brand-500 dark:text-brand-400" size={28} />
                    </div>
                </Link>
                <h2 className="text-center text-3xl font-extrabold text-slate-900 dark:text-white">
                    Create your account
                </h2>
                <p className="mt-2 text-center text-sm text-slate-600 dark:text-slate-400">
                    Already have an account?{' '}
                    <Link to="/login" className="font-medium text-brand-500 hover:text-brand-600 dark:text-brand-400 dark:hover:text-brand-300 transition-colors">
                        Sign in here
                    </Link>
                </p>
            </div>

            <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
                <div className="bg-white dark:bg-slate-800/50 py-8 px-4 shadow-md shadow-slate-200/50 dark:shadow-black/50 sm:rounded-sm sm:px-10 border border-slate-200 dark:border-slate-700 backdrop-blur-xl">
                    {step === 'register' ? (
                        <form className="space-y-6" onSubmit={handleRegister}>
                            {error && (
                                <div className="bg-red-50 border border-red-200 text-red-600 dark:bg-red-500/10 dark:border-red-500/50 dark:text-red-500 text-sm py-3 px-4 rounded-sm text-center">
                                    {error}
                                </div>
                            )}
                            {success && (
                                <div className="bg-emerald-50 border border-emerald-200 text-emerald-600 dark:bg-emerald-500/10 dark:border-emerald-500/50 dark:text-emerald-500 text-sm py-3 px-4 rounded-sm text-center">
                                    {success}
                                </div>
                            )}

                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                                    Full Name
                                </label>
                                <div className="mt-2">
                                    <input
                                        type="text"
                                        required
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        className="appearance-none block w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-sm shadow-sm placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white sm:text-sm transition-shadow"
                                        placeholder="Jane Doe"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                                    Email Address
                                </label>
                                <div className="mt-2">
                                    <input
                                        type="email"
                                        required
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="appearance-none block w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-sm shadow-sm placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white sm:text-sm transition-shadow"
                                        placeholder="you@example.com"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                                    Password
                                </label>
                                <div className="mt-2 relative">
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        required
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="appearance-none block w-full px-4 py-3 pr-11 border border-slate-300 dark:border-slate-600 rounded-sm shadow-sm placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white sm:text-sm transition-shadow"
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
                                {password.length > 0 && <PasswordStrengthMeter password={password} />}
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                                    Confirm Password
                                </label>
                                <div className="mt-2 relative">
                                    <input
                                        type={showConfirmPassword ? 'text' : 'password'}
                                        required
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        className={`appearance-none block w-full px-4 py-3 pr-11 border rounded-sm shadow-sm placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:border-transparent bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white sm:text-sm transition-all ${
                                            confirmPassword && password !== confirmPassword
                                                ? 'border-red-400 dark:border-red-500 focus:ring-red-500'
                                                : confirmPassword && password === confirmPassword
                                                ? 'border-emerald-400 dark:border-emerald-500 focus:ring-emerald-500'
                                                : 'border-slate-300 dark:border-slate-600 focus:ring-brand-500'
                                        }`}
                                        placeholder="••••••••"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
                                    >
                                        {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                    </button>
                                </div>
                                {confirmPassword && password !== confirmPassword && (
                                    <p className="mt-2 text-xs text-red-600 dark:text-red-400 flex items-center space-x-1">
                                        <span>❌</span>
                                        <span>Passwords do not match</span>
                                    </p>
                                )}
                                {confirmPassword && password === confirmPassword && (
                                    <p className="mt-2 text-xs text-emerald-600 dark:text-emerald-400 flex items-center space-x-1">
                                        <span>✅</span>
                                        <span>Passwords match</span>
                                    </p>
                                )}
                            </div>

                                <button
                                    type="submit"
                                    disabled={loading || !validatePasswordStrength(password).isValid || password !== confirmPassword}
                                    className="w-full flex justify-center items-center space-x-2 py-3 px-4 border border-transparent rounded-sm shadow-sm text-sm font-semibold text-white bg-brand-500 hover:bg-brand-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-500 focus:ring-offset-slate-50 dark:focus:ring-offset-slate-900 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-brand-500"
                                >
                                    {loading ? (
                                        <>
                                            <svg className="animate-spin h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                                            </svg>
                                            Registering...
                                        </>
                                    ) : (
                                        <>
                                            <span>Register</span>
                                            <ArrowRight size={18} />
                                        </>
                                    )}
                                </button>
                        </form>
                    ) : (
                        <form onSubmit={handleVerify} className="space-y-6">
                            {error && (
                                <div className="bg-red-50 border border-red-200 text-red-600 dark:bg-red-500/10 dark:border-red-500/50 dark:text-red-500 text-sm py-3 px-4 rounded-sm text-center">
                                    {error}
                                </div>
                            )}
                            {success && (
                                <div className="bg-emerald-50 border border-emerald-200 text-emerald-600 dark:bg-emerald-500/10 dark:border-emerald-500/50 dark:text-emerald-500 text-sm py-3 px-4 rounded-sm text-center">
                                    {success}
                                </div>
                            )}
                            
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 text-center mb-4">
                                    Enter the 6-digit code sent to your email
                                </label>
                                <input
                                    type="text"
                                    required
                                    maxLength={6}
                                    value={verificationCode}
                                    onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ''))}
                                    className="w-full px-4 py-3 rounded-sm
                                               bg-white dark:bg-slate-900
                                               border border-slate-300 dark:border-slate-600
                                               text-slate-900 dark:text-white
                                               placeholder-slate-400 dark:placeholder-slate-500
                                               text-center text-2xl tracking-[0.5em] font-mono
                                               focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500
                                               shadow-sm transition-all"
                                    placeholder="------"
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={loading || verificationCode.length !== 6}
                                className="w-full flex justify-center items-center space-x-2 py-3 px-4 border border-transparent rounded-sm shadow-sm text-sm font-semibold text-white bg-brand-500 hover:bg-brand-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-500 focus:ring-offset-slate-50 dark:focus:ring-offset-slate-900 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {loading ? (
                                    <>
                                        <svg className="animate-spin h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                                        </svg>
                                        Verifying...
                                    </>
                                ) : (
                                    <>
                                        <span>Verify & Enter</span>
                                        <ArrowRight size={18} />
                                    </>
                                )}
                            </button>
                            
                            <button
                                type="button"
                                onClick={() => setStep('register')}
                                className="w-full py-2 text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 text-center block"
                            >
                                Back to registration
                            </button>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Register;
