
import React, { useState, useEffect } from 'react';
import { Mail, Lock, Unlock, Grid, Loader2, X, CheckCircle, AlertCircle, ArrowRight, Wand2, Hash, Fingerprint, ArrowLeft } from 'lucide-react';
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

interface LoginScreenProps {
  onSwitchToRegister: () => void;
  onForgotPassword: () => void;
  onLoginSuccess: () => void;
  onAdminLogin: () => void;
}

type AuthMode = 'password' | 'magic' | 'otp' | 'passkey';

const LoginScreen: React.FC<LoginScreenProps> = ({ onSwitchToRegister, onForgotPassword, onLoginSuccess, onAdminLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>('password');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<{ email?: string, password?: string }>({});
  const [toast, setToast] = useState<{ type: 'success' | 'error', message: string } | null>(null);

  const validateEmail = (value: string) => {
    if (!value) return 'Email is required';
    if (!/\S+@\S+\.\S+/.test(value)) return 'Please enter a valid email address';
    return undefined;
  };

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setEmail(val);
    if (errors.email) {
      setErrors(prev => ({ ...prev, email: validateEmail(val) }));
    }
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setPassword(val);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const emailError = validateEmail(email);
    if (emailError) {
      setErrors({ email: emailError });
      return;
    }

    setIsLoading(true);
    setErrors({});

    if (authMode === 'password') {
      await new Promise(resolve => setTimeout(resolve, 1500));
      setIsLoading(false);

      if (email === 'admin@admin.com') {
        onAdminLogin();
        return;
      }

      const isSuccess = email !== 'error@example.com';
      if (isSuccess) {
        onLoginSuccess();
      } else {
        setToast({ type: 'error', message: 'Invalid credentials. Please verify your email and password and try again.' });
      }
    } else if (authMode === 'magic') {
      await new Promise(resolve => setTimeout(resolve, 2000));
      setIsLoading(false);
      setToast({ type: 'success', message: `Magic link sent to ${email}! Please check your inbox and click the link to sign in.` });
    } else if (authMode === 'otp') {
      await new Promise(resolve => setTimeout(resolve, 1500));
      setIsLoading(false);
      setToast({ type: 'success', message: 'Verification code sent! Please check your email and enter the code to continue.' });
    } else if (authMode === 'passkey') {
      await new Promise(resolve => setTimeout(resolve, 2500));
      setIsLoading(false);
      onLoginSuccess();
    }
  };

  const RightSectionContent = (
    <>
      <div className="relative w-full h-[400px] mb-8 flex items-center justify-center perspective-[1000px]">
        <div className="absolute w-80 h-96 glassmorphism rounded-[2rem] border-t border-l border-white/20 shadow-2xl flex flex-col items-center justify-between py-10 z-20 animate-float overflow-hidden group hover:scale-105 transition-transform duration-500">
          <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none"></div>
          <div className="w-full px-8 flex justify-between items-center">
            <div className="flex gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-red-400"></div>
              <div className="w-1.5 h-1.5 rounded-full bg-yellow-400"></div>
              <div className="w-1.5 h-1.5 rounded-full bg-green-400"></div>
            </div>
            <span className="text-[10px] font-bold tracking-widest text-gray-400 uppercase">Secure_Shell</span>
          </div>
          <div className="relative flex items-center justify-center">
            <div className="absolute inset-0 bg-violet-500 blur-3xl opacity-20 rounded-full"></div>
            <div className="w-24 h-24 flex items-center justify-center text-white/90 drop-shadow-[0_0_15px_rgba(124,58,237,0.5)] z-10">
              <svg width="96" height="96" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                <path d="m9 12 2 2 4-4" />
              </svg>
            </div>
          </div>
          <div className="text-center space-y-2 relative z-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-green-500/10 border border-green-500/20 backdrop-blur-md">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
              <span className="text-xs font-bold text-green-400 tracking-wide">ENCRYPTED</span>
            </div>
            <p className="text-xs text-gray-400 font-mono mt-2">256-BIT SSL PROTECTION</p>
          </div>
        </div>
        <div className="absolute w-72 h-80 glassmorphism-light rounded-3xl -rotate-6 z-10 translate-x-[-40px] translate-y-[20px] flex items-center justify-center">
          <div className="w-full p-6 space-y-3 opacity-30">
            <div className="h-2 bg-white/50 rounded-full w-3/4"></div>
            <div className="h-2 bg-white/30 rounded-full w-1/2"></div>
            <div className="h-2 bg-white/30 rounded-full w-5/6"></div>
          </div>
        </div>
      </div>
      <div className="space-y-4 text-center sm:text-left">
        <h2 className="text-4xl sm:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white via-gray-200 to-gray-400 tracking-tighter leading-tight">
          Uncompromised<br />Security.
        </h2>
        <p className="text-lg text-gray-400 font-medium max-w-md leading-relaxed">
          Your data is protected with enterprise-grade encryption. Experience peace of mind while you create.
        </p>
      </div>
    </>
  );

  const getButtonText = () => {
    switch (authMode) {
      case 'magic': return 'Send Magic Link';
      case 'otp': return 'Send OTP Code';
      case 'passkey': return 'Continue with Passkey';
      default: return 'Log In';
    }
  };

  return (
    <AuthLayout rightSection={RightSectionContent}>
      {toast && (
        <Toast
          type={toast.type}
          message={toast.message}
          onClose={() => setToast(null)}
        />
      )}

      {authMode !== 'password' && (
        <button
          onClick={() => setAuthMode('password')}
          className="mb-4 flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-primary transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to standard login
        </button>
      )}

      <h1 className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white mb-2 tracking-tighter">
        {authMode === 'password' ? 'Welcome Back' :
          authMode === 'magic' ? 'Magic Login' :
            authMode === 'otp' ? 'One-Time Password' : 'Secure Passkey'}
      </h1>
      <p className="text-slate-500 dark:text-slate-400 mb-8 font-medium">
        {authMode === 'password' ? 'Securely login to manage your account.' :
          authMode === 'magic' ? 'We will email you a login link. No password needed.' :
            authMode === 'otp' ? 'Receive a 6-digit code via email.' : 'Login with your biometric device or security key.'}
      </p>

      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        <div>
          <label className="block text-sm font-semibold text-slate-600 dark:text-slate-300 mb-2" htmlFor="email">
            Email Address
          </label>
          <div className="relative group">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
              <Mail className={`w-5 h-5 transition-colors duration-300 ${errors.email ? 'text-red-400' : 'text-slate-400 group-focus-within:text-slate-900 dark:group-focus-within:text-primary'}`} />
            </div>
            <input
              id="email"
              type="email"
              value={email}
              onChange={handleEmailChange}
              placeholder="you@example.com"
              className={`w-full bg-slate-50 dark:bg-slate-800 border rounded-xl py-3.5 pl-11 pr-4 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none transition-all duration-300 ${errors.email
                ? 'border-red-500 focus:border-red-500 focus:ring-4 focus:ring-red-500/10'
                : 'border-slate-200 dark:border-slate-700 focus:border-slate-400 focus:ring-1 focus:ring-slate-400 dark:focus:border-primary-light dark:focus:ring-primary-light'
                }`}
              required
            />
          </div>
          {errors.email && (
            <p className="mt-1.5 text-xs font-semibold text-red-500 flex items-center gap-1 animate-pulse">
              <AlertCircle className="w-3 h-3" />
              {errors.email}
            </p>
          )}
        </div>

        {authMode === 'password' && (
          <div className="animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-semibold text-slate-600 dark:text-slate-300" htmlFor="password">
                Password
              </label>
              <button
                type="button"
                onClick={onForgotPassword}
                className="text-sm font-semibold text-primary hover:text-primary-light transition-colors"
              >
                Forgot Password?
              </button>
            </div>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                <Lock className={`w-5 h-5 transition-colors duration-300 ${errors.password ? 'text-red-400' : 'text-slate-400 group-focus-within:text-slate-900 dark:group-focus-within:text-primary'}`} />
              </div>
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={handlePasswordChange}
                placeholder="••••••••"
                className={`w-full bg-slate-50 dark:bg-slate-800 border rounded-xl py-3.5 pl-11 pr-12 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none transition-all duration-300 ${errors.password
                  ? 'border-red-500 focus:border-red-500 focus:ring-4 focus:ring-red-500/10'
                  : 'border-slate-200 dark:border-slate-700 focus:border-slate-400 focus:ring-1 focus:ring-slate-400 dark:focus:border-primary-light dark:focus:ring-primary-light'
                  }`}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 focus:outline-none transition-colors"
              >
                {showPassword ? (
                  <Unlock className="w-5 h-5" />
                ) : (
                  <Lock className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>
        )}

        <button
          type="submit"
          disabled={isLoading}
          className="w-full flex justify-center items-center py-3.5 px-4 border border-transparent rounded-xl text-base font-bold text-white bg-slate-900 dark:bg-primary dark:hover:bg-primary-light hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-slate-900 focus:ring-slate-900 transition-all duration-300 transform hover:scale-[1.02] disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none !mt-8"
        >
          {isLoading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            getButtonText()
          )}
        </button>
      </form>

      <div className="relative flex items-center my-8">
        <div className="flex-grow border-t border-slate-200 dark:border-slate-700"></div>
        <span className="flex-shrink mx-4 text-xs font-bold text-slate-400 uppercase tracking-widest">
          {authMode === 'password' ? 'Or sign in with' : 'Other options'}
        </span>
        <div className="flex-grow border-t border-slate-200 dark:border-slate-700"></div>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-6">
        {authMode !== 'password' && (
          <button
            onClick={() => setAuthMode('password')}
            className="w-full flex items-center justify-center gap-3 py-3 px-4 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all duration-300 transform hover:scale-[1.02]"
          >
            <Lock className="w-5 h-5 text-slate-400" />
            <span>Password</span>
          </button>
        )}
        <button className="w-full flex items-center justify-center gap-3 py-3 px-4 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all duration-300 transform hover:scale-[1.02]">
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
          </svg>
          <span>Google</span>
        </button>
        {authMode !== 'magic' && (
          <button
            onClick={() => setAuthMode('magic')}
            className="w-full flex items-center justify-center gap-3 py-3 px-4 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all duration-300 transform hover:scale-[1.02]"
          >
            <Wand2 className="w-5 h-5 text-indigo-500" />
            <span>Magic Link</span>
          </button>
        )}
        {authMode !== 'otp' && (
          <button
            onClick={() => setAuthMode('otp')}
            className="w-full flex items-center justify-center gap-3 py-3 px-4 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all duration-300 transform hover:scale-[1.02]"
          >
            <Hash className="w-5 h-5 text-orange-500" />
            <span>OTP Login</span>
          </button>
        )}
        {authMode !== 'passkey' && (
          <button
            onClick={() => setAuthMode('passkey')}
            className="w-full flex items-center justify-center gap-3 py-3 px-4 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all duration-300 transform hover:scale-[1.02]"
          >
            <Fingerprint className="w-5 h-5 text-blue-500" />
            <span>Passkeys</span>
          </button>
        )}
      </div>

      <p className="text-center text-sm text-slate-600 dark:text-slate-400 font-medium">
        Don't have an account?{' '}
        <a
          href="#"
          onClick={(e) => { e.preventDefault(); onSwitchToRegister(); }}
          className="font-bold text-primary hover:underline hover:text-primary-light transition-colors"
        >
          Sign Up
        </a>
      </p>
    </AuthLayout>
  );
};

export default LoginScreen;
