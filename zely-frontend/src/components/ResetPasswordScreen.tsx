
import React, { useState, useEffect } from 'react';
import { ShieldCheck, Loader2, ArrowLeft, Lock, Unlock, Check, AlertCircle, RefreshCw, Key, X, CheckCircle } from 'lucide-react';
import AuthLayout from './AuthLayout';

interface ToastProps {
    type: 'success' | 'error';
    message: string;
    onClose: () => void;
}

const Toast: React.FC<ToastProps> = ({ type, message, onClose }) => (
    <div className={`fixed top-20 sm:top-6 left-1/2 transform -translate-x-1/2 z-[2147483647] flex items-start justify-between gap-4 px-4 py-3 rounded-xl shadow-2xl transition-all duration-300 animate-in slide-in-from-top-4 fade-in w-[calc(100%-2rem)] sm:w-max max-w-[500px] sm:min-w-[320px] ${type === 'success'
        ? 'bg-white dark:bg-slate-800 border-l-4 border-green-500'
        : 'bg-white dark:bg-slate-800 border-l-4 border-red-500'
        }`}>
        <div className="flex items-start gap-3 overflow-hidden">
            {type === 'success' ? (
                <CheckCircle className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
            ) : (
                <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            )}
            <p className="text-sm font-bold text-slate-700 dark:text-slate-200 break-words leading-relaxed">{message}</p>
        </div>
        <button onClick={onClose} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors shrink-0 ml-2">
            <X className="w-4 h-4 text-slate-400" />
        </button>
    </div>
);

interface ResetPasswordScreenProps {
    onBackToLogin: () => void;
    onResetSuccess: () => void;
}

const ResetPasswordScreen: React.FC<ResetPasswordScreenProps> = ({ onBackToLogin, onResetSuccess }) => {
    const [step, setStep] = useState<'email' | 'otp' | 'newPassword'>('email');
    const [email, setEmail] = useState('');
    const [emailError, setEmailError] = useState<string | null>(null);
    const [otp, setOtp] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [countdown, setCountdown] = useState(0);
    const [error, setError] = useState<string | null>(null);
    const [passwordStrength, setPasswordStrength] = useState(0);
    const [toast, setToast] = useState<{ type: 'success' | 'error', message: string } | null>(null);

    useEffect(() => {
        if (countdown > 0) {
            const timer = setInterval(() => setCountdown(prev => prev - 1), 1000);
            return () => clearInterval(timer);
        }
    }, [countdown]);

    useEffect(() => {
        if (password.length === 0) {
            setPasswordStrength(0);
            return;
        }
        let strength = 0;
        if (password.length >= 6) strength += 1;
        if (password.length >= 10) strength += 1;
        if (/[A-Z]/.test(password)) strength += 1;
        if (/[0-9]/.test(password)) strength += 1;
        setPasswordStrength(strength);
    }, [password]);

    // Toast auto-dismiss logic (leaves within 5 seconds)
    useEffect(() => {
        if (toast) {
            const timer = setTimeout(() => {
                setToast(null);
            }, 5000);
            return () => clearTimeout(timer);
        }
    }, [toast]);

    const requirements = [
        { id: 1, label: "At least 6 characters", met: password.length >= 6 },
        { id: 2, label: "Contains a number", met: /[0-9]/.test(password) },
        { id: 3, label: "Contains uppercase letter", met: /[A-Z]/.test(password) },
    ];

    const allRequirementsMet = requirements.every(req => req.met);

    const validateEmailFormat = (val: string) => {
        if (!val) return 'Email address is required';
        if (!/\S+@\S+\.\S+/.test(val)) return 'Please enter a valid email address';
        return null;
    };

    const handleEmailSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const formatErr = validateEmailFormat(email);
        if (formatErr) {
            setEmailError(formatErr);
            return;
        }

        setIsLoading(true);
        setEmailError(null);

        // Simulate server-side account check
        await new Promise(resolve => setTimeout(resolve, 1500));

        // Custom error simulation: if user types 'unknown@example.com'
        if (email.toLowerCase() === 'unknown@example.com') {
            setEmailError("Account not found. We couldn't find a user with that email address. Please double-check your entry.");
            setIsLoading(false);
            return;
        }

        setIsLoading(false);
        setStep('otp');
        setCountdown(60);
    };

    const verifyOtp = async (code: string) => {
        if (isLoading) return;
        setIsLoading(true);
        setError(null);

        await new Promise(resolve => setTimeout(resolve, 2000));
        setIsLoading(false);

        if (code === '000000') {
            setError('Invalid verification code. Please try again with the most recent code sent to your email.');
            setOtp(''); // Clear if failed
        } else {
            setError(null);
            setStep('newPassword');
        }
    };

    const handleOtpChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value.replace(/\D/g, '').slice(0, 6);
        setOtp(val);
        if (error) setError(null);

        // Automatically start verification when required amount of digits is reached
        if (val.length === 6) {
            verifyOtp(val);
        }
    };

    const handleOtpSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (otp.length === 6) {
            verifyOtp(otp);
        }
    };

    const handleResendCode = () => {
        setCountdown(60);
        // Custom toast to inform user another code has been sent
        setToast({
            type: 'success',
            message: 'Security update: A new verification code has been dispatched to your inbox. Please allow up to 60 seconds for it to arrive.'
        });
    };

    const handlePasswordSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (password !== confirmPassword) {
            setError("Passwords don't match. Please ensure both password fields are identical.");
            return;
        }
        if (passwordStrength < 3) {
            setError("Please choose a stronger password to protect your account security.");
            return;
        }
        setIsLoading(true);
        await new Promise(resolve => setTimeout(resolve, 2000));
        setIsLoading(false);

        // Show success toast and delay redirect
        setToast({
            type: 'success',
            message: 'Your password has been reset successfully! You will be automatically redirected to the login screen in a few seconds.'
        });

        setTimeout(() => {
            onResetSuccess();
        }, 2500);
    };

    const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setPassword(e.target.value);
        if (error) setError(null);
    };

    const handleConfirmPasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setConfirmPassword(e.target.value);
        if (error) setError(null);
    };

    const RightSectionContent = (
        <>
            <div className="relative w-full h-[400px] mb-8 flex items-center justify-center perspective-[1000px]">
                <div className="absolute w-80 h-96 glassmorphism rounded-[2rem] border-t border-l border-white/20 shadow-2xl flex flex-col items-center justify-between py-10 z-20 animate-float overflow-hidden group">
                    <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none"></div>
                    <div className="w-full px-8 flex justify-between items-center">
                        <div className="flex gap-1.5">
                            <div className="w-1.5 h-1.5 rounded-full bg-red-400"></div>
                            <div className="w-1.5 h-1.5 rounded-full bg-yellow-400"></div>
                            <div className="w-1.5 h-1.5 rounded-full bg-green-400"></div>
                        </div>
                        <span className="text-[10px] font-bold tracking-widest text-gray-400 uppercase">Recovery_Service</span>
                    </div>
                    <div className="relative flex items-center justify-center">
                        <div className="absolute inset-0 bg-primary blur-3xl opacity-20 rounded-full"></div>
                        <div className="w-24 h-24 flex items-center justify-center text-white/90 drop-shadow-[0_0_15px_rgba(124,58,237,0.5)] z-10">
                            <Key className="w-24 h-24" strokeWidth={1.5} />
                        </div>
                    </div>
                    <div className="text-center space-y-2 relative z-10">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 backdrop-blur-md">
                            <span className="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
                            <span className="text-xs font-bold text-primary tracking-wide uppercase">Account Recovery</span>
                        </div>
                        <p className="text-xs text-gray-400 font-mono mt-2 tracking-widest uppercase">Secure Password Reset</p>
                    </div>
                </div>
                <div className="absolute w-72 h-80 glassmorphism-light rounded-3xl -rotate-6 z-10 translate-x-[-40px] translate-y-[20px]"></div>
            </div>
            <div className="space-y-4 text-center sm:text-left">
                <h2 className="text-4xl sm:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white via-gray-200 to-gray-400 tracking-tighter leading-tight">
                    Forgot your<br />password?
                </h2>
                <p className="text-lg text-gray-400 font-medium max-w-md leading-relaxed">
                    No worries, it happens. We'll help you get back into your account in just a few simple steps.
                </p>
            </div>
        </>
    );

    return (
        <AuthLayout rightSection={RightSectionContent}>
            {toast && (
                <Toast
                    type={toast.type}
                    message={toast.message}
                    onClose={() => setToast(null)}
                />
            )}

            <div className="flex flex-col animate-in fade-in slide-in-from-right-4 duration-300">
                <button
                    onClick={onBackToLogin}
                    className="self-start mb-8 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white flex items-center gap-2 text-sm font-semibold transition-colors"
                >
                    <ArrowLeft className="w-4 h-4" /> Back to Login
                </button>

                {step === 'email' && (
                    <>
                        <h1 className="text-3xl font-black text-slate-900 dark:text-white mb-2 tracking-tight">Reset Password</h1>
                        <p className="text-slate-500 dark:text-slate-400 mb-8 font-medium">Enter your account email to receive a reset code.</p>
                        <form onSubmit={handleEmailSubmit} className="space-y-6">
                            <div>
                                <label className="block text-sm font-semibold text-slate-600 dark:text-slate-300 mb-2">Email Address</label>
                                <div className="relative">
                                    <input
                                        type="email"
                                        value={email}
                                        onChange={(e) => {
                                            setEmail(e.target.value);
                                            if (emailError) setEmailError(null);
                                        }}
                                        placeholder="you@example.com"
                                        className={`w-full bg-slate-50 dark:bg-slate-800 border transition-all duration-300 rounded-xl py-3.5 px-4 text-slate-900 dark:text-white focus:outline-none focus:ring-2 ${emailError
                                            ? 'border-red-500 ring-red-500/10'
                                            : 'border-slate-200 dark:border-slate-700 focus:ring-primary/20'
                                            }`}
                                        required
                                        autoFocus
                                    />
                                </div>
                                {emailError && (
                                    <div className="mt-3 p-3 bg-red-50 dark:bg-red-900/10 rounded-lg border border-red-100 dark:border-red-900/20 flex items-start gap-2 animate-in fade-in slide-in-from-top-1 duration-200">
                                        <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                                        <p className="text-xs font-bold text-red-600 dark:text-red-400 leading-normal">
                                            {emailError}
                                        </p>
                                    </div>
                                )}
                            </div>
                            <button
                                type="submit"
                                disabled={isLoading}
                                className="w-full py-3.5 bg-slate-900 dark:bg-primary text-white font-bold rounded-xl flex items-center justify-center hover:opacity-95 transition-all disabled:opacity-50 transform active:scale-[0.98]"
                            >
                                {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Verify Identity"}
                            </button>
                        </form>
                    </>
                )}

                {step === 'otp' && (
                    <div className="flex flex-col items-center">
                        <h1 className="text-3xl font-black text-slate-900 dark:text-white mb-2 tracking-tight text-center">Security Check</h1>
                        <p className="text-slate-500 dark:text-slate-400 mb-10 text-center font-medium leading-relaxed">
                            For your protection, enter the 6-digit code we sent to<br />
                            <span className="text-slate-900 dark:text-white font-bold">{email}</span>
                        </p>
                        <form onSubmit={handleOtpSubmit} className="w-full space-y-8 flex flex-col items-center">
                            <div className="relative w-full flex justify-center">
                                <input
                                    type="text"
                                    maxLength={6}
                                    value={otp}
                                    onChange={handleOtpChange}
                                    className={`w-full max-w-[200px] text-center text-lg font-mono font-bold tracking-[0.4em] py-2 bg-slate-50 dark:bg-slate-800 border rounded-xl focus:outline-none focus:ring-4 focus:ring-primary/10 transition-all text-slate-900 dark:text-white ${error ? 'border-red-500 shadow-[0_0_10px_rgba(239,68,68,0.1)]' : 'border-slate-200 dark:border-slate-700'
                                        }`}
                                    placeholder="000000"
                                    autoFocus
                                />
                            </div>

                            {error && (
                                <div className="flex items-center justify-center gap-2 text-red-500 text-xs font-bold animate-pulse">
                                    <AlertCircle className="w-4 h-4" />
                                    {error}
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={isLoading || otp.length !== 6}
                                className="w-full py-3.5 bg-slate-900 dark:bg-primary text-white font-bold rounded-xl flex items-center justify-center gap-3 hover:opacity-95 transition-all disabled:opacity-50 transform active:scale-[0.98]"
                            >
                                <div className="flex items-center gap-2">
                                    {isLoading && <Loader2 className="w-5 h-5 animate-spin" />}
                                    <span>{isLoading ? "Validating Code..." : "Continue to Reset"}</span>
                                </div>
                            </button>

                            <div className="text-center pt-2">
                                <button
                                    type="button"
                                    disabled={countdown > 0 || isLoading}
                                    onClick={handleResendCode}
                                    className={`text-sm font-bold flex items-center gap-2 mx-auto transition-colors px-4 py-2 rounded-lg ${countdown > 0
                                        ? 'text-slate-400 bg-slate-100 dark:bg-slate-800/50'
                                        : 'text-primary hover:bg-primary/5 hover:underline'
                                        }`}
                                >
                                    <RefreshCw className={`w-4 h-4 ${countdown > 0 ? 'opacity-50' : ''}`} />
                                    {countdown > 0 ? `Resend code in ${countdown}s` : "Request Another Code"}
                                </button>
                            </div>
                        </form>
                    </div>
                )}

                {step === 'newPassword' && (
                    <>
                        <h1 className="text-3xl font-black text-slate-900 dark:text-white mb-2 tracking-tight">New Credentials</h1>
                        <p className="text-slate-500 dark:text-slate-400 mb-8 font-medium">Please select a strong password that you haven't used before.</p>
                        <form onSubmit={handlePasswordSubmit} className="space-y-5">
                            <div>
                                <label className="block text-sm font-semibold text-slate-600 dark:text-slate-300 mb-2">New Password</label>
                                <div className="relative group">
                                    <input
                                        type={showPassword ? "text" : "password"}
                                        value={password}
                                        onChange={handlePasswordChange}
                                        placeholder="••••••••"
                                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-3.5 px-4 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                                        required
                                        autoFocus
                                    />
                                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors">
                                        {showPassword ? <Unlock className="w-5 h-5" /> : <Lock className="w-5 h-5" />}
                                    </button>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-slate-600 dark:text-slate-300 mb-2">Confirm Password</label>
                                <div className="relative group">
                                    <input
                                        type={showConfirmPassword ? "text" : "password"}
                                        value={confirmPassword}
                                        onChange={handleConfirmPasswordChange}
                                        placeholder="••••••••"
                                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-3.5 px-4 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                                        required
                                    />
                                    <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors">
                                        {showConfirmPassword ? <Unlock className="w-5 h-5" /> : <Lock className="w-5 h-5" />}
                                    </button>
                                </div>
                            </div>

                            {password.length > 0 && !allRequirementsMet && (
                                <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-700 animate-in fade-in zoom-in-95 duration-200">
                                    <div className="flex justify-between items-center mb-1">
                                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Strength</span>
                                        <span className={`text-xs font-bold ${passwordStrength < 3 ? 'text-yellow-500' : 'text-green-500'}`}>
                                            {passwordStrength < 2 ? 'Weak' : passwordStrength === 3 ? 'Good' : 'Strong'}
                                        </span>
                                    </div>
                                    <div className="flex gap-2 h-1.5 mb-4">
                                        {[1, 2, 3, 4].map(level => (
                                            <div key={level} className={`flex-1 rounded-full transition-all duration-500 ${passwordStrength >= level ? 'bg-green-500' : 'bg-slate-200 dark:bg-slate-700'}`} />
                                        ))}
                                    </div>
                                    <div className="space-y-2">
                                        {requirements.map(req => (
                                            <div key={req.id} className="flex items-center gap-2">
                                                <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${req.met ? 'bg-green-500 border-green-500 text-white' : 'border-slate-300'}`}>
                                                    {req.met && <Check className="w-2.5 h-2.5" strokeWidth={4} />}
                                                </div>
                                                <span className={`text-xs ${req.met ? 'text-slate-700 dark:text-slate-200 font-bold' : 'text-slate-400'}`}>{req.label}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {error && (
                                <div className="flex items-center gap-2 text-red-500 text-xs font-bold">
                                    <AlertCircle className="w-4 h-4" />
                                    {error}
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={isLoading || passwordStrength < 3}
                                className="w-full py-3.5 bg-slate-900 dark:bg-primary text-white font-bold rounded-xl flex items-center justify-center hover:opacity-95 transition-all disabled:opacity-50"
                            >
                                {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Update Password"}
                            </button>
                        </form>
                    </>
                )}
            </div>
        </AuthLayout>
    );
};

export default ResetPasswordScreen;
