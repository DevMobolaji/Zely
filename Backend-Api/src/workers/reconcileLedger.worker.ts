import { Queue, Worker, Job } from 'bullmq';
import { conn } from '@/workers/bullMq.config';
import { LedgerReconciliationService } from '@/modules/ledger/ledger.reconcilliations';

export const reconciliationQueue = new Queue('ledger-reconciliation', { connection: conn});

// Enqueue wallet IDs
export async function enqueueWalletReconciliation(walletIds: string[]) {
  for (const walletId of walletIds) {
    await reconciliationQueue.add('reconcile-wallet', { walletId });
  }
}

// Worker to process reconciliation jobs
export const reconciliationWorker = new Worker(
  'ledger-reconciliation',
  async (job: Job) => {
    const { walletId } = job.data;
    await LedgerReconciliationService.reconcileWallet(walletId);
  },
  {
    connection: conn,
    // Optional: retry settings
    limiter: { max: 100, duration: 1000 }, // 100 jobs/sec
  }
);

// Optional DLQ / failure handling
reconciliationWorker.on('failed', (job, err) => {
  console.error(`Reconciliation failed for wallet ${job?.data.walletId}: ${err.message}`);
  // Could push to separate failure queue or log in MongoDB
});
