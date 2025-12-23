
import React, { useState, useEffect } from 'react';
import { ShieldCheck, Loader2, ArrowLeft, Key, Mail, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';
import AuthLayout from './AuthLayout';

interface TwoFactorScreenProps {
    onVerified: () => void;
    onBackToLogin: () => void;
}

const TwoFactorScreen: React.FC<TwoFactorScreenProps> = ({ onVerified, onBackToLogin }) => {
    const [code, setCode] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [countdown, setCountdown] = useState(60);
    const [mode, setMode] = useState<'totp' | 'backup' | 'email'>('totp');
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (countdown > 0) {
            const timer = setInterval(() => setCountdown(prev => prev - 1), 1000);
            return () => clearInterval(timer);
        }
    }, [countdown]);

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value.replace(/\D/g, '').slice(0, mode === 'backup' ? 8 : 6);
        setCode(val);
        if (error) setError(null);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const requiredLength = mode === 'backup' ? 8 : 6;
        if (code.length !== requiredLength) return;

        setIsLoading(true);
        setError(null);

        // Simulate verification
        await new Promise(resolve => setTimeout(resolve, 1500));

        if (code === '000000' || code === '00000000') {
            setError('Invalid verification code. Please try again.');
            setIsLoading(false);
        } else {
            onVerified();
        }
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
                        <span className="text-[10px] font-bold tracking-widest text-gray-400 uppercase">Two_Factor_Auth</span>
                    </div>

                    <div className="relative flex items-center justify-center">
                        <div className="absolute inset-0 bg-primary blur-3xl opacity-20 rounded-full"></div>
                        <div className="w-24 h-24 flex items-center justify-center text-white/90 drop-shadow-[0_0_15px_rgba(124,58,237,0.5)] z-10">
                            <ShieldCheck className="w-24 h-24" strokeWidth={1.5} />
                        </div>
                    </div>

                    <div className="text-center space-y-2 relative z-10">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 backdrop-blur-md">
                            <span className="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
                            <span className="text-xs font-bold text-primary tracking-wide uppercase">Identity Verified</span>
                        </div>
                        <p className="text-xs text-gray-400 font-mono mt-2 tracking-widest uppercase">Layer 2 Protection</p>
                    </div>
                </div>

                {/* Background Decoration */}
                <div className="absolute w-72 h-80 glassmorphism-light rounded-3xl -rotate-6 z-10 translate-x-[-40px] translate-y-[20px]"></div>
            </div>

            <div className="space-y-4 text-center sm:text-left">
                <h2 className="text-4xl sm:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white via-gray-200 to-gray-400 tracking-tighter leading-tight">
                    One More<br />Step to Go.
                </h2>
                <p className="text-lg text-gray-400 font-medium max-w-md leading-relaxed">
                    Help us keep your account secure by verifying your identity through two-factor authentication.
                </p>
            </div>
        </>
    );

    return (
        <AuthLayout rightSection={RightSectionContent}>
            <div className="flex flex-col items-center animate-in fade-in slide-in-from-right-4 duration-300">
                <button
                    onClick={onBackToLogin}
                    className="self-start mb-8 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white flex items-center gap-2 text-sm font-semibold transition-colors"
                >
                    <ArrowLeft className="w-4 h-4" /> Back to Login
                </button>

                <div className="w-16 h-16 bg-primary/10 text-primary rounded-full flex items-center justify-center mb-6">
                    {mode === 'totp' && <ShieldCheck className="w-8 h-8" />}
                    {mode === 'backup' && <Key className="w-8 h-8" />}
                    {mode === 'email' && <Mail className="w-8 h-8" />}
                </div>

                <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white mb-2 text-center tracking-tight">
                    {mode === 'totp' ? 'Security Verification' : mode === 'backup' ? 'Backup Code' : 'Email Verification'}
                </h1>

                <p className="text-slate-500 dark:text-slate-400 text-center mb-10 max-w-xs mx-auto text-sm font-medium leading-relaxed">
                    {mode === 'totp' && "Enter the 6-digit code from your authenticator app."}
                    {mode === 'backup' && "Enter one of your 8-digit backup codes to access your account."}
                    {mode === 'email' && "We've sent a 6-digit code to your registered email address."}
                </p>

                <form onSubmit={handleSubmit} className="w-full space-y-8 flex flex-col items-center">
                    <div className="flex justify-center flex-col items-center gap-4 w-full">
                        <input
                            type="text"
                            maxLength={mode === 'backup' ? 8 : 6}
                            value={code}
                            onChange={handleCodeChange}
                            className="w-full max-w-[200px] text-center text-lg font-mono font-bold tracking-[0.4em] py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:border-primary dark:focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all duration-300 text-slate-900 dark:text-white"
                            placeholder={mode === 'backup' ? "00000000" : "000000"}
                            autoFocus
                        />

                        {mode === 'email' && (
                            <div className="flex items-center gap-2 text-xs font-bold text-slate-400">
                                <RefreshCw className={`w-3 h-3 ${countdown > 0 ? '' : 'text-primary'}`} />
                                {countdown > 0 ? `Code expires in ${formatTime(countdown)}` : (
                                    <button type="button" onClick={() => setCountdown(60)} className="text-primary hover:underline">
                                        Code expired? Resend email
                                    </button>
                                )}
                            </div>
                        )}
                    </div>

                    {error && (
                        <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800/20 flex items-center gap-3 text-red-500 text-xs font-bold animate-pulse">
                            <AlertCircle className="w-4 h-4" />
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={isLoading || code.length < (mode === 'backup' ? 8 : 6)}
                        className="w-full flex justify-center items-center py-3.5 px-4 border border-transparent rounded-xl text-sm font-bold text-white bg-slate-900 dark:bg-primary hover:bg-slate-800 dark:hover:bg-primary-light transition-all duration-300 transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isLoading ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                            "Verify and Continue"
                        )}
                    </button>
                </form>

                <div className="mt-10 w-full flex flex-col gap-4">
                    {mode !== 'backup' && (
                        <button
                            onClick={() => { setMode('backup'); setCode(''); setError(null); }}
                            className="text-sm font-bold text-slate-500 hover:text-primary transition-colors flex items-center justify-center gap-2"
                        >
                            <Key className="w-4 h-4" /> Use backup code instead
                        </button>
                    )}
                    {mode !== 'email' && (
                        <button
                            onClick={() => { setMode('email'); setCode(''); setError(null); setCountdown(60); }}
                            className="text-sm font-bold text-slate-500 hover:text-primary transition-colors flex items-center justify-center gap-2"
                        >
                            <Mail className="w-4 h-4" /> Lost access? Use email verification
                        </button>
                    )}
                    {mode !== 'totp' && (
                        <button
                            onClick={() => { setMode('totp'); setCode(''); setError(null); }}
                            className="text-sm font-bold text-primary hover:underline transition-colors flex items-center justify-center gap-2"
                        >
                            Back to Authenticator App
                        </button>
                    )}
                </div>
            </div>
        </AuthLayout>
    );
};

export default TwoFactorScreen;
