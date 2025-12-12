import React, { useState, useEffect } from 'react';
import { Mail, Lock, Unlock, Grid, Loader2, X, CheckCircle, AlertCircle, ArrowRight } from 'lucide-react';
import AuthLayout from './AuthLayout';

interface ToastProps {
  type: 'success' | 'error';
  message: string;
  onClose: () => void;
}

const Toast: React.FC<ToastProps> = ({ type, message, onClose }) => (
  <div className={`fixed top-4 left-1/2 transform -translate-x-1/2 z-[2147483647] flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl transition-all duration-300 animate-in slide-in-from-top-4 fade-in ${type === 'success'
    ? 'bg-white dark:bg-slate-800 border-l-4 border-green-500'
    : 'bg-white dark:bg-slate-800 border-l-4 border-red-500'
    }`}>
    {type === 'success' ? (
      <CheckCircle className="w-5 h-5 text-green-500" />
    ) : (
      <AlertCircle className="w-5 h-5 text-red-500" />
    )}
    <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{message}</p>
    <button onClick={onClose} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors">
      <X className="w-4 h-4 text-slate-400" />
    </button>
  </div>
);

interface LoginScreenProps {
  onSwitchToRegister: () => void;
}

const LoginScreen: React.FC<LoginScreenProps> = ({ onSwitchToRegister }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<{ email?: string, password?: string }>({});
  const [toast, setToast] = useState<{ type: 'success' | 'error', message: string } | null>(null);

  // Forgot Password State
  const [showForgotPass, setShowForgotPass] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetEmailError, setResetEmailError] = useState('');
  const [resetStatus, setResetStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  // Lock body scroll when modal is open
  useEffect(() => {
    if (showForgotPass) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [showForgotPass]);

  const validateEmail = (value: string) => {
    if (!value) return 'Email is required';
    if (!/\S+@\S+\.\S+/.test(value)) return 'Please enter a valid email address';
    return undefined;
  };

  const validatePassword = (value: string) => {
    if (!value) return 'Password is required';
    if (value.length < 6) return 'Password must be at least 6 characters';
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
    if (errors.password) {
      setErrors(prev => ({ ...prev, password: validatePassword(val) }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    const emailError = validateEmail(email);
    const passwordError = validatePassword(password);

    if (emailError || passwordError) {
      setErrors({
        email: emailError,
        password: passwordError
      });
      return;
    }

    setIsLoading(true);
    setErrors({});

    // Simulate network request
    await new Promise(resolve => setTimeout(resolve, 2000));

    setIsLoading(false);

    // Simulated result (Error if email is 'error@example.com')
    const isSuccess = email !== 'error@example.com';

    if (isSuccess) {
      setToast({ type: 'success', message: 'Successfully logged in!' });
    } else {
      setToast({ type: 'error', message: 'Invalid credentials. Please try again.' });
    }
  };

  // Forgot Password Handlers
  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!resetEmail) {
      setResetEmailError('Please enter your email address');
      return;
    }

    if (!/\S+@\S+\.\S+/.test(resetEmail)) {
      setResetEmailError('Please enter a valid email address');
      return;
    }

    setResetStatus('loading');

    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Simulate error if email contains 'error'
    if (resetEmail.toLowerCase().includes('error')) {
      setResetStatus('error');
    } else {
      setResetStatus('success');
    }
  };

  const closeForgotPass = () => {
    setShowForgotPass(false);
    setResetStatus('idle');
    setResetEmail('');
    setResetEmailError('');
  };

  // Define the right section visual content
  const RightSectionContent = (
    <>
      {/* Hero Visual Area */}
      <div className="relative w-full h-[400px] mb-8 flex items-center justify-center perspective-[1000px]">

        {/* Main Glass Card */}
        <div className="absolute w-80 h-96 glassmorphism rounded-[2rem] border-t border-l border-white/20 shadow-2xl flex flex-col items-center justify-between py-10 z-20 animate-float overflow-hidden group hover:scale-105 transition-transform duration-500">
          {/* Shine Effect */}
          <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none"></div>

          {/* Card Header */}
          <div className="w-full px-8 flex justify-between items-center">
            <div className="flex gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-red-400"></div>
              <div className="w-1.5 h-1.5 rounded-full bg-yellow-400"></div>
              <div className="w-1.5 h-1.5 rounded-full bg-green-400"></div>
            </div>
            <span className="text-[10px] font-bold tracking-widest text-gray-400 uppercase">Secure_Shell</span>
          </div>

          {/* Main Icon */}
          <div className="relative flex items-center justify-center">
            <div className="absolute inset-0 bg-violet-500 blur-3xl opacity-20 rounded-full"></div>
            <div className="w-24 h-24 flex items-center justify-center text-white/90 drop-shadow-[0_0_15px_rgba(124,58,237,0.5)] z-10">
              <svg
                width="96"
                height="96"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                <path d="m9 12 2 2 4-4" />
              </svg>
            </div>
          </div>

          {/* Status Badge & Text */}
          <div className="text-center space-y-2 relative z-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-green-500/10 border border-green-500/20 backdrop-blur-md">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
              <span className="text-xs font-bold text-green-400 tracking-wide">ENCRYPTED</span>
            </div>
            <p className="text-xs text-gray-400 font-mono mt-2">256-BIT SSL PROTECTION</p>
          </div>
        </div>

        {/* Background Decorative Card */}
        <div className="absolute w-72 h-80 glassmorphism-light rounded-3xl -rotate-6 z-10 translate-x-[-40px] translate-y-[20px] flex items-center justify-center">
          <div className="w-full p-6 space-y-3 opacity-30">
            <div className="h-2 bg-white/50 rounded-full w-3/4"></div>
            <div className="h-2 bg-white/30 rounded-full w-1/2"></div>
            <div className="h-2 bg-white/30 rounded-full w-5/6"></div>
          </div>
        </div>

        {/* Floating Icons */}
        <div className="absolute top-10 right-10 w-8 h-8 text-cyan-300 animate-bounce opacity-80" style={{ animationDuration: '3s' }}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="7.5" cy="15.5" r="5.5" />
            <path d="m21 2-9.6 9.6" />
            <path d="m15.5 7.5 3 3L22 7l-3-3" />
          </svg>
        </div>
        <div className="absolute bottom-20 left-4 w-8 h-8 text-purple-400 animate-pulse opacity-60">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 10a2 2 0 0 0-2 2c0 1.02-.1 2.51-.26 4" />
            <path d="M9 22a.9.9 0 0 1-.39-.18c-.25-.2-2.59-1.84-2.59-5.36 0-1.22.3-2.25.88-3.04.6-.82 1.35-1.08 1.9-.96.26.06.49.22.66.45.19.26.24.6.24.96" />
            <path d="M14 10a2 2 0 0 1 2 2c0 1.02.1 2.51.26 4" />
            <path d="M15 22a.9.9 0 0 0 .39-.18c.25-.2 2.59-1.84 2.59-5.36 0-1.22-.3-2.25-.88-3.04-.6-.82-1.35-1.08-1.9-.96-.26.06-.49.22-.66.45-.19.26-.24.6-.24.96" />
            <path d="M12 2v8" />
          </svg>
        </div>
      </div>

      {/* Text Content */}
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

  return (
    <AuthLayout rightSection={RightSectionContent}>
      {toast && (
        <Toast
          type={toast.type}
          message={toast.message}
          onClose={() => setToast(null)}
        />
      )}

      {/* Logo */}
      <div className="flex items-center gap-3 mb-10">
        <div className="bg-slate-900 dark:bg-slate-800 p-2.5 rounded-xl shadow-lg shadow-slate-200 dark:shadow-none">
          <Grid className="w-6 h-6 text-white" />
        </div>
        <span className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">FramerGen</span>
      </div>

      {/* Header */}
      <h1 className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white mb-2 tracking-tighter">
        Welcome Back
      </h1>
      <p className="text-slate-500 dark:text-slate-400 mb-8 font-medium">
        Securely login to manage your account.
      </p>

      {/* Form */}
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

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-semibold text-slate-600 dark:text-slate-300" htmlFor="password">
              Password
            </label>
            <button
              type="button"
              onClick={() => setShowForgotPass(true)}
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
          {errors.password && (
            <p className="mt-1.5 text-xs font-semibold text-red-500 flex items-center gap-1 animate-pulse">
              <AlertCircle className="w-3 h-3" />
              {errors.password}
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full flex justify-center items-center py-3.5 px-4 border border-transparent rounded-xl text-base font-bold text-white bg-slate-900 dark:bg-primary dark:hover:bg-primary-light hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-slate-900 focus:ring-slate-900 transition-all duration-300 transform hover:scale-[1.02] disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none !mt-8"
        >
          {isLoading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            "Log In"
          )}
        </button>
      </form>

      {/* Divider */}
      <div className="relative flex items-center my-8">
        <div className="flex-grow border-t border-slate-200 dark:border-slate-700"></div>
        <span className="flex-shrink mx-4 text-xs font-bold text-slate-400 uppercase tracking-widest">
          Or continue with
        </span>
        <div className="flex-grow border-t border-slate-200 dark:border-slate-700"></div>
      </div>

      {/* Social Buttons */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <button className="w-full flex items-center justify-center gap-3 py-3 px-4 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-slate-900 focus:ring-primary transition-all duration-300 transform hover:scale-[1.02]">
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
          </svg>
          <span>Google</span>
        </button>
        <button className="w-full flex items-center justify-center gap-3 py-3 px-4 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-slate-900 focus:ring-primary transition-all duration-300 transform hover:scale-[1.02]">
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 0C5.373 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.034c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.085 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.108-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.91 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"></path>
          </svg>
          <span>GitHub</span>
        </button>
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

      {/* Forgot Password Modal */}
      {showForgotPass && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md p-6 rounded-2xl shadow-2xl border border-slate-100 dark:border-slate-800 relative animate-in zoom-in-95 duration-200 z-[10000]">
            <button
              onClick={closeForgotPass}
              className="absolute top-4 right-4 p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            {resetStatus === 'success' ? (
              <div className="text-center py-6">
                <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 text-green-500 rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce">
                  <CheckCircle className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Check your email</h3>
                <p className="text-slate-500 dark:text-slate-400 mb-8 px-4">
                  We've sent a password reset link to <br />
                  <span className="font-semibold text-slate-700 dark:text-slate-200">{resetEmail}</span>
                </p>
                <button
                  onClick={closeForgotPass}
                  className="w-full py-3 rounded-xl bg-slate-900 dark:bg-primary text-white font-bold hover:bg-slate-800 dark:hover:bg-primary-light transition-colors"
                >
                  Back to Login
                </button>
              </div>
            ) : resetStatus === 'error' ? (
              <div className="text-center py-6">
                <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                  <AlertCircle className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Request Failed</h3>
                <p className="text-slate-500 dark:text-slate-400 mb-8 px-4">
                  We ran into an issue processing your request for <br />
                  <span className="font-semibold text-slate-700 dark:text-slate-200">{resetEmail}</span>
                </p>
                <button
                  onClick={() => setResetStatus('idle')}
                  className="w-full py-3 rounded-xl bg-slate-900 dark:bg-primary text-white font-bold hover:bg-slate-800 dark:hover:bg-primary-light transition-colors"
                >
                  Try Again
                </button>
              </div>
            ) : (
              <>
                <div className="mb-6">
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Reset Password</h3>
                  <p className="text-slate-500 dark:text-slate-400 text-sm">
                    Enter your email address and we'll send you instructions to reset your password.
                  </p>
                </div>

                <form onSubmit={handleForgotPasswordSubmit} noValidate>
                  <div className="mb-6">
                    <label className="block text-sm font-semibold text-slate-600 dark:text-slate-300 mb-2">Email Address</label>
                    <div className="relative group">
                      <Mail className={`absolute left-3.5 top-3.5 w-5 h-5 transition-colors ${resetEmailError ? 'text-red-500' : 'text-slate-400 group-focus-within:text-slate-900 dark:group-focus-within:text-primary'}`} />
                      <input
                        type="email"
                        value={resetEmail}
                        onChange={(e) => {
                          setResetEmail(e.target.value);
                          if (resetEmailError) setResetEmailError('');
                        }}
                        className={`w-full bg-slate-50 dark:bg-slate-800 border rounded-xl py-3.5 pl-11 pr-4 text-slate-900 dark:text-white transition-all outline-none ${resetEmailError
                          ? 'border-red-500 focus:border-red-500 focus:ring-1 focus:ring-red-500'
                          : 'border-slate-200 dark:border-slate-700 focus:border-slate-400 focus:ring-1 focus:ring-slate-400 dark:focus:border-primary-light dark:focus:ring-primary-light'
                          }`}
                        placeholder="you@example.com"
                        autoFocus
                      />
                    </div>
                    {resetEmailError && (
                      <p className="mt-2 text-xs font-semibold text-red-500 flex items-center gap-1 animate-pulse">
                        <AlertCircle className="w-3 h-3" />
                        {resetEmailError}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={closeForgotPass}
                      className="flex-1 py-3 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={resetStatus === 'loading'}
                      className="flex-1 py-3 rounded-xl bg-slate-900 dark:bg-primary text-white font-bold hover:bg-slate-800 dark:hover:bg-primary-light transition-colors flex items-center justify-center gap-2"
                    >
                      {resetStatus === 'loading' ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <>
                          Send Link <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </AuthLayout>
  );
};

export default LoginScreen;