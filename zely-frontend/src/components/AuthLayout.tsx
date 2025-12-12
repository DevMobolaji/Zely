import React, { useState, useEffect } from 'react';
import { Sun, Moon } from 'lucide-react';

interface AuthLayoutProps {
  children: React.ReactNode;
  rightSection: React.ReactNode;
}

const AuthLayout: React.FC<AuthLayoutProps> = ({ children, rightSection }) => {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    // Check for system preference or previously saved preference
    if (document.documentElement.classList.contains('dark') || window.matchMedia('(prefers-color-scheme: dark)').matches) {
      setIsDark(true);
      document.documentElement.classList.add('dark');
    }
  }, []);

  const toggleTheme = () => {
    const newDark = !isDark;
    setIsDark(newDark);
    if (newDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-white dark:bg-slate-900 font-sans transition-colors duration-300">
      {/* Left Section - Form Container */}
      <div className="w-full lg:w-1/2 flex flex-col justify-center p-6 sm:p-12 relative bg-white dark:bg-slate-900 text-slate-900 dark:text-white transition-colors duration-300 h-full overflow-y-auto no-scrollbar">

        {/* Theme Toggle Switch - Visible on mobile/tablet, Hidden on Desktop (lg+) */}
        <button
          onClick={toggleTheme}
          className="lg:hidden absolute top-6 right-6 p-2.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-slate-300 dark:focus:ring-slate-600 z-50"
          aria-label="Toggle Dark Mode"
        >
          {isDark ? (
            <Sun className="w-5 h-5" />
          ) : (
            <Moon className="w-5 h-5" />
          )}
        </button>

        <div className="w-full max-w-md mx-auto z-10 py-8">
          {children}
        </div>
      </div>

      {/* Right Section - Visuals */}
      <div className="hidden lg:flex fixed right-0 top-0 bottom-0 w-1/2 bg-black flex-col items-center justify-center p-12 relative overflow-hidden z-0">
        {/* Background Blobs */}
        <div className="absolute top-[-10%] right-[-10%] w-[600px] h-[600px] bg-brand-purple rounded-full blur-[140px] opacity-20 animate-pulse"></div>
        <div className="absolute bottom-[-20%] left-[-20%] w-[500px] h-[500px] bg-brand-blue rounded-full blur-[140px] opacity-20 animate-pulse-slow"></div>
        <div className="absolute top-[30%] left-[30%] w-[300px] h-[300px] bg-brand-pink rounded-full blur-[120px] opacity-10"></div>

        {/* Content Container */}
        <div className="relative w-full max-w-lg z-10 flex flex-col justify-center h-full">
          {rightSection}
        </div>

        {/* Footer */}
        <div className="absolute bottom-8 w-full px-12 flex justify-between items-center text-xs text-gray-600 font-medium z-10">
          <span>© 2024 FramerGen Inc.</span>
          <div className="flex gap-6">
            <a href="#" className="hover:text-white transition-colors">Privacy Policy</a>
            <a href="#" className="hover:text-white transition-colors">Terms of Service</a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthLayout;