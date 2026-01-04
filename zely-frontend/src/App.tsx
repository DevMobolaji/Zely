
import React, { useState, useEffect } from 'react';
import { X, CheckCircle, AlertCircle } from 'lucide-react';
import LoginScreen from './components/LoginScreen.tsx';
import RegisterScreen from './components/RegisterScreen.tsx';
import DashboardScreen from './components/DashboardScreen.tsx';
import AdminDashboardScreen from './components/AdminDashboardScreen.tsx';
import TwoFactorScreen from './components/TwoFactorScreen.tsx';
import ResetPasswordScreen from './components/ResetPasswordScreen.tsx';

type ScreenState = 'login' | 'register' | 'twoFactor' | 'dashboard' | 'admin' | 'resetPassword';

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

const App: React.FC = () => {
  const [currentScreen, setCurrentScreen] = useState<ScreenState>('login');
  const [intendedDestination, setIntendedDestination] = useState<'dashboard' | 'admin'>('dashboard');
  const [toast, setToast] = useState<{ type: 'success' | 'error', message: string } | null>(null);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const handleLoginSuccess = () => {
    setToast({ type: 'success', message: 'Successfully logged in!' });
    setIntendedDestination('dashboard');
    setCurrentScreen('twoFactor');
  };

  const handleAdminLogin = () => {
    setToast({ type: 'success', message: 'Welcome to Admin Dashboard' });
    setIntendedDestination('admin');
    setCurrentScreen('twoFactor');
  };

  const handle2FAVerified = () => {
    setToast({ type: 'success', message: 'Security check passed!' });
    setCurrentScreen(intendedDestination);
  };

  const handleLogout = () => {
    setToast({ type: 'success', message: 'Logged out successfully' });
    setCurrentScreen('login');
  };

  return (
    <div className="min-h-screen h-screen w-full bg-white dark:bg-black text-gray-900 dark:text-gray-100 overflow-hidden relative">
      {toast && (
        <Toast
          type={toast.type}
          message={toast.message}
          onClose={() => setToast(null)}
        />
      )}

      <div
        key={currentScreen}
        className="absolute inset-0 w-full h-full animate-enter-fade"
      >
        {currentScreen === 'login' ? (
          <LoginScreen
            onSwitchToRegister={() => setCurrentScreen('register')}
            onForgotPassword={() => setCurrentScreen('resetPassword')}
            onLoginSuccess={handleLoginSuccess}
            onAdminLogin={handleAdminLogin}
          />
        ) : currentScreen === 'register' ? (
          <RegisterScreen
            onSwitchToLogin={() => setCurrentScreen('login')}
            onLoginSuccess={() => {
              setToast({ type: 'success', message: 'Account created successfully!' });
              setIntendedDestination('dashboard');
              setCurrentScreen('dashboard');
            }}
          />
        ) : currentScreen === 'resetPassword' ? (
          <ResetPasswordScreen
            onBackToLogin={() => setCurrentScreen('login')}
            onResetSuccess={() => {
              // The ResetPasswordScreen handles its own success toast before calling this
              setCurrentScreen('login');
            }}
          />
        ) : currentScreen === 'twoFactor' ? (
          <TwoFactorScreen
            onVerified={handle2FAVerified}
            onBackToLogin={() => setCurrentScreen('login')}
          />
        ) : currentScreen === 'admin' ? (
          <AdminDashboardScreen onLogout={handleLogout} />
        ) : (
          <DashboardScreen onLogout={handleLogout} />
        )}
      </div>
    </div>
  );
};

export default App;
