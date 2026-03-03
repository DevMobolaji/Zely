
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldAlert, ArrowLeft, Lock, Home } from 'lucide-react';

const UnauthorizedScreen: React.FC = () => {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen w-full bg-white dark:bg-black flex items-center justify-center p-6 relative overflow-hidden font-sans transition-colors duration-300">
            {/* Background Decorations */}
            <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-red-500/10 rounded-full blur-[120px] pointer-events-none animate-pulse-slow"></div>
            <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-primary/10 rounded-full blur-[120px] pointer-events-none animate-pulse-slow"></div>

            {/* Pattern Overlay */}
            <div className="absolute inset-0 opacity-[0.03] dark:opacity-[0.05] pointer-events-none bg-[radial-gradient(#64748b_1.5px,transparent_1.5px)] [background-size:24px_24px]"></div>

            <div className="max-w-lg w-full relative z-10 text-center animate-in fade-in slide-in-from-bottom-8 duration-500">
                <div className="relative group mx-auto w-fit mb-8">
                    <div className="absolute inset-0 bg-red-500/20 blur-2xl rounded-full group-hover:bg-red-500/30 transition-colors duration-500"></div>
                    <div className="w-28 h-28 bg-white dark:bg-slate-900 rounded-[2rem] flex items-center justify-center relative shadow-2xl border border-slate-100 dark:border-slate-800 rotate-3 transition-transform duration-500 group-hover:rotate-6 group-hover:scale-105">
                        <ShieldAlert className="w-14 h-14 text-red-500" strokeWidth={1.5} />
                    </div>
                    <div className="absolute -top-2 -right-2 w-8 h-8 bg-slate-900 dark:bg-white rounded-full flex items-center justify-center text-white dark:text-slate-900 shadow-lg animate-bounce">
                        <Lock className="w-4 h-4" />
                    </div>
                </div>

                <h1 className="text-4xl sm:text-5xl font-black text-slate-900 dark:text-white mb-4 tracking-tighter">
                    Access Denied
                </h1>
                
                <p className="text-slate-500 dark:text-slate-400 mb-10 text-lg font-medium leading-relaxed max-w-sm mx-auto">
                    You don't have the necessary permissions to view this secure area. Please contact your administrator if you believe this is an error.
                </p>

                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                    <button 
                        onClick={() => navigate(-1)}
                        className="px-8 py-4 rounded-2xl border border-slate-200 dark:border-slate-800 font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all flex items-center justify-center gap-2 group"
                    >
                        <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" /> 
                        Go Back
                    </button>
                    
                    <button 
                        onClick={() => navigate('/dashboard')}
                        className="px-8 py-4 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold hover:opacity-90 transition-all shadow-xl hover:shadow-2xl hover:-translate-y-1 flex items-center justify-center gap-2"
                    >
                        <Home className="w-5 h-5" /> 
                        Dashboard
                    </button>
                </div>

                <div className="mt-16 pt-8 border-t border-slate-100 dark:border-slate-800 flex justify-center gap-2">
                    <span className="px-3 py-1 rounded-full bg-red-50 dark:bg-red-900/10 text-red-600 dark:text-red-400 text-[10px] font-mono font-bold uppercase tracking-widest border border-red-100 dark:border-red-900/20">
                        Error 403
                    </span>
                    <span className="px-3 py-1 rounded-full bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-[10px] font-mono font-bold uppercase tracking-widest border border-slate-100 dark:border-slate-700">
                        Restricted
                    </span>
                </div>
            </div>
        </div>
    );
};

export default UnauthorizedScreen;
