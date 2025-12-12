import React, { useState, useEffect } from 'react';
import { Loader2, X, CheckCircle, AlertCircle, Rocket, Check } from 'lucide-react';
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

interface RegisterScreenProps {
  onSwitchToLogin: () => void;
}

const RegisterScreen: React.FC<RegisterScreenProps> = ({ onSwitchToLogin }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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

  const requirements = [
    { id: 1, label: "At least 6 characters", met: password.length >= 6 },
    { id: 2, label: "Contains a number", met: /[0-9]/.test(password) },
    { id: 3, label: "Contains uppercase letter", met: /[A-Z]/.test(password) },
  ];

  const allRequirementsMet = requirements.every(req => req.met);

  const validateName = (value: string) => {
    if (!value) return 'Full Name is required';
    if (value.length < 2) return 'Name must be at least 2 characters';
    return undefined;
  };

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
    if (errors.password) {
      setErrors(prev => ({ ...prev, password: validatePassword(val) }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    const nameError = validateName(name);
    const emailError = validateEmail(email);
    const passwordError = validatePassword(password);

    if (nameError || emailError || passwordError) {
      setErrors({
        name: nameError,
        email: emailError,
        password: passwordError
      });
      return;
    }

    setIsLoading(true);
    setErrors({});

    try {
      // Simulate network request
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Demonstration of error toast: use 'error' in email to trigger
      if (email.toLowerCase().includes('error')) {
        throw new Error('This email is restricted.');
      }

      setToast({ type: 'success', message: 'Account created successfully!' });

      // Redirect to login after success
      setTimeout(() => {
        onSwitchToLogin();
      }, 1500);

    } catch (err) {
      setToast({ type: 'error', message: 'Registration failed. Please try again.' });
    } finally {
      setIsLoading(false);
    }
  };

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
            <span className="text-[10px] font-bold tracking-widest text-gray-400 uppercase">Secure_Register</span>
          </div>

          {/* Main Icon */}
          <div className="relative flex items-center justify-center">
            <div className="absolute inset-0 bg-pink-500 blur-3xl opacity-20 rounded-full"></div>
            <div className="w-24 h-24 flex items-center justify-center text-white/90 drop-shadow-[0_0_15px_rgba(236,72,153,0.5)] z-10">
              <Rocket className="w-24 h-24" strokeWidth={1.5} />
            </div>
          </div>

          {/* Status Badge & Text */}
          <div className="text-center space-y-2 relative z-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 backdrop-blur-md">
              <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
              <span className="text-xs font-bold text-blue-400 tracking-wide">GET STARTED</span>
            </div>
            <p className="text-xs text-gray-400 font-mono mt-2">FREE ACCOUNT ACCESS</p>
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
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
          </svg>
        </div>
        <div className="absolute bottom-20 left-4 w-8 h-8 text-purple-400 animate-pulse opacity-60">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2v20" />
            <path d="M2 12h20" />
            <path d="m4.93 4.93 14.14 14.14" />
            <path d="m19.07 4.93-14.14 14.14" />
          </svg>
        </div>
      </div>

      {/* Text Content */}
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

      {/* Header */}
      <div className="text-center mb-6">
        <h1 className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white mb-2 tracking-tighter">
          Create an Account
        </h1>
        <p className="text-slate-500 dark:text-slate-400 font-medium text-sm">
          Let's get you started. It only takes a minute!
        </p>
      </div>

      {/* Social Buttons */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <button className="flex items-center justify-center gap-3 py-3 px-4 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-200 dark:focus:ring-slate-700 transition-all duration-300">
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
          </svg>
          <span>Google</span>
        </button>
        <button className="flex items-center justify-center gap-3 py-3 px-4 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-200 dark:focus:ring-slate-700 transition-all duration-300">
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 0C5.373 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.034c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.085 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.108-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.91 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"></path>
          </svg>
          <span>Github</span>
        </button>
      </div>

      {/* Form */}
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
          {errors.name && (
            <p className="mt-2 text-xs font-semibold text-red-500 flex items-center gap-1 animate-in fade-in slide-in-from-top-1 duration-200">
              <AlertCircle className="w-3 h-3" />
              {errors.name}
            </p>
          )}
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
          {errors.email && (
            <p className="mt-2 text-xs font-semibold text-red-500 flex items-center gap-1 animate-in fade-in slide-in-from-top-1 duration-200">
              <AlertCircle className="w-3 h-3" />
              {errors.email}
            </p>
          )}
        </div>

        <div className="mb-5">
          <label className="block text-sm font-semibold text-slate-600 dark:text-slate-300 mb-2" htmlFor="password">
            Password
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={handlePasswordChange}
            placeholder="••••••••••••"
            className={`w-full border rounded-lg py-3 px-4 text-slate-900 dark:text-white placeholder-slate-400 bg-white dark:bg-slate-800 focus:outline-none transition-all duration-300 ${errors.password
                ? 'border-red-500 bg-red-50 dark:bg-red-900/10'
                : 'border-slate-200 dark:border-slate-700 focus:border-slate-400 focus:ring-1 focus:ring-slate-400 dark:focus:border-primary-light dark:focus:ring-primary-light'
              }`}
            required
          />
          {errors.password && (
            <p className="mt-2 text-xs font-semibold text-red-500 flex items-center gap-1 animate-in fade-in slide-in-from-top-1 duration-200">
              <AlertCircle className="w-3 h-3" />
              {errors.password}
            </p>
          )}

          {/* Password Strength Indicator - Hidden when all requirements met */}
          {password.length > 0 && !allRequirementsMet && (
            <div className="mt-4 space-y-3 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-700/50 animate-in fade-in zoom-in-95 duration-200">
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Strength</span>
                <span className={`text-xs font-bold transition-colors duration-300 ${passwordStrength === 0 ? 'text-slate-400' :
                    passwordStrength < 3 ? 'text-yellow-500' : 'text-green-500'
                  }`}>
                  {passwordStrength === 0 ? 'Too weak' :
                    passwordStrength < 3 ? 'Weak' :
                      passwordStrength === 3 ? 'Good' : 'Strong'}
                </span>
              </div>

              <div className="flex gap-2 h-1.5 mb-4">
                {[1, 2, 3, 4].map((level) => (
                  <div
                    key={level}
                    className={`flex-1 rounded-full transition-all duration-500 ${passwordStrength >= level
                        ? 'bg-gradient-to-r from-green-400 to-green-500 shadow-sm shadow-green-200 dark:shadow-none'
                        : 'bg-slate-200 dark:bg-slate-700'
                      }`}
                  ></div>
                ))}
              </div>

              <div className="grid grid-cols-1 gap-2">
                {requirements.map((req) => (
                  <div key={req.id} className="flex items-center gap-3">
                    <div className={`flex items-center justify-center w-5 h-5 rounded-full border transition-all duration-300 ${req.met
                        ? 'bg-green-500 border-green-500 text-white'
                        : 'bg-transparent border-slate-300 dark:border-slate-600 text-transparent'
                      }`}>
                      <Check className="w-3 h-3" strokeWidth={3} />
                    </div>
                    <span className={`text-xs transition-colors duration-300 ${req.met
                        ? 'text-slate-700 dark:text-slate-200 font-semibold'
                        : 'text-slate-500 dark:text-slate-500'
                      }`}>
                      {req.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full flex justify-center items-center py-3.5 px-4 border border-transparent rounded-lg text-sm font-bold text-white bg-slate-900 dark:bg-primary hover:bg-slate-800 dark:hover:bg-primary-light focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-900 dark:focus:ring-offset-slate-900 transition-all duration-300 transform hover:scale-[1.02] disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none"
        >
          {isLoading && (
            <Loader2 className="w-5 h-5 animate-spin mr-2" />
          )}
          Create Account
        </button>
      </form>

      {/* Terms */}
      <p className="text-center text-xs text-slate-500 dark:text-slate-400 mt-6 leading-relaxed">
        By creating an account, you agree to our<br />
        <a href="#" className="text-primary hover:underline">Terms of Service</a> and <a href="#" className="text-primary hover:underline">Privacy Policy</a>.
      </p>

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
    </AuthLayout>
  );
};

export default RegisterScreen;