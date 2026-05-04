import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Clock, Activity, Search, AlertCircle, AlertTriangle, User, Wallet, HardDrive, Cpu, CheckCircle2, ServerCrash, Unlock, X } from 'lucide-react';
import { formatRelativeTime } from './AdminReconciliationScreen';
import { useToast } from '../../context/ToastContext';

interface Drift {
    ledgerAccountPublicId: string;
    ownerType: "WALLET" | "USER" | "VAULT" | "SYSTEM";
    ownerPublicId: string;
    cachedBalance: number;
    trueBalance: number;
    drift: number;
    severity: "OVERSTATED" | "UNDERSTATED" | "IN_SYNC";
    action: "ALERT_AND_FREEZE" | "ALERT_ONLY" | "NONE";
    notes?: string;
}

const formatCurrency = (val: number) => {
    const formatted = new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(val);
    return formatted.replace('NGN', '₦').replace(/\s/g, ''); // Ensure strict ₦ formatting if browser defaults to NGN
};

const mockDrifts: Record<string, Drift[]> = {
    'run_6': [
        {
            ledgerAccountPublicId: 'acc_092314',
            ownerType: 'USER',
            ownerPublicId: 'usr_5001',
            cachedBalance: 45000,
            trueBalance: 40000,
            drift: 5000,
            severity: 'OVERSTATED',
            action: 'ALERT_AND_FREEZE',
            notes: 'Suspected double-spend attempt during DB latency window'
        },
        {
            ledgerAccountPublicId: 'acc_092315',
            ownerType: 'WALLET',
            ownerPublicId: 'wal_7781',
            cachedBalance: 2000,
            trueBalance: 2500,
            drift: -500,
            severity: 'UNDERSTATED',
            action: 'ALERT_ONLY',
            notes: 'Pending fee reversal not synced'
        },
        {
            ledgerAccountPublicId: 'acc_098811',
            ownerType: 'SYSTEM',
            ownerPublicId: 'sys_fees_pool',
            cachedBalance: 1450000,
            trueBalance: 1448000,
            drift: 2000,
            severity: 'OVERSTATED',
            action: 'NONE',
            notes: 'Known timing issue with daily settlement script'
        }
    ],
    'run_4': [
        {
            ledgerAccountPublicId: 'acc_112001',
            ownerType: 'VAULT',
            ownerPublicId: 'vlt_001',
            cachedBalance: 100000,
            trueBalance: 105000,
            drift: -5000,
            severity: 'UNDERSTATED',
            action: 'ALERT_ONLY'
        }
    ]
};

const getReportInfo = (runId: string) => {
    const defaultData = {
        runId,
        status: "COMPLETED",
        startedAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
        finishedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 + 18400).toISOString(),
        durationMs: 18400,
        accountsChecked: 15410,
        driftsFound: mockDrifts[runId]?.length || 0,
        triggeredBy: "MANUAL",
        errorMessage: ""
    };
    
    if (runId === 'run_5') return { ...defaultData, status: 'FAILED', driftsFound: 0, errorMessage: "TIMEOUT: Database cluster unresponsive" };
    return defaultData;
};

const OwnerIcon = ({ type }: { type: string }) => {
    switch (type) {
        case 'WALLET': return <Wallet className="w-4 h-4 text-purple-500" />;
        case 'USER': return <User className="w-4 h-4 text-primary" />;
        case 'VAULT': return <HardDrive className="w-4 h-4 text-emerald-500" />;
        case 'SYSTEM': return <Cpu className="w-4 h-4 text-slate-500" />;
        default: return <Activity className="w-4 h-4 text-slate-400" />;
    }
};

const AdminReconciliationDetailScreen: React.FC = () => {
    const { runId } = useParams();
    const navigate = useNavigate();
    const { showToast } = useToast();
    
    const [report, setReport] = useState(getReportInfo(runId || ''));
    const [drifts, setDrifts] = useState(mockDrifts[runId || ''] || []);
    const [isLoadingDetails, setIsLoadingDetails] = useState(false);

    // API Call Preparation (Commented out for production use later)
    /*
    useEffect(() => {
        const fetchReportDetails = async () => {
            if (!runId) return;
            setIsLoadingDetails(true);
            try {
                // const response = await fetch(`/admin/reconciliation/reports/${runId}`);
                // if (!response.ok) throw new Error('Failed to fetch report details');
                // const data = await response.json();
                // setReport(data.report);
                // setDrifts(data.drifts);
            } catch (error) {
                console.error("Failed to fetch report details:", error);
                showToast('error', 'Failed to load report details');
            } finally {
                setIsLoadingDetails(false);
            }
        };
        fetchReportDetails();
    }, [runId]);
    */

    const [unfreezeModalOpen, setUnfreezeModalOpen] = useState(false);
    const [selectedDrift, setSelectedDrift] = useState<Drift | null>(null);
    const [unfreezeReason, setUnfreezeReason] = useState('');
    const [unfreezeVerify, setUnfreezeVerify] = useState(true);
    const [isUnfreezing, setIsUnfreezing] = useState(false);
    const [unfreezeError, setUnfreezeError] = useState<string | null>(null);

    const openUnfreezeModal = (drift: Drift) => {
        setSelectedDrift(drift);
        setUnfreezeReason('');
        setUnfreezeVerify(true);
        setUnfreezeError(null);
        setUnfreezeModalOpen(true);
    };

    const handleUnfreezeSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (unfreezeReason.length < 10 || !selectedDrift) return;

        setIsUnfreezing(true);
        setUnfreezeError(null);

        // API Call Preparation (Commented out for production use later)
        /*
        try {
            // const response = await fetch(`/admin/wallets/${selectedDrift.ownerPublicId}/unfreeze`, {
            //     method: 'POST',
            //     headers: { 'Content-Type': 'application/json' },
            //     body: JSON.stringify({ 
            //         reason: unfreezeReason,
            //         verifyReconciliation: unfreezeVerify 
            //     })
            // });
            //
            // const result = await response.json();
            //
            // if (!response.ok) {
            //     if (result.error === 'CANNOT_UNFREEZE_DRIFT_STILL_EXISTS') {
            //         throw new Error("CANNOT_UNFREEZE_DRIFT_STILL_EXISTS: The underlying discrepancy must be resolved before this wallet can be safely unfrozen.");
            //     } else if (result.error === 'WALLET_NOT_FROZEN') {
            //         throw new Error("WALLET_NOT_FROZEN: This wallet is already active.");
            //     }
            //     throw new Error(result.message || 'Failed to unfreeze wallet');
            // }
            // 
            // setUnfreezeModalOpen(false);
            // showToast('success', 'Wallet successfully unfrozen');
            // 
            // // Optionally refetch drifts here to update the UI
        } catch (error: any) {
            console.error("Failed to unfreeze wallet:", error);
            setUnfreezeError(error.message || "An unexpected error occurred");
        } finally {
            setIsUnfreezing(false);
        }
        */

        // Simulate API call taking a few seconds (Mock implementation)
        setTimeout(() => {
            // Randomly succeed or fail if verify is on
            if (unfreezeVerify && Math.random() > 0.5) {
                setIsUnfreezing(false);
                setUnfreezeError("CANNOT_UNFREEZE_DRIFT_STILL_EXISTS: The underlying discrepancy must be resolved before this wallet can be safely unfrozen.");
            } else {
                setIsUnfreezing(false);
                setUnfreezeModalOpen(false);
                showToast('success', 'Wallet successfully unfrozen');
            }
        }, 2000);
    };

    return (
        <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500 pb-20">
            <button 
                onClick={() => navigate('/admin/reconciliation')}
                className="flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-primary transition-colors"
            >
                <ArrowLeft className="w-4 h-4" /> Back to Dashboard
            </button>

            <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
                <div>
                    <h2 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-3">
                        Report: {runId}
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                            report.status === 'COMPLETED' ? 'bg-green-100 text-green-700' :
                            report.status === 'RUNNING' ? 'bg-blue-100 text-blue-700 animate-pulse' :
                            'bg-red-100 text-red-700'
                        }`}>
                            {report.status}
                        </span>
                    </h2>
                    <p className="text-slate-500 font-medium flex items-center gap-2 mt-2" title={new Date(report.startedAt).toLocaleString()}>
                        <Clock className="w-4 h-4" /> Run {formatRelativeTime(report.startedAt)} via {report.triggeredBy}
                    </p>
                </div>
            </div>

            {report.status === 'FAILED' && report.errorMessage && (
                <div className="p-6 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900/30 rounded-3xl flex items-start gap-4">
                    <ServerCrash className="w-6 h-6 text-red-600 mt-1" />
                    <div>
                        <h4 className="font-bold text-red-900 dark:text-red-400">Reconciliation Failed</h4>
                        <p className="text-red-700 dark:text-red-300 text-sm mt-1">{report.errorMessage}</p>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-3xl">
                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Accounts Checked</p>
                    <p className="text-3xl font-black text-slate-900 dark:text-white">{report.accountsChecked.toLocaleString()}</p>
                </div>
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-3xl">
                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Duration</p>
                    <p className="text-3xl font-black text-slate-900 dark:text-white">{report.durationMs > 0 ? (report.durationMs / 1000).toFixed(1) + 's' : '-'}</p>
                </div>
                <div className={`border p-6 rounded-3xl md:col-span-2 flex items-center justify-between ${report.driftsFound > 0 ? 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-900/50' : 'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-900/50'}`}>
                    <div>
                        <p className={`text-xs font-black uppercase tracking-widest mb-2 ${report.driftsFound > 0 ? 'text-red-500' : 'text-green-600'}`}>Drifts Detected</p>
                        <p className={`text-4xl font-black ${report.driftsFound > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-700 dark:text-green-400'}`}>
                            {report.driftsFound}
                        </p>
                    </div>
                    {report.driftsFound > 0 ? <AlertTriangle className="w-12 h-12 text-red-500 opacity-20" /> : <CheckCircle2 className="w-12 h-12 text-green-500 opacity-20" />}
                </div>
            </div>

            {report.status === 'COMPLETED' && report.driftsFound > 0 && (
                <div className="space-y-4">
                    <h3 className="text-xl font-black mb-4 flex items-center gap-2">
                        <Search className="w-5 h-5 text-slate-400" /> Drift Analysis Details
                    </h3>
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-50 dark:bg-slate-800/50 text-xs uppercase tracking-widest text-slate-400 font-black border-b border-slate-100 dark:border-slate-800">
                                        <th className="px-6 py-4">Account ID</th>
                                        <th className="px-6 py-4">Owner</th>
                                        <th className="px-6 py-4 text-right">Cached Bal</th>
                                        <th className="px-6 py-4 text-right">True Bal</th>
                                        <th className="px-6 py-4 text-right">Drift</th>
                                        <th className="px-6 py-4">Severity & Action</th>
                                        <th className="px-6 py-4"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50 text-sm">
                                    {drifts.map((d, i) => (
                                        <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                            <td className="px-6 py-4 font-mono text-xs font-bold text-slate-600 dark:text-slate-300">
                                                {d.ledgerAccountPublicId}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2">
                                                    <OwnerIcon type={d.ownerType} />
                                                    <span className="font-bold text-slate-900 dark:text-white capitalize">{d.ownerType.toLowerCase()}</span>
                                                </div>
                                                <div className="text-[10px] text-slate-500 mt-1 tracking-wider">{d.ownerPublicId}</div>
                                            </td>
                                            <td className="px-6 py-4 text-right font-medium text-slate-600 dark:text-slate-400">
                                                {formatCurrency(d.cachedBalance)}
                                            </td>
                                            <td className="px-6 py-4 text-right font-medium text-slate-900 dark:text-white">
                                                {formatCurrency(d.trueBalance)}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <span className={`font-black ${d.severity === 'OVERSTATED' ? 'text-red-500' : 'text-yellow-600 dark:text-yellow-500'}`}>
                                                    {d.drift > 0 ? '+' : ''}{formatCurrency(d.drift)}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex flex-col gap-1.5 items-start">
                                                    <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-black tracking-widest uppercase ${
                                                        d.severity === 'OVERSTATED' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'
                                                    }`}>
                                                        {d.severity}
                                                    </span>
                                                    <span className="text-[9px] font-bold text-slate-400 tracking-wider">
                                                        ACTION: {d.action.replace(/_/g, ' ')}
                                                    </span>
                                                </div>
                                                {d.notes && (
                                                    <p className="text-xs text-slate-500 mt-2 italic flex items-center gap-1">
                                                        <AlertCircle className="w-3 h-3" /> {d.notes}
                                                    </p>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex flex-col gap-2 items-end">
                                                    <button onClick={() => navigate(`/admin/wallet-funding`)} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-900 dark:text-white rounded-xl font-bold text-xs transition-colors whitespace-nowrap">
                                                        Investigate Wallet
                                                    </button>
                                                    {d.action === 'ALERT_AND_FREEZE' && (
                                                        <button 
                                                            onClick={() => openUnfreezeModal(d)}
                                                            className="flex items-center gap-1.5 px-4 py-2 bg-purple-50 hover:bg-purple-100 dark:bg-purple-900/10 dark:hover:bg-purple-900/30 text-purple-700 dark:text-purple-400 rounded-xl font-bold text-xs transition-colors whitespace-nowrap"
                                                        >
                                                            <Unlock className="w-3 h-3" /> Unfreeze Wallet
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}
            
            {report.status === 'COMPLETED' && report.driftsFound === 0 && (
                <div className="p-12 border border-dashed border-slate-300 dark:border-slate-800 rounded-3xl text-center">
                    <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                        <CheckCircle2 className="w-8 h-8 text-green-600" />
                    </div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Systems in Sync</h3>
                    <p className="text-slate-500">No discrepancies detected during this run.</p>
                </div>
            )}

            {unfreezeModalOpen && selectedDrift && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden">
                        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/30 text-purple-600 rounded-xl flex items-center justify-center">
                                    <Unlock className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-slate-900 dark:text-white">Unfreeze Wallet</h3>
                                    <p className="text-xs text-slate-500 font-mono mt-0.5">{selectedDrift.ledgerAccountPublicId}</p>
                                </div>
                            </div>
                            <button onClick={() => setUnfreezeModalOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        
                        <form onSubmit={handleUnfreezeSubmit} className="p-6 space-y-6">
                            <div className="p-4 bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-900/50 rounded-2xl flex items-start gap-3">
                                <AlertTriangle className="w-5 h-5 text-yellow-600 shrink-0 mt-0.5" />
                                <p className="text-sm text-yellow-800 dark:text-yellow-500/90 font-medium">
                                    This will restore wallet to ACTIVE status. A reconciliation check will run first to verify the drift of <strong>{formatCurrency(selectedDrift.drift)}</strong> is resolved.
                                </p>
                            </div>

                            {unfreezeError && (
                                <div className="p-4 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900/50 rounded-2xl flex items-start gap-3 animate-in fade-in slide-in-from-top-2">
                                    <ServerCrash className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                                    <p className="text-sm text-red-800 dark:text-red-400 font-medium">
                                        {unfreezeError}
                                    </p>
                                </div>
                            )}

                            <div>
                                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                                    Reason for Unfreezing <span className="text-red-500">*</span>
                                </label>
                                <textarea 
                                    className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl text-sm font-medium focus:ring-2 focus:ring-primary outline-none p-4 resize-none placeholder:text-slate-400 text-slate-900 dark:text-white"
                                    rows={4}
                                    placeholder="Explain why this wallet is safe to unfreeze..."
                                    value={unfreezeReason}
                                    onChange={e => setUnfreezeReason(e.target.value)}
                                    minLength={10}
                                    maxLength={500}
                                    required
                                />
                                <div className="flex justify-between items-center mt-1.5 px-1">
                                    <p className="text-xs text-slate-500">Provide required context for audit logs.</p>
                                    <p className={`text-xs font-medium ${unfreezeReason.length < 10 ? 'text-red-500' : 'text-green-600'}`}>{unfreezeReason.length} / 500</p>
                                </div>
                            </div>

                            <label className="flex items-center gap-3 p-4 border border-slate-200 dark:border-slate-800 rounded-2xl cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                <input 
                                    type="checkbox" 
                                    checked={!unfreezeVerify}
                                    onChange={(e) => setUnfreezeVerify(!e.target.checked)}
                                    className="w-5 h-5 text-red-500 rounded border-slate-300 dark:border-slate-600 focus:ring-red-500 dark:bg-slate-700"
                                />
                                <div>
                                    <span className="text-sm font-bold block text-slate-900 dark:text-white">Skip reconciliation verification</span>
                                    <span className="text-xs text-slate-500">DANGEROUS: Force unfreeze without checking if drift still exists</span>
                                </div>
                            </label>

                            <div className="flex justify-end gap-3 pt-2">
                                <button 
                                    type="button" 
                                    onClick={() => setUnfreezeModalOpen(false)}
                                    className="px-6 py-3 font-bold text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
                                >
                                    Cancel
                                </button>
                                <button 
                                    type="submit" 
                                    disabled={isUnfreezing || unfreezeReason.length < 10}
                                    className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold text-sm transition-colors shadow-lg shadow-purple-600/30 flex items-center gap-2 group disabled:opacity-50 disabled:pointer-events-none"
                                >
                                    {isUnfreezing ? <Activity className="w-4 h-4 animate-spin" /> : <Unlock className="w-4 h-4 group-hover:-translate-y-0.5 transition-transform" />}
                                    {isUnfreezing ? 'Processing...' : 'Unfreeze Wallet'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminReconciliationDetailScreen;
