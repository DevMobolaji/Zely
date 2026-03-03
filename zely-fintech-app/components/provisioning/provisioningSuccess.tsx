
import React from 'react';
import { CheckCircle2, Copy, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../../context/ToastContext';

interface ProvisioningSuccessProps {
  accountDetails: {
    checking: string;
    savings: string;
  };
}

const ProvisioningSuccess: React.FC<ProvisioningSuccessProps> = ({ accountDetails }) => {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    showToast('success', `${label} copied to clipboard`);
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-10 border border-slate-200 dark:border-slate-800 shadow-2xl animate-in zoom-in duration-500">
      <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-3xl flex items-center justify-center mb-8 shadow-lg shadow-green-500/20">
        <CheckCircle2 className="w-10 h-10 text-green-600 dark:text-green-400" />
      </div>

      <h1 className="text-4xl font-black text-slate-900 dark:text-white mb-2 tracking-tight">Your Account is Ready</h1>
      <p className="text-slate-500 dark:text-slate-400 mb-10 text-lg font-medium leading-relaxed">Your digital ledger accounts have been successfully instantiated.</p>

      <div className="grid grid-cols-1 gap-4 mb-10">
        <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-2xl border border-slate-100 dark:border-slate-700/50 group">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Primary Account</p>
          <div className="flex items-center justify-between mb-1">
            <p className="text-xl font-mono font-black text-slate-900 dark:text-white">{accountDetails.checking}</p>
            <button onClick={() => handleCopy(accountDetails.checking, 'Primary Account Number')} className="p-2 text-slate-400 hover:text-primary transition-colors">
              <Copy className="w-4 h-4" />
            </button>
          </div>
          <p className="text-xs font-bold text-primary/70">(Use this to receive money)</p>
        </div>

        <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-2xl border border-slate-100 dark:border-slate-700/50 group">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Internal Savings Account</p>
          <div className="flex items-center justify-between mb-1">
            <p className="text-xl font-mono font-black text-slate-900 dark:text-white">{accountDetails.savings}</p>
            {/* Copy button hidden for internal savings account as requested */}
          </div>
          <p className="text-xs font-bold text-slate-400">Cannot receive external transfers</p>
        </div>
      </div>

      <button
        onClick={() => navigate('/dashboard')}
        className="w-full py-4 bg-slate-900 dark:bg-primary text-white font-bold rounded-2xl hover:opacity-95 transition-all flex items-center justify-center gap-3 transform active:scale-[0.98]"
      >
        <span>Enter Dashboard</span>
        <ArrowRight className="w-5 h-5" />
      </button>
    </div>
  );
};

export default ProvisioningSuccess;
