
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Lock, Unlock, User, Check, AlertCircle, Loader2 } from 'lucide-react';
import AuthLayout from '../../layouts/AuthLayout';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../auth/AuthProvider';
import { authService } from '@/services/auth.services';

const RegisterScreen: React.FC = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { setAuth } = useAuth();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<{ name?: string, email?: string, password?: string }>({});
  const [passwordStrength, setPasswordStrength] = useState(0);

  useEffect(() => {
    let strength = 0;
    if (password.length >= 6) strength++;
    if (password.length >= 10) strength++;
    if (/[A-Z]/.test(password)) strength++;
    if (/[0-9]/.test(password)) strength++;
    setPasswordStrength(strength);
  }, [password]);

  const requirements = [
    { id: 1, label: "At least 6 characters", met: password.length >= 6 },
    { id: 2, label: "Contains a number", met: /[0-9]/.test(password) },
    { id: 3, label: "Contains uppercase letter", met: /[A-Z]/.test(password) },
  ];

  const allRequirementsMet = requirements.every(req => req.met);

  const validate = () => {
    const newErrors: any = {};
    if (!name.trim()) newErrors.name = 'Full name is required';
    if (!email) newErrors.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(email)) newErrors.email = 'Please enter a valid email';
    if (!password) newErrors.password = 'Password is required';
    else if (password.length < 6) newErrors.password = 'Password must be at least 6 characters';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setIsLoading(true);

    try {
      const response = await authService.register({ name, email, password });
      if (response.ok) {
        showToast('success', 'Account created successfully!');

        navigate('/verify', { state: { target: '/dashboard', mode: 'email', email, role: 'user' } });

        localStorage.setItem('userName', name);
      } else {
        showToast('error', response.data?.message || 'Registration failed.');
      }
    } catch (error: any) {
      showToast('error', error.response?.data?.message || 'Registration failed. Please try again.');
    } finally {
      setIsLoading(false);
    };
  };

  const handleGoogleSignup = async () => {
    setIsLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1500));
      localStorage.setItem('userName', 'New Zely User');
      const mockAccessToken = 'mock_access_' + Date.now();
      // setAccessToken(mockAccessToken);
      // setRefreshToken('mock_refresh_' + Date.now());
      localStorage.setItem('userRole', 'user');
      setAuth({ accessToken: mockAccessToken, user: { role: 'user', email: "newzelyuser@gmail.com" } });
      showToast('success', 'Account created with Google!');
      navigate('/onboarding/provisioning');
    } catch (error) {
      showToast('error', 'Google sign-up failed');
    } finally {
      setIsLoading(false);
    }
  };

  const RightSectionContent = (
    <>
      <div className="relative w-full h-[400px] mb-8 flex items-center justify-center perspective-[1000px]">
        <div className="absolute w-80 h-96 glassmorphism rounded-[2rem] border-t border-l border-white/20 shadow-2xl flex flex-col items-center justify-between py-10 z-20 animate-float overflow-hidden group">
          <div className="w-full px-8 flex justify-between items-center">
            <div className="flex gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-red-400"></div>
              <div className="w-1.5 h-1.5 rounded-full bg-yellow-400"></div>
              <div className="w-1.5 h-1.5 rounded-full bg-green-400"></div>
            </div>
            <span className="text-[10px] font-bold tracking-widest text-gray-400 uppercase">New_Account</span>
          </div>
          <div className="relative flex items-center justify-center">
            <div className="absolute inset-0 bg-blue-500 blur-3xl opacity-20 rounded-full"></div>
            <div className="w-24 h-24 flex items-center justify-center text-white/90 z-10">
              <User className="w-20 h-20" strokeWidth={1.5} />
            </div>
          </div>
          <div className="text-center space-y-2 relative z-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 backdrop-blur-md">
              <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
              <span className="text-xs font-bold text-blue-400 tracking-wide uppercase">Join The Future</span>
            </div>
          </div>
        </div>
      </div>
      <div className="space-y-4 text-center sm:text-left">
        <h2 className="text-4xl sm:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white via-gray-200 to-gray-400 tracking-tighter leading-tight">
          Join Our Community.
        </h2>
        <p className="text-lg text-gray-400 font-medium max-w-md leading-relaxed">
          Start your journey with us today. Get a verified ledger-backed account in minutes.
        </p>
      </div>
    </>
  );

  return (
    <AuthLayout rightSection={RightSectionContent}>
      <h1 className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white mb-2 tracking-tighter">
        Create Account
      </h1>
      <p className="text-slate-500 dark:text-slate-400 mb-8 font-medium">
        Enter your details to register.
      </p>

      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        <div>
          <label className="block text-sm font-semibold text-slate-600 dark:text-slate-300 mb-2" htmlFor="name">
            Full Name
          </label>
          <div className="relative group">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
              <User className={`w-5 h-5 transition-colors duration-300 ${errors.name ? 'text-red-400' : 'text-slate-400 group-focus-within:text-primary'}`} />
            </div>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => { setName(e.target.value); if (errors.name) setErrors({ ...errors, name: undefined }); }}
              placeholder="John Doe"
              className={`w-full bg-slate-50 dark:bg-slate-800 border rounded-xl py-3.5 pl-11 pr-4 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none transition-all duration-300 ${errors.name ? 'border-red-500 focus:ring-red-500/10' : 'border-slate-200 dark:border-slate-700 focus:border-primary focus:ring-1 focus:ring-primary'}`}
              required
            />
          </div>
          {errors.name && <p className="mt-1.5 text-xs font-semibold text-red-500 flex items-center gap-1 animate-pulse"><AlertCircle className="w-3 h-3" />{errors.name}</p>}
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-600 dark:text-slate-300 mb-2" htmlFor="email">
            Email Address
          </label>
          <div className="relative group">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
              <Mail className={`w-5 h-5 transition-colors duration-300 ${errors.email ? 'text-red-400' : 'text-slate-400 group-focus-within:text-primary'}`} />
            </div>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); if (errors.email) setErrors({ ...errors, email: undefined }); }}
              placeholder="you@example.com"
              className={`w-full bg-slate-50 dark:bg-slate-800 border rounded-xl py-3.5 pl-11 pr-4 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none transition-all duration-300 ${errors.email ? 'border-red-500 focus:ring-red-500/10' : 'border-slate-200 dark:border-slate-700 focus:border-primary focus:ring-1 focus:ring-primary'}`}
              required
            />
          </div>
          {errors.email && <p className="mt-1.5 text-xs font-semibold text-red-500 flex items-center gap-1 animate-pulse"><AlertCircle className="w-3 h-3" />{errors.email}</p>}
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-600 dark:text-slate-300 mb-2" htmlFor="password">
            Password
          </label>
          <div className="relative group">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
              <Lock className={`w-5 h-5 transition-colors duration-300 ${errors.password ? 'text-red-400' : 'text-slate-400 group-focus-within:text-primary'}`} />
            </div>
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              className={`w-full bg-slate-50 dark:bg-slate-800 border rounded-xl py-3.5 pl-11 pr-12 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none transition-all duration-300 ${errors.password ? 'border-red-500 focus:ring-red-500/10' : 'border-slate-200 dark:border-slate-700 focus:border-primary focus:ring-1 focus:ring-primary'}`}
              required
            />
            <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 transition-colors">
              {showPassword ? <Unlock className="w-5 h-5" /> : <Lock className="w-5 h-5" />}
            </button>
          </div>
          {password.length > 0 && !allRequirementsMet && (
            <div className="mt-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-700 animate-in fade-in zoom-in-95 duration-200">
              <div className="flex gap-1 h-1 mb-2">
                {[1, 2, 3, 4].map(level => (
                  <div key={level} className={`flex-1 rounded-full transition-all duration-500 ${passwordStrength >= level ? 'bg-green-500' : 'bg-slate-200 dark:bg-slate-700'}`} />
                ))}
              </div>
              <div className="space-y-1">
                {requirements.map(req => (
                  <div key={req.id} className="flex items-center gap-2">
                    <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${req.met ? 'bg-green-500 border-green-500 text-white' : 'border-slate-300 dark:border-slate-600'}`}>
                      {req.met && <Check className="w-2 h-2" strokeWidth={4} />}
                    </div>
                    <span className={`text-[10px] ${req.met ? 'text-slate-700 dark:text-slate-200 font-bold' : 'text-slate-400'}`}>{req.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full flex justify-center items-center py-3.5 px-4 border border-transparent rounded-xl text-base font-bold text-white bg-slate-900 dark:bg-primary hover:opacity-90 transition-all transform hover:scale-[1.01] active:scale-[0.99] disabled:opacity-70 !mt-8"
        >
          {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Create Account'}
        </button>
      </form>

      <div className="relative flex items-center my-8">
        <div className="flex-grow border-t border-slate-200 dark:border-slate-700"></div>
        <span className="flex-shrink mx-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Or register with</span>
        <div className="flex-grow border-t border-slate-200 dark:border-slate-700"></div>
      </div>

      <button
        onClick={handleGoogleSignup}
        disabled={isLoading}
        className="w-full flex items-center justify-center gap-3 py-3.5 px-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all shadow-sm mb-6"
      >
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
        </svg>
        <span>Google</span>
      </button>

      <p className="text-center text-sm text-slate-600 dark:text-slate-400 font-medium">
        Already have an account? <button onClick={() => navigate('/login')} className="font-bold text-primary hover:underline">Sign In</button>
      </p>
    </AuthLayout>
  );
};

export default RegisterScreen;