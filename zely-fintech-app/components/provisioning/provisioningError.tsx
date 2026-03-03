
import React from 'react';
import { AlertCircle, RefreshCw, HeadphonesIcon, XCircle, Loader2 } from 'lucide-react';

interface ProvisioningErrorProps {
  reason?: string;
  onRetry: () => void;
  isRetrying: boolean;
}

const ProvisioningError: React.FC<ProvisioningErrorProps> = ({ reason, onRetry, isRetrying }) => {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-10 border border-red-100 dark:border-red-900/20 shadow-2xl animate-in slide-in-from-bottom-8 duration-500">
      <div className="flex items-start justify-between mb-8">
        <div className="w-20 h-20 bg-red-100 dark:bg-red-900/30 rounded-3xl flex items-center justify-center shadow-lg shadow-red-500/10">
          <AlertCircle className="w-10 h-10 text-red-500" />
        </div>
        <div className="px-4 py-2 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-100 dark:border-red-800/30 flex items-center gap-2">
          <XCircle className="w-4 h-4 text-red-500" />
          <span className="text-xs font-black text-red-600 dark:text-red-400 uppercase tracking-widest">Setup Failure</span>
        </div>
      </div>

      <h1 className="text-4xl font-black text-slate-900 dark:text-white mb-2 tracking-tight">Provisioning Failed</h1>
      <p className="text-slate-500 dark:text-slate-400 mb-6 text-lg font-medium leading-relaxed">
        {reason || "Something went wrong while setting up your secure vault. This usually happens due to a ledger synchronization timeout."}
      </p>

      <div className="flex flex-col sm:flex-row gap-4">
        <button
          onClick={onRetry}
          disabled={isRetrying}
          className="flex-[2] py-4 bg-primary text-white font-bold rounded-2xl hover:bg-primary-dark transition-all flex items-center justify-center gap-3 shadow-lg shadow-primary/20 disabled:opacity-50"
        >
          {isRetrying ? <Loader2 className="w-5 h-5 animate-spin" /> : <RefreshCw className="w-5 h-5" />}
          Retry Account Setup
        </button>
        <button
          onClick={() => window.open('mailto:support@zely.com')}
          className="flex-1 py-4 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold rounded-2xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-all flex items-center justify-center gap-2"
        >
          <HeadphonesIcon className="w-5 h-5" />
          Support
        </button>
      </div>
    </div>
  );
};

export default ProvisioningError;
