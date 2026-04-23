import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Server, ArrowRight, Sun, Moon } from 'lucide-react';
import axios from 'axios';
import { useTheme } from '../components/ThemeContext';
import PasswordStrengthMeter from '../components/PasswordStrengthMeter';

const Register = () => {
    const { theme, toggleTheme } = useTheme();
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const navigate = useNavigate();

    const handleRegister = async (e) => {
        e.preventDefault();
        setError('');

        // Validar que la contraseña sea segura
        const passwordStrength = validatePasswordStrength(password);
        if (!passwordStrength.isValid) {
            setError(passwordStrength.message);
            return;
        }

        if (password !== confirmPassword) {
            setError('Las contraseñas no coinciden');
            return;
        }

        try {
            const res = await axios.post('/api/auth/register', { name, email, password });
            
            // Auto login
            localStorage.setItem('name', res.data.name);
            localStorage.setItem('email', res.data.email);
            localStorage.setItem('role', res.data.role);

            setSuccess('Registro exitoso. Accediendo al panel...');
            setTimeout(() => window.location.href = '/app', 1000);
        } catch (err) {
            setError(err.response?.data?.message || 'Registro fallido');
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
            return { isValid: false, message: 'La contraseña debe tener al menos 8 caracteres' };
        }
        if (!criteria.lowercase) {
            return { isValid: false, message: 'La contraseña debe contener letras minúsculas' };
        }
        if (!criteria.uppercase) {
            return { isValid: false, message: 'La contraseña debe contener letras mayúsculas' };
        }
        if (!criteria.numbers) {
            return { isValid: false, message: 'La contraseña debe contener números' };
        }
        if (!criteria.special) {
            return { isValid: false, message: 'La contraseña debe contener caracteres especiales (!@#$%^&*)' };
        }

        return { isValid: true, message: '' };
    };

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex flex-col justify-center py-12 sm:px-6 lg:px-8 selection:bg-brand-500/30 transition-colors duration-200">
            <div className="absolute top-6 right-6">
                <button
                    onClick={toggleTheme}
                    className="p-2.5 rounded-xl bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 shadow-sm border border-slate-200 dark:border-slate-700 transition-colors"
                    title="Toggle Theme"
                >
                    {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
                </button>
            </div>
            <div className="sm:mx-auto sm:w-full sm:max-w-md">
                <Link to="/" className="flex justify-center items-center space-x-3 mb-8">
                    <div className="w-12 h-12 bg-brand-50 border-brand-200 dark:bg-brand-500/10 rounded-xl flex items-center justify-center border dark:border-brand-500/20 shadow-[0_0_15px_rgba(14,165,233,0.1)] dark:shadow-[0_0_15px_rgba(14,165,233,0.2)]">
                        <Server className="text-brand-500 dark:text-brand-400" size={28} />
                    </div>
                </Link>
                <h2 className="text-center text-3xl font-extrabold text-slate-900 dark:text-white">
                    Crea tu cuenta
                </h2>
                <p className="mt-2 text-center text-sm text-slate-600 dark:text-slate-400">
                    ¿Ya tienes cuenta?{' '}
                    <Link to="/login" className="font-medium text-brand-500 hover:text-brand-600 dark:text-brand-400 dark:hover:text-brand-300 transition-colors">
                        Inicia sesión aquí
                    </Link>
                </p>
            </div>

            <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
                <div className="bg-white dark:bg-slate-800/50 py-8 px-4 shadow-2xl shadow-slate-200/50 dark:shadow-black/50 sm:rounded-3xl sm:px-10 border border-slate-200 dark:border-slate-700 backdrop-blur-xl">
                    <form className="space-y-6" onSubmit={handleRegister}>
                        {error && (
                            <div className="bg-red-50 border border-red-200 text-red-600 dark:bg-red-500/10 dark:border-red-500/50 dark:text-red-500 text-sm py-3 px-4 rounded-xl text-center">
                                {error}
                            </div>
                        )}
                        {success && (
                            <div className="bg-emerald-50 border border-emerald-200 text-emerald-600 dark:bg-emerald-500/10 dark:border-emerald-500/50 dark:text-emerald-500 text-sm py-3 px-4 rounded-xl text-center">
                                {success}
                            </div>
                        )}

                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                                Nombre Completo
                            </label>
                            <div className="mt-2">
                                <input
                                    type="text"
                                    required
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    className="appearance-none block w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-xl shadow-sm placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white sm:text-sm transition-shadow"
                                    placeholder="Juan Pérez"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                                Correo Electrónico
                            </label>
                            <div className="mt-2">
                                <input
                                    type="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="appearance-none block w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-xl shadow-sm placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white sm:text-sm transition-shadow"
                                    placeholder="tu@ejemplo.com"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                                Contraseña
                            </label>
                            <div className="mt-2">
                                <input
                                    type="password"
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="appearance-none block w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-xl shadow-sm placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white sm:text-sm transition-shadow"
                                    placeholder="••••••••"
                                />
                            </div>
                            {password.length > 0 && <PasswordStrengthMeter password={password} />}
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                                Confirmar Contraseña
                            </label>
                            <div className="mt-2">
                                <input
                                    type="password"
                                    required
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    className={`appearance-none block w-full px-4 py-3 border rounded-xl shadow-sm placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:border-transparent bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white sm:text-sm transition-all ${
                                        confirmPassword && password !== confirmPassword
                                            ? 'border-red-400 dark:border-red-500 focus:ring-red-500'
                                            : confirmPassword && password === confirmPassword
                                            ? 'border-emerald-400 dark:border-emerald-500 focus:ring-emerald-500'
                                            : 'border-slate-300 dark:border-slate-600 focus:ring-brand-500'
                                    }`}
                                    placeholder="••••••••"
                                />
                            </div>
                            {confirmPassword && password !== confirmPassword && (
                                <p className="mt-2 text-xs text-red-600 dark:text-red-400 flex items-center space-x-1">
                                    <span>❌</span>
                                    <span>Las contraseñas no coinciden</span>
                                </p>
                            )}
                            {confirmPassword && password === confirmPassword && (
                                <p className="mt-2 text-xs text-emerald-600 dark:text-emerald-400 flex items-center space-x-1">
                                    <span>✅</span>
                                    <span>Las contraseñas coinciden</span>
                                </p>
                            )}
                        </div>

                            <button
                                type="submit"
                                disabled={!validatePasswordStrength(password).isValid || password !== confirmPassword}
                                className="w-full flex justify-center items-center space-x-2 py-3 px-4 border border-transparent rounded-xl shadow-lg text-sm font-semibold text-white bg-brand-500 hover:bg-brand-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-500 focus:ring-offset-slate-50 dark:focus:ring-offset-slate-900 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-brand-500"
                            >
                                <span>Registrarse</span>
                                <ArrowRight size={18} />
                            </button>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default Register;
