import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, CheckCircle2, Shield, Zap, Database, Globe, AlertCircle } from 'lucide-react';
import { authService } from '../../services/auth.services';
import { useToast } from '../../context/ToastContext';

const ProvisioningScreen: React.FC = () => {
    const navigate = useNavigate();
    const { showToast } = useToast();
    const [step, setStep] = useState(0);
    const [error, setError] = useState(false);
    const pollInterval = useRef<any>(null);

    const steps = [
        { label: 'Initializing secure connection...', icon: Shield, status: 'ACCOUNT_PROVISION_STARTED' },
        { label: 'Allocating ledger nodes...', icon: Database, status: 'WALLETS_CREATED' },
        { label: 'Syncing with regional gateways...', icon: Globe, status: 'LEDGERS_CREATED' },
        { label: 'Finalizing account setup...', icon: Zap, status: 'ACCOUNTS_CREATED' },
    ];

    useEffect(() => {
        const checkStatus = async () => {
            try {
                const data = await authService.getProvisioningStatus();
                
                if (data.status === 'ACCOUNT_READY') {
                    setStep(4);
                    clearInterval(pollInterval.current);
                    setTimeout(() => navigate('/dashboard'), 1500);
                    return;
                }

                // Map status to step index
                if (data.status === 'ACCOUNT_PROVISION_STARTED') setStep(0);
                else if (data.status === 'WALLETS_CREATED') setStep(1);
                else if (data.status === 'LEDGERS_CREATED') setStep(2);
                else if (data.status === 'ACCOUNTS_CREATED') setStep(3);
                
            } catch (err) {
                console.error("Provisioning poll failed:", err);
                setError(true);
                clearInterval(pollInterval.current);
            }
        };

        checkStatus();
        pollInterval.current = setInterval(checkStatus, 2000);

        return () => clearInterval(pollInterval.current);
    }, [navigate]);

    const handleRetry = async () => {
        setError(false);
        try {
            await authService.retryProvisioning();
        } catch (err) {
            showToast('error', 'Retry failed');
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-white dark:bg-black p-4 font-mono">
            <div className="max-w-md w-full text-center">
                {!error ? (
                    <>
                        <div className="mb-12 relative">
                            <div className="w-24 h-24 bg-primary/10 rounded-3xl flex items-center justify-center mx-auto animate-pulse">
                                <Loader2 className="w-12 h-12 text-primary animate-spin" />
                            </div>
                            <div className="absolute -top-4 -right-4 w-8 h-8 bg-green-500 rounded-full border-4 border-white dark:border-black flex items-center justify-center">
                                <CheckCircle2 className="w-4 h-4 text-white" />
                            </div>
                        </div>
                        
                        <h1 className="text-3xl font-black mb-4 tracking-tight underline decoration-primary decoration-4 underline-offset-8">Setting Up Your Vault</h1>
                        <p className="text-slate-500 mb-12">Please wait while we provision your decentralized financial infrastructure.</p>
                        
                        <div className="space-y-4 text-left max-w-sm mx-auto">
                            {steps.map((s, i) => {
                                const Icon = s.icon;
                                const isDone = step > i;
                                const isCurrent = step === i;
                                
                                return (
                                    <div key={i} className={`flex items-center gap-4 p-4 rounded-2xl border transition-all duration-500 ${isDone ? 'bg-green-50 dark:bg-green-900/20 border-green-100 dark:border-green-800' : isCurrent ? 'bg-white dark:bg-slate-900 border-primary shadow-lg shadow-primary/10' : 'bg-slate-50 dark:bg-slate-800/50 border-transparent opacity-50'}`}>
                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isDone ? 'bg-green-500 text-white' : isCurrent ? 'bg-primary text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-400'}`}>
                                            {isDone ? <CheckCircle2 className="w-6 h-6" /> : <Icon className={`w-6 h-6 ${isCurrent ? 'animate-bounce' : ''}`} />}
                                        </div>
                                        <div>
                                            <p className={`text-sm font-bold ${isDone ? 'text-green-700 dark:text-green-400' : isCurrent ? 'text-slate-900 dark:text-white' : 'text-slate-400'}`}>
                                                {s.label}
                                            </p>
                                            {isCurrent && <div className="h-1 w-24 bg-primary/20 rounded-full mt-1 overflow-hidden"><div className="h-full bg-primary animate-progress"></div></div>}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </>
                ) : (
                    <div className="animate-in fade-in zoom-in duration-500">
                        <div className="w-20 h-20 bg-red-100 text-red-600 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-xl">
                            <AlertCircle className="w-10 h-10" />
                        </div>
                        <h2 className="text-2xl font-black mb-4">Infrastructure Error</h2>
                        <p className="text-slate-500 mb-8 max-w-xs mx-auto">We encountered a problem while allocating your ledger nodes. This is often temporary.</p>
                        <button 
                            onClick={handleRetry}
                            className="px-10 py-4 bg-slate-900 text-white font-black rounded-2xl hover:bg-slate-800 transition-all flex items-center gap-2 mx-auto"
                        >
                            <Zap className="w-5 h-5 fill-current" /> Retry Provisioning
                        </button>
                    </div>
                )}
                
                <style dangerouslySetInnerHTML={{ __html: `
                    @keyframes progress {
                        0% { width: 0%; }
                        100% { width: 100%; }
                    }
                    .animate-progress {
                        animation: progress 2s linear infinite;
                    }
                `}} />
            </div>
        </div>
    );
};

export default ProvisioningScreen;
