
import React, { useEffect, useState } from 'react';
import { Check, Loader2, Terminal, Circle, Hash } from 'lucide-react';

export type ProvisioningStatus =
    | 'ACCOUNT_PROVISION_STARTED'
    | 'WALLETS_CREATED'
    | 'LEDGERS_CREATED'
    | 'ACCOUNTS_CREATED'
    | 'ACCOUNT_READY'
    | 'PROVISION_FAILED';

interface Step {
    key: ProvisioningStatus;
    title: string;
    code: string;
}

const STEPS: Step[] = [
    { key: 'ACCOUNT_PROVISION_STARTED', title: 'Initializing secure environment', code: 'INIT_ENV' },
    { key: 'WALLETS_CREATED', title: 'Generating cryptographic wallets', code: 'GEN_WALLETS' },
    { key: 'LEDGERS_CREATED', title: 'Establishing immutable ledgers', code: 'EST_LEDGER' },
    { key: 'ACCOUNTS_CREATED', title: 'Verifying banking protocols', code: 'VERIFY_PROTO' },
    { key: 'ACCOUNT_READY', title: 'System ready', code: 'SYS_READY' },
];

interface ProvisioningStepperProps {
    currentStatus: ProvisioningStatus;
}

const ProvisioningStepper: React.FC<ProvisioningStepperProps> = ({ currentStatus }) => {
    const [logs, setLogs] = useState<{ time: string, step: Step, status: 'pending' | 'active' | 'completed' }[]>([]);

    const getActiveIndex = () => {
        const idx = STEPS.findIndex(s => s.key === currentStatus);
        return idx === -1 ? 0 : idx;
    };

    const activeIndex = getActiveIndex();

    useEffect(() => {
        // Generate logs based on active index
        const newLogs = STEPS.map((step, index) => {
            let status: 'pending' | 'active' | 'completed' = 'pending';
            if (index < activeIndex || currentStatus === 'ACCOUNT_READY') status = 'completed';
            else if (index === activeIndex) status = 'active';

            return {
                time: `00:00:${(index * 2 + 1).toString().padStart(2, '0')}`, // Mock relative time
                step,
                status
            };
        });
        setLogs(newLogs);
    }, [activeIndex, currentStatus]);

    return (
        <div className="font-mono text-sm space-y-1 w-full max-w-lg mx-auto">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-400 mb-4 border-b border-slate-200 dark:border-slate-800 pb-2 uppercase tracking-widest">
                <Terminal className="w-3 h-3" />
                <span>System Log</span>
            </div>

            {logs.map((log, index) => (
                <div
                    key={log.step.key}
                    className={`flex items-center gap-4 py-2 transition-all duration-300 ${log.status === 'pending' ? 'opacity-30' :
                            log.status === 'active' ? 'opacity-100' : 'opacity-60'
                        }`}
                >
                    <span className="text-xs text-slate-400 w-16 shrink-0 font-light">{log.time}</span>

                    <div className="w-4 flex justify-center shrink-0">
                        {log.status === 'completed' && <Check className="w-3.5 h-3.5 text-green-500" />}
                        {log.status === 'active' && <div className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse" />}
                        {log.status === 'pending' && <div className="w-1 h-1 bg-slate-300 dark:bg-slate-700 rounded-full" />}
                    </div>

                    <div className="flex-1 flex items-center justify-between">
                        <span className={`font-medium ${log.status === 'active' ? 'text-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-400'
                            }`}>
                            {log.step.title}
                            {log.status === 'active' && <span className="animate-pulse">_</span>}
                        </span>
                        <span className="text-[10px] text-slate-400 uppercase tracking-wider opacity-50 hidden sm:block">
                            [{log.step.code}]
                        </span>
                    </div>
                </div>
            ))}
        </div>
    );
};

export default ProvisioningStepper;
