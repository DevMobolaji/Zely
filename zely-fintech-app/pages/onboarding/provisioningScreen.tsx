import React, { useState, useEffect, useRef } from 'react';
import ProvisioningStepper, { ProvisioningStatus } from '@/components/provisioning/provisioningStepper';
import ProvisioningError from '@/components/provisioning/provisioningError';
import ProvisioningSuccess from '@/components/provisioning/provisioningSuccess';
import { authService } from '@/services/auth.services';
import { useToast } from '@/context/ToastContext';
import { Cpu, Activity } from 'lucide-react';

const MAX_POLL_DURATION = 60000; // 60 seconds
const INITIAL_POLL_INTERVAL = 2000; // 2 seconds

const ProvisioningScreen: React.FC = () => {
  const { showToast } = useToast();

  // State
  const [currentStatus, setCurrentStatus] = useState<ProvisioningStatus>('ACCOUNT_PROVISION_STARTED');
  const [accountDetails, setAccountDetails] = useState<{ checking: string, savings: string } | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);
  const [failureReason, setFailureReason] = useState<string | undefined>();
  const [isTimedOut, setIsTimedOut] = useState(false);

  // Polling Refs
  const pollCountRef = useRef(0);
  const startTimeRef = useRef(Date.now());
  const timeoutIdRef = useRef<any>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const cleanup = () => {
    if (timeoutIdRef.current) clearTimeout(timeoutIdRef.current);
    if (abortControllerRef.current) abortControllerRef.current.abort();
  };

  const poll = async () => {
    // 1. Safety: Check total duration
    const elapsed = Date.now() - startTimeRef.current;
    if (elapsed > MAX_POLL_DURATION) {
      setIsTimedOut(true);
      return;
    }

    // 2. Setup AbortController for this request
    abortControllerRef.current = new AbortController();

    try {
      const data = await authService.getProvisioningStatus(abortControllerRef.current.signal);
      const status: ProvisioningStatus = data.status;

      setCurrentStatus(status);

      // 3. Termination logic
      if (status === 'ACCOUNT_READY') {
        setAccountDetails({
          checking: data.checkingAccount || '0000 0000 0000',
          savings: data.savingsAccount || '0000 0000 0000'
        });
        return;
      }

      if (status === 'PROVISION_FAILED') {
        setFailureReason(data.reason);
        return;
      }

      // 4. Schedule next poll with backoff
      pollCountRef.current += 1;
      let interval = INITIAL_POLL_INTERVAL;

      // Exponential backoff after 10 attempts
      if (pollCountRef.current > 10) {
        interval = Math.min(10000, INITIAL_POLL_INTERVAL * Math.pow(1.5, pollCountRef.current - 10));
      }

      timeoutIdRef.current = setTimeout(poll, interval);

    } catch (error: any) {
      if (error.name === 'AbortError') return;

      console.error("Provisioning poll error:", error);
      // Network error? Retry with a conservative delay
      timeoutIdRef.current = setTimeout(poll, 5000);
    }
  };

  useEffect(() => {
    poll();
    return cleanup;
  }, []);

  const handleRetry = async () => {
    setIsRetrying(true);
    try {
      await authService.retryProvisioning();

      // Reset polling state
      cleanup();
      pollCountRef.current = 0;
      startTimeRef.current = Date.now();
      setIsTimedOut(false);
      setFailureReason(undefined);
      setCurrentStatus('ACCOUNT_PROVISION_STARTED');

      poll();
      showToast('success', 'Restarting account infrastructure setup...');
    } catch (e: any) {
      const msg = e.response?.data?.message || 'Unable to initiate retry. Please check your connection.';
      showToast('error', msg);
    } finally {
      setIsRetrying(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-slate-50 dark:bg-black flex flex-col items-center justify-center p-6 transition-colors duration-500 relative overflow-hidden font-sans">
      {/* Technical Grid Background */}
      <div className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: 'linear-gradient(to right, rgba(128, 128, 128, 0.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(128, 128, 128, 0.05) 1px, transparent 1px)',
          backgroundSize: '40px 40px'
        }}
      ></div>

      {/* Header / Brand */}
      <div className="absolute top-8 left-8 flex items-center gap-2">
        <div className="w-8 h-8 bg-slate-900 dark:bg-white rounded-lg flex items-center justify-center">
          <Activity className="w-4 h-4 text-white dark:text-slate-900" />
        </div>
        <span className="font-bold text-lg tracking-tight text-slate-900 dark:text-white">Zely<span className="opacity-50">.provision</span></span>
      </div>

      <div className="max-w-3xl w-full relative z-10">
        {currentStatus === 'ACCOUNT_READY' && accountDetails ? (
          <ProvisioningSuccess accountDetails={accountDetails} />
        ) : currentStatus === 'PROVISION_FAILED' ? (
          <ProvisioningError
            reason={failureReason}
            onRetry={handleRetry}
            isRetrying={isRetrying}
          />
        ) : (
          <div className="flex flex-col items-center text-center animate-in fade-in duration-700 slide-in-from-bottom-4">

            {/* Central Status Indicator */}
            <div className="mb-12 relative">
              <div className="w-24 h-24 rounded-full border-4 border-slate-200 dark:border-slate-800 flex items-center justify-center relative">
                <div className="absolute inset-0 rounded-full border-4 border-primary border-t-transparent animate-spin"></div>
                <Cpu className="w-8 h-8 text-slate-400 dark:text-slate-600" />
              </div>
              <div className="absolute -bottom-12 left-1/2 -translate-x-1/2 whitespace-nowrap">
                <p className="text-xs font-mono text-primary animate-pulse">PROCESSING_REQUEST</p>
              </div>
            </div>

            <h1 className="text-4xl md:text-5xl font-bold text-slate-900 dark:text-white mb-6 tracking-tight">
              Setting up your workspace
            </h1>

            <p className="text-slate-500 dark:text-slate-400 text-lg max-w-lg mx-auto mb-16 leading-relaxed">
              We are allocating your secure ledger and initializing your dedicated banking infrastructure.
            </p>

            {/* System Log / Stepper */}
            <div className="w-full max-w-lg bg-white dark:bg-slate-900/50 backdrop-blur-sm border border-slate-200 dark:border-slate-800 rounded-2xl p-8 shadow-xl shadow-slate-200/50 dark:shadow-none">
              <ProvisioningStepper currentStatus={currentStatus} />
            </div>

            {isTimedOut && (
              <div className="mt-8 p-4 bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-100 dark:border-yellow-800/30 rounded-xl animate-in zoom-in-95 duration-300 max-w-md">
                <p className="text-xs font-bold text-yellow-700 dark:text-yellow-500 leading-relaxed">
                  This is taking longer than usual. Please refresh if it persists.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ProvisioningScreen;