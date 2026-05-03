import { useTranslation } from "react-i18next";import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Server, ArrowRight, Sun, Moon, Eye, EyeOff } from 'lucide-react';
import axios from 'axios';
import { useTheme } from '../components/ThemeContext';
import PasswordStrengthMeter from '../components/PasswordStrengthMeter';

const ForgotPassword = () => {const { t } = useTranslation();
  const { theme, toggleTheme } = useTheme();
  const [step, setStep] = useState('email'); // 'email', 'code', 'password', 'success'
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const validatePasswordStrength = (pwd) => {
    const criteria = {
      length: pwd.length >= 8,
      lowercase: /[a-z]/.test(pwd),
      uppercase: /[A-Z]/.test(pwd),
      numbers: /[0-9]/.test(pwd),
      special: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(pwd)
    };
    if (!criteria.length) return { isValid: false, message: 'Password must be at least 8 characters long' };
    if (!criteria.lowercase) return { isValid: false, message: 'Password must contain lowercase letters' };
    if (!criteria.uppercase) return { isValid: false, message: 'Password must contain uppercase letters' };
    if (!criteria.numbers) return { isValid: false, message: 'Password must contain numbers' };
    if (!criteria.special) return { isValid: false, message: 'Password must contain special characters' };
    return { isValid: true, message: '' };
  };

  const handleSendEmail = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await axios.post('/api/auth/forgot-password', { email });
      setStep('code');
      setSuccess(`Recovery code sent to ${email}`);
    } catch (err) {
      setError(err.response?.data?.message || 'Error sending recovery email.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = (e) => {
    e.preventDefault();
    if (code.length === 6) {
      setStep('password');
      setSuccess('');
      setError('');
    } else {
      setError('Code must be 6 digits');
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const passwordStrength = validatePasswordStrength(newPassword);
    if (!passwordStrength.isValid) {
      setError(passwordStrength.message);
      setLoading(false);
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    try {
      await axios.post('/api/auth/reset-password', { email, code, newPassword });
      setStep('success');
      setSuccess('Password reset successfully!');
    } catch (err) {
      setError(err.response?.data?.message || 'Error resetting password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex flex-col justify-center py-12 sm:px-6 lg:px-8 selection:bg-brand-500/30 transition-colors duration-200">
            <div className="absolute top-6 right-6">
                <button
          onClick={toggleTheme}
          className="p-2.5 rounded-sm bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 shadow-sm border border-slate-200 dark:border-slate-700 transition-colors">
          
                    {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
                </button>
            </div>
            
            <div className="sm:mx-auto sm:w-full sm:max-w-md">
                <Link to="/" className="flex justify-center items-center space-x-3 mb-8">
                    <div className="w-12 h-12 bg-brand-50 border-brand-200 dark:bg-brand-500/10 rounded-sm flex items-center justify-center border dark:border-brand-500/20 shadow-[0_0_15px_rgba(14,165,233,0.1)] dark:shadow-[0_0_15px_rgba(14,165,233,0.2)]">
                        <Server className="text-brand-500 dark:text-brand-400" size={28} />
                    </div>
                </Link>
                <h2 className="text-center text-3xl font-extrabold text-slate-900 dark:text-white">
                    {t("auto.reset_password")}
                </h2>
                <p className="mt-2 text-center text-sm text-slate-600 dark:text-slate-400">
                    {t("auto.remember_your_password_")}{' '}
                    <Link to="/login" className="font-medium text-brand-500 hover:text-brand-600 dark:text-brand-400 dark:hover:text-brand-300 transition-colors">
                        {t("auto.sign_in_here")}
                    </Link>
                </p>
            </div>

            <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
                <div className="bg-white dark:bg-slate-800/50 py-8 px-4 shadow-md shadow-slate-200/50 dark:shadow-black/50 sm:rounded-sm sm:px-10 border border-slate-200 dark:border-slate-700 backdrop-blur-xl">
                    {error &&
          <div className="mb-6 bg-red-50 border border-red-200 text-red-600 dark:bg-red-500/10 dark:border-red-500/50 dark:text-red-500 text-sm py-3 px-4 rounded-sm text-center">
                            {error}
                        </div>
          }
                    {success && step !== 'success' &&
          <div className="mb-6 bg-emerald-50 border border-emerald-200 text-emerald-600 dark:bg-emerald-500/10 dark:border-emerald-500/50 dark:text-emerald-500 text-sm py-3 px-4 rounded-sm text-center">
                            {success}
                        </div>
          }

                    {step === 'email' &&
          <form onSubmit={handleSendEmail} className="space-y-6">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                                    {t("auto.email_address")}
                                </label>
                                <div className="mt-2">
                                    <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="appearance-none block w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-sm shadow-sm placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white sm:text-sm transition-shadow"
                  placeholder={t("auto.you_example_com")} />
                
                                </div>
                            </div>
                            <button
              type="submit"
              disabled={loading || !email}
              className="w-full flex justify-center items-center space-x-2 py-3 px-4 border border-transparent rounded-sm shadow-sm text-sm font-semibold text-white bg-brand-500 hover:bg-brand-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-500 focus:ring-offset-slate-50 dark:focus:ring-offset-slate-900 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
              
                                {loading ? 'Sending...' : 'Send Recovery Code'}
                            </button>
                        </form>
          }

                    {step === 'code' &&
          <form onSubmit={handleVerifyCode} className="space-y-6">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 text-center mb-2">
                                    {t("auto.enter_6_digit_code")}
                                </label>
                                <input
                type="text"
                required
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                className="w-full px-4 py-3 rounded-sm bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white text-center text-2xl tracking-[0.5em] font-mono focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500"
                placeholder={t("auto._")} />
              
                            </div>
                            <button
              type="submit"
              disabled={code.length !== 6}
              className="w-full flex justify-center items-center space-x-2 py-3 px-4 border border-transparent rounded-sm shadow-sm text-sm font-semibold text-white bg-brand-500 hover:bg-brand-600 focus:outline-none transition-all disabled:opacity-50">
                                {t("auto.verify_code")}
                            
            </button>
                            <button type="button" onClick={() => setStep('email')} className="w-full py-2 text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 text-center block">
                                {t("auto.back")}
                            </button>
                        </form>
          }

                    {step === 'password' &&
          <form onSubmit={handleResetPassword} className="space-y-6">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                                    {t("auto.new_password")}
                                </label>
                                <div className="mt-2 relative">
                                    <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="appearance-none block w-full px-4 py-3 pr-11 border border-slate-300 dark:border-slate-600 rounded-sm shadow-sm placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white sm:text-sm transition-shadow"
                  placeholder={t("auto._")} />
                
                                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 transition-colors">
                                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                    </button>
                                </div>
                                {newPassword.length > 0 && <PasswordStrengthMeter password={newPassword} />}
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                                    {t("auto.confirm_new_password")}
                                </label>
                                <div className="mt-2">
                                    <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="appearance-none block w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-sm shadow-sm placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white sm:text-sm transition-shadow"
                  placeholder={t("auto._")} />
                
                                </div>
                            </div>
                            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center items-center space-x-2 py-3 px-4 border border-transparent rounded-sm shadow-sm text-sm font-semibold text-white bg-brand-500 hover:bg-brand-600 focus:outline-none transition-all disabled:opacity-50">
              
                                {loading ? 'Resetting...' : 'Reset Password'}
                            </button>
                        </form>
          }

                    {step === 'success' &&
          <div className="text-center">
                            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-emerald-100 dark:bg-emerald-900/50 mb-4">
                                <svg className="h-6 w-6 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                                </svg>
                            </div>
                            <h3 className="text-lg leading-6 font-medium text-slate-900 dark:text-white mb-2">{t("auto.password_reset_successful")}</h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">{t("auto.you_can_now_log_in_with_your_new_passwor")}</p>
                            <Link to="/login" className="w-full flex justify-center py-3 px-4 border border-transparent rounded-sm shadow-sm text-sm font-medium text-white bg-brand-500 hover:bg-brand-600 focus:outline-none">
                                {t("auto.go_to_login")}
                            </Link>
                        </div>
          }
                </div>
            </div>
        </div>);

};

export default ForgotPassword;