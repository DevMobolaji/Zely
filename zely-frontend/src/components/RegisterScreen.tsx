
import React, { useState, useEffect } from 'react';
import { Loader2, X, CheckCircle, AlertCircle, Rocket, Check, Mail, ArrowLeft, RefreshCw, Lock, Unlock, Wand2, Hash, Fingerprint } from 'lucide-react';
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

interface RegisterScreenProps {
  onSwitchToLogin: () => void;
  onLoginSuccess: () => void;
}

type RegisterMode = 'password' | 'magic' | 'otp' | 'passkey';

const RegisterScreen: React.FC<RegisterScreenProps> = ({ onSwitchToLogin, onLoginSuccess }) => {
  const [step, setStep] = useState<'register' | 'verify'>('register');
  const [registerMode, setRegisterMode] = useState<RegisterMode>('password');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(0);

  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<{ name?: string, email?: string, password?: string }>({});
  const [toast, setToast] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  const [passwordStrength, setPasswordStrength] = useState(0);

  useEffect(() => {
    if (password.length === 0) {
      setPasswordStrength(0);
      return;
    }
    let strength = 0;
    if (password.length > 5) strength += 1;
    if (password.length > 8) strength += 1;
    if (/[A-Z]/.test(password)) strength += 1;
    if (/[0-9]/.test(password)) strength += 1;
    setPasswordStrength(strength);
  }, [password]);

  // Countdown timer effect
  useEffect(() => {
    if (resendCountdown > 0) {
      const timer = setInterval(() => {
        setResendCountdown((prev) => prev - 1);
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [resendCountdown]);

  // Toast auto-dismiss effect
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => {
        setToast(null);
      }, 10000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const requirements = [
    { id: 1, label: "At least 6 characters", met: password.length >= 6 },
    { id: 2, label: "Contains a number", met: /[0-9]/.test(password) },
    { id: 3, label: "Contains uppercase letter", met: /[A-Z]/.test(password) },
  ];

  const allRequirementsMet = requirements.every(req => req.met);

  const validateEmail = (value: string) => {
    if (!value) return 'Email is required';
    if (!/\S+@\S+\.\S+/.test(value)) return 'Please enter a valid email address';
    return undefined;
  };

  const validateName = (value: string) => {
    if (!value) return 'Full Name is required';
    if (value.length < 2) return 'Name must be at least 2 characters';
    return undefined;
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setName(val);
    if (errors.name) {
      setErrors(prev => ({ ...prev, name: validateName(val) }));
    }
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

  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 6);
    setVerificationCode(val);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const nameError = validateName(name);
    const emailError = validateEmail(email);

    if (nameError || emailError || (registerMode === 'password' && password.length < 6)) {
      setErrors({
        name: nameError,
        email: emailError
      });
      return;
    }

    setIsLoading(true);
    setErrors({});

    try {
      if (registerMode === 'passkey') {
        await new Promise(resolve => setTimeout(resolve, 2000));
        setToast({ type: 'success', message: 'Passkey registered successfully! You can now use your biometric data to log in securely next time.' });
        setTimeout(() => onLoginSuccess(), 1000);
        return;
      }

      await new Promise(resolve => setTimeout(resolve, 1500));
      if (email.toLowerCase().includes('error')) {
        throw new Error('This email is restricted.');
      }
      setStep('verify');
      setResendCountdown(60);
      setToast({ type: 'success', message: `Verification code sent to ${email}! Please check your email and enter the 6-digit code provided.` });
    } catch (err) {
      setToast({ type: 'error', message: 'Registration failed. This might be due to a network error or an invalid email address. Please try again later.' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (verificationCode.length !== 6) {
      setToast({ type: 'error', message: 'Please enter a valid 6-digit code.' });
      return;
    }
    setIsLoading(true);
    await new Promise(resolve => setTimeout(resolve, 1500));
    if (verificationCode === "000000") {
      setToast({ type: 'error', message: 'Invalid verification code. Please check your inbox for the latest code we sent you.' });
      setIsLoading(false);
      return;
    }
    setToast({ type: 'success', message: 'Account verified successfully! Welcome to the Zely Fintech family.' });
    setTimeout(() => onLoginSuccess(), 1000);
  };

  const handleResendCode = () => {
    if (resendCountdown > 0) return;
    setToast({ type: 'success', message: 'A new verification code has been sent to your email address. It may take a minute to arrive.' });
    setResendCountdown(60);
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
            <span className="text-[10px] font-bold tracking-widest text-gray-400 uppercase">Secure_Register</span>
          </div>
          <div className="relative flex items-center justify-center">
            <div className="absolute inset-0 bg-pink-500 blur-3xl opacity-20 rounded-full"></div>
            <div className="w-24 h-24 flex items-center justify-center text-white/90 drop-shadow-[0_0_15px_rgba(236,72,153,0.5)] z-10">
              <Rocket className="w-24 h-24" strokeWidth={1.5} />
            </div>
          </div>
          <div className="text-center space-y-2 relative z-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 backdrop-blur-md">
              <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
              <span className="text-xs font-bold text-blue-400 tracking-wide">GET STARTED</span>
            </div>
            <p className="text-xs text-gray-400 font-mono mt-2">FREE ACCOUNT ACCESS</p>
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
          Start Your<br />Journey.
        </h2>
        <p className="text-lg text-gray-400 font-medium max-w-md leading-relaxed">
          Create an account to unlock exclusive features and join our community of creators.
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

      {step === 'register' ? (
        <>
          {registerMode !== 'password' && (
            <button
              onClick={() => setRegisterMode('password')}
              className="mb-4 flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-primary transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Use standard password signup
            </button>
          )}

          <div className="text-center mb-6">
            <h1 className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white mb-2 tracking-tighter">
              {registerMode === 'password' ? 'Create an Account' :
                registerMode === 'magic' ? 'Magic Signup' :
                  registerMode === 'otp' ? 'OTP Registration' : 'Passkey Signup'}
            </h1>
            <p className="text-slate-500 dark:text-slate-400 font-medium text-sm">
              {registerMode === 'password' ? "Let's get you started. It only takes a minute!" :
                "Secure, passwordless registration."}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-6">
            <button className="flex items-center justify-center gap-3 py-3 px-4 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all duration-300 transform hover:scale-[1.02]">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
              <span>Google</span>
            </button>
            {registerMode !== 'magic' && (
              <button
                onClick={() => setRegisterMode('magic')}
                className="flex items-center justify-center gap-3 py-3 px-4 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all duration-300 transform hover:scale-[1.02]"
              >
                <Wand2 className="w-5 h-5 text-indigo-500" />
                <span>Magic Link</span>
              </button>
            )}
            {registerMode !== 'otp' && (
              <button
                onClick={() => setRegisterMode('otp')}
                className="flex items-center justify-center gap-3 py-3 px-4 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all duration-300 transform hover:scale-[1.02]"
              >
                <Hash className="w-5 h-5 text-orange-500" />
                <span>OTP Only</span>
              </button>
            )}
            {registerMode !== 'passkey' && (
              <button
                onClick={() => setRegisterMode('passkey')}
                className="flex items-center justify-center gap-3 py-3 px-4 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all duration-300 transform hover:scale-[1.02]"
              >
                <Fingerprint className="w-5 h-5 text-blue-500" />
                <span>Passkeys</span>
              </button>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            <div className="mb-5">
              <label className="block text-sm font-semibold text-slate-600 dark:text-slate-300 mb-2" htmlFor="name">
                Full Name
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={handleNameChange}
                placeholder="John Doe"
                className={`w-full border rounded-lg py-3 px-4 text-slate-900 dark:text-white placeholder-slate-400 bg-white dark:bg-slate-800 focus:outline-none transition-all duration-300 ${errors.name
                  ? 'border-red-500 bg-red-50 dark:bg-red-900/10'
                  : 'border-slate-200 dark:border-slate-700 focus:border-slate-400 focus:ring-1 focus:ring-slate-400 dark:focus:border-primary-light dark:focus:ring-primary-light'
                  }`}
                required
              />
            </div>

            <div className="mb-5">
              <label className="block text-sm font-semibold text-slate-600 dark:text-slate-300 mb-2" htmlFor="email">
                Email Address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={handleEmailChange}
                placeholder="you@example.com"
                className={`w-full border rounded-lg py-3 px-4 text-slate-900 dark:text-white placeholder-slate-400 bg-white dark:bg-slate-800 focus:outline-none transition-all duration-300 ${errors.email
                  ? 'border-red-500 bg-red-50 dark:bg-red-900/10'
                  : 'border-slate-200 dark:border-slate-700 focus:border-slate-400 focus:ring-1 focus:ring-slate-400 dark:focus:border-primary-light dark:focus:ring-primary-light'
                  }`}
                required
              />
            </div>

            {registerMode === 'password' && (
              <div className="mb-5 animate-in fade-in slide-in-from-top-2 duration-300">
                <label className="block text-sm font-semibold text-slate-600 dark:text-slate-300 mb-2" htmlFor="password">
                  Password
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={handlePasswordChange}
                    placeholder="••••••••••••"
                    className={`w-full border rounded-lg py-3 pl-4 pr-12 text-slate-900 dark:text-white placeholder-slate-400 bg-white dark:bg-slate-800 focus:outline-none transition-all duration-300 ${errors.password
                      ? 'border-red-500 bg-red-50 dark:bg-red-900/10'
                      : 'border-slate-200 dark:border-slate-700 focus:border-slate-400 focus:ring-1 focus:ring-slate-400 dark:focus:border-primary-light dark:focus:ring-primary-light'
                      }`}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 focus:outline-none transition-colors"
                  >
                    {showPassword ? <Unlock className="w-5 h-5" /> : <Lock className="w-5 h-5" />}
                  </button>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex justify-center items-center py-3.5 px-4 border border-transparent rounded-lg text-sm font-bold text-white bg-slate-900 dark:bg-primary hover:bg-slate-800 dark:hover:bg-primary-light focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-900 transition-all duration-300 transform hover:scale-[1.02] disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isLoading && <Loader2 className="w-5 h-5 animate-spin mr-2" />}
              {registerMode === 'password' ? 'Create Account' :
                registerMode === 'magic' ? 'Get Magic Link' :
                  registerMode === 'otp' ? 'Send OTP' : 'Continue with Passkey'}
            </button>
          </form>

          <p className="text-center text-sm text-slate-600 dark:text-slate-400 font-medium mt-6">
            Already have an account?{' '}
            <a
              href="#"
              onClick={(e) => { e.preventDefault(); onSwitchToLogin(); }}
              className="font-bold text-primary hover:underline hover:text-primary-light transition-colors"
            >
              Log In
            </a>
          </p>
        </>
      ) : (
        <div className="flex flex-col items-center animate-in fade-in slide-in-from-right-4 duration-300">
          <button
            onClick={() => setStep('register')}
            className="self-start mb-6 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white flex items-center gap-2 text-sm font-semibold transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Signup
          </button>

          <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 text-blue-500 rounded-full flex items-center justify-center mb-6 animate-bounce">
            <Mail className="w-8 h-8" />
          </div>

          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white mb-2 text-center tracking-tight">
            Verify Email
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-center mb-10 max-w-xs mx-auto text-sm font-medium leading-relaxed">
            We've sent a 6-digit confirmation code to <br />
            <span className="text-slate-900 dark:text-white font-bold">{email || "your email"}</span>
          </p>

          <form onSubmit={handleVerifySubmit} className="w-full space-y-8 flex flex-col items-center">
            <input
              type="text"
              maxLength={6}
              value={verificationCode}
              onChange={handleCodeChange}
              className="w-full max-w-[200px] text-center text-lg font-mono font-bold tracking-[0.4em] py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:border-primary transition-all text-slate-900 dark:text-white"
              placeholder="000000"
              autoFocus
            />

            <button
              type="submit"
              disabled={isLoading || verificationCode.length !== 6}
              className="w-full flex justify-center items-center py-3.5 px-4 bg-slate-900 dark:bg-primary text-white font-bold rounded-lg transition-all transform hover:scale-[1.02] disabled:opacity-50"
            >
              {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Verify Account"}
            </button>
          </form>

          <div className="mt-8 text-center">
            <button
              onClick={handleResendCode}
              disabled={resendCountdown > 0}
              className={`text-sm font-bold flex items-center gap-2 mx-auto transition-colors ${resendCountdown > 0 ? 'text-slate-400' : 'text-primary hover:text-primary-light'}`}
            >
              <RefreshCw className="w-3 h-3" />
              {resendCountdown > 0 ? `Resend code in ${resendCountdown}s` : 'Resend Code'}
            </button>
          </div>
        </div>
      )}
    </AuthLayout>
  );
};

export default RegisterScreen;
