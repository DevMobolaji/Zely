import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Activity, Clock, ServerCrash, CheckCircle2, ChevronRight, Filter, RefreshCw, AlertTriangle } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import CustomSelect from '../../components/common/CustomSelect';

interface ReconReport {
    runId: string;
    status: "RUNNING" | "COMPLETED" | "FAILED";
    startedAt: string;
    finishedAt: string;
    durationMs: number;
    accountsChecked: number;
    driftsFound: number;
    triggeredBy: "SCHEDULED" | "MANUAL";
    errorMessage?: string;
}

const mockReports: ReconReport[] = [
    { runId: 'run_8', status: "RUNNING", startedAt: new Date(Date.now() - 1000 * 60 * 2).toISOString(), finishedAt: "", durationMs: 0, accountsChecked: 450, driftsFound: 0, triggeredBy: "MANUAL" },
    { runId: 'run_7', status: "COMPLETED", startedAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(), finishedAt: new Date(Date.now() - 1000 * 60 * 60 * 2 + 15000).toISOString(), durationMs: 15000, accountsChecked: 15420, driftsFound: 0, triggeredBy: "SCHEDULED" },
    { runId: 'run_6', status: "COMPLETED", startedAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(), finishedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 + 18400).toISOString(), durationMs: 18400, accountsChecked: 15410, driftsFound: 3, triggeredBy: "MANUAL" },
    { runId: 'run_5', status: "FAILED", startedAt: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(), finishedAt: new Date(Date.now() - 1000 * 60 * 60 * 48 + 5000).toISOString(), durationMs: 5000, accountsChecked: 2100, driftsFound: 0, triggeredBy: "SCHEDULED", errorMessage: "TIMEOUT: Database cluster unresponsive" },
    { runId: 'run_4', status: "COMPLETED", startedAt: new Date(Date.now() - 1000 * 60 * 60 * 72).toISOString(), finishedAt: new Date(Date.now() - 1000 * 60 * 60 * 72 + 16200).toISOString(), durationMs: 16200, accountsChecked: 15380, driftsFound: 1, triggeredBy: "SCHEDULED" },
];

export const formatRelativeTime = (dateString: string) => {
    if (!dateString) return '-';
    const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
    const elapsed = new Date(dateString).getTime() - Date.now();
    const min = Math.round(elapsed / (1000 * 60));
    const hours = Math.round(elapsed / (1000 * 60 * 60));
    const days = Math.round(elapsed / (1000 * 60 * 60 * 24));

    if (Math.abs(min) < 60) return rtf.format(min, 'minute');
    if (Math.abs(hours) < 24) return rtf.format(hours, 'hour');
    return rtf.format(days, 'day');
};

const AdminReconciliationScreen: React.FC = () => {
    const navigate = useNavigate();
    const { showToast } = useToast();
    const [reports, setReports] = useState<ReconReport[]>(mockReports);
    const [statusFilter, setStatusFilter] = useState<string>('ALL');
    const [triggerFilter, setTriggerFilter] = useState<string>('ALL');
    const [onlyWithDrifts, setOnlyWithDrifts] = useState(false);
    const [isRunning, setIsRunning] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    // API Call Preparation (Commented out for production use later)
    /*
    useEffect(() => {
        const fetchReports = async () => {
            setIsLoading(true);
            try {
                const params = new URLSearchParams();
                if (statusFilter !== 'ALL') params.append('status', statusFilter);
                if (triggerFilter !== 'ALL') params.append('triggeredBy', triggerFilter);
                if (onlyWithDrifts) params.append('onlyWithDrifts', 'true');
                params.append('limit', '50');

                // const response = await fetch(`/admin/reconciliation/reports?${params.toString()}`);
                // if (!response.ok) throw new Error('Failed to fetch reports');
                // const data: ReconReport[] = await response.json();
                // setReports(data);
            } catch (error) {
                console.error("Failed to fetch reports:", error);
                showToast('error', 'Failed to load reconciliation reports');
            } finally {
                setIsLoading(false);
            }
        };
        fetchReports();
    }, [statusFilter, triggerFilter, onlyWithDrifts]);
    */

    const handleRunNow = () => {
        setIsRunning(true);
        
        // API Call Preparation (Commented out for production use later)
        /*
        try {
            // const response = await fetch('/admin/reconciliation/run', { method: 'POST' });
            // if (!response.ok) throw new Error('Failed to trigger run');
            // const newRun: ReconReport = await response.json();
            // setReports(prev => [newRun, ...prev]);
            // showToast('success', 'Reconciliation run triggered');
        } catch (error) {
            console.error("Failed to trigger reconciliation:", error);
            showToast('error', 'Failed to start reconciliation run');
        } finally {
            setIsRunning(false);
        }
        */

        // Mock implementation
        setTimeout(() => {
            const newRun: ReconReport = {
                runId: `run_${Date.now()}`,
                status: "COMPLETED",
                startedAt: new Date(Date.now() - 12000).toISOString(),
                finishedAt: new Date().toISOString(),
                durationMs: 12000,
                accountsChecked: 15425,
                driftsFound: Math.random() > 0.7 ? Math.floor(Math.random() * 3) + 1 : 0,
                triggeredBy: "MANUAL"
            };
            setReports(prev => [newRun, ...prev]);
            setIsRunning(false);
            showToast('success', 'Reconciliation run completed');
        }, 2000);
    };

    const filteredReports = reports.filter(r => {
        if (statusFilter !== 'ALL' && r.status !== statusFilter) return false;
        if (triggerFilter !== 'ALL' && r.triggeredBy !== triggerFilter) return false;
        if (onlyWithDrifts && r.driftsFound === 0) return false;
        return true;
    }).sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div>
                    <h3 className="text-xl font-bold mb-2">Past Reconciliation Runs</h3>
                    <p className="text-slate-500 text-sm">Monitor history of internal ledger consistency checks.</p>
                </div>
                <button 
                    onClick={handleRunNow}
                    disabled={isRunning}
                    className="shrink-0 px-5 py-3 bg-primary hover:bg-primary-light text-white rounded-xl font-bold text-sm flex items-center justify-center gap-3 transition-all shadow-lg shadow-primary/30 active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
                >
                    <RefreshCw className={`w-4 h-4 ${isRunning ? 'animate-spin' : ''}`} /> 
                    {isRunning ? 'Running Reconciliation...' : 'Run Reconciliation Now'}
                </button>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm">
                <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-50/50 dark:bg-slate-800/10">
                    <div className="flex items-center gap-2">
                        <Filter className="w-5 h-5 text-slate-400" />
                        <span className="font-bold text-sm text-slate-700 dark:text-slate-200">Filters</span>
                    </div>
                    <div className="flex flex-nowrap gap-4 items-center overflow-x-auto pb-2 sm:pb-0">
                        <div className="w-40">
                            <CustomSelect 
                                value={statusFilter}
                                onChange={setStatusFilter}
                                options={[
                                    { value: 'ALL', label: 'All Statuses' },
                                    { value: 'COMPLETED', label: 'Completed' },
                                    { value: 'RUNNING', label: 'Running' },
                                    { value: 'FAILED', label: 'Failed' },
                                ]}
                            />
                        </div>
                        <div className="w-40">
                            <CustomSelect 
                                value={triggerFilter}
                                onChange={setTriggerFilter}
                                options={[
                                    { value: 'ALL', label: 'All Triggers' },
                                    { value: 'SCHEDULED', label: 'Scheduled' },
                                    { value: 'MANUAL', label: 'Manual' },
                                ]}
                            />
                        </div>
                        <label className="flex items-center gap-2 bg-white dark:bg-slate-800 px-4 py-3 rounded-xl shadow-sm cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors border border-slate-200 dark:border-slate-800">
                            <input 
                                type="checkbox" 
                                checked={onlyWithDrifts}
                                onChange={(e) => setOnlyWithDrifts(e.target.checked)}
                                className="w-4 h-4 text-primary rounded border-slate-300 dark:border-slate-600 focus:ring-primary dark:bg-slate-700"
                            />
                            <span className="text-sm font-semibold whitespace-nowrap">Only with drifts</span>
                        </label>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50 dark:bg-slate-800/50 text-xs uppercase tracking-widest text-slate-400 font-black border-b border-slate-100 dark:border-slate-800">
                                <th className="px-6 py-4">Run ID & Time</th>
                                <th className="px-6 py-4">Status</th>
                                <th className="px-6 py-4">Trigger</th>
                                <th className="px-6 py-4 text-right">Accounts / Duration</th>
                                <th className="px-6 py-4 text-center">Drifts Found</th>
                                <th className="px-6 py-4"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50 text-sm">
                            {filteredReports.map(report => (
                                <tr 
                                    key={report.runId} 
                                    onClick={() => navigate(`/admin/reconciliation/${report.runId}`)}
                                    className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer group"
                                >
                                    <td className="px-6 py-4">
                                        <div className="font-bold text-slate-900 dark:text-white group-hover:text-primary transition-colors">{report.runId}</div>
                                        <div className="text-xs text-slate-500 font-medium" title={new Date(report.startedAt).toLocaleString()}>{formatRelativeTime(report.startedAt)}</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold leading-none ${
                                            report.status === 'COMPLETED' ? 'bg-green-100 text-green-700 dark:bg-green-900/30' :
                                            report.status === 'RUNNING' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 animate-pulse' :
                                            'bg-red-100 text-red-700 dark:bg-red-900/30'
                                        }`}>
                                            {report.status === 'COMPLETED' && <CheckCircle2 className="w-3 h-3" />}
                                            {report.status === 'RUNNING' && <Activity className="w-3 h-3" />}
                                            {report.status === 'FAILED' && <ServerCrash className="w-3 h-3" />}
                                            {report.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="text-slate-600 dark:text-slate-300 font-semibold text-xs tracking-wider uppercase">{report.triggeredBy}</span>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="font-bold text-slate-900 dark:text-white">{report.accountsChecked.toLocaleString()}</div>
                                        <div className="text-xs text-slate-500">{report.durationMs > 0 ? `${(report.durationMs / 1000).toFixed(1)}s` : '-'}</div>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        {report.driftsFound > 0 ? (
                                            <span className="inline-flex items-center justify-center min-w-[2rem] px-2 py-1 bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400 rounded-lg text-xs font-black shadow-sm ring-1 ring-red-200 dark:ring-red-800/50">
                                                <AlertTriangle className="w-3 h-3 mr-1" /> {report.driftsFound}
                                            </span>
                                        ) : (
                                            <span className="text-slate-400 font-medium text-xs">0</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-primary transition-colors inline-block" />
                                    </td>
                                </tr>
                            ))}
                            {filteredReports.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                                        No reconciliation reports match the current filters.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default AdminReconciliationScreen;
