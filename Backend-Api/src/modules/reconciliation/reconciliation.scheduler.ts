// src/modules/reconciliation/reconciliation.scheduler.ts
import { Queue, Worker } from "bullmq";
import { config } from "@/config/index";
import { logger } from "@/shared/utils/logger";
import ReconciliationService from "./reconciliation.service";
import { conn } from "@/workers/bullMq.config"

const QUEUE_NAME = "reconciliation-queue";
const JOB_NAME = "hourly-reconciliation";

const connection = conn;

export const reconciliationQueue = new Queue(QUEUE_NAME, { connection });

export async function scheduleReconciliation() {
  // Remove any existing schedulers to avoid duplicates on restart
  const schedulers = await reconciliationQueue.getJobSchedulers();
  for (const scheduler of schedulers) {
    if (scheduler.name === JOB_NAME) {
      await reconciliationQueue.removeJobScheduler(scheduler.key);
    }
  }

  // Schedule new recurring job — runs every hour
  await reconciliationQueue.upsertJobScheduler(
    JOB_NAME,
    { pattern: "0 * * * *" }, // top of every hour
    {
      name: JOB_NAME,
      data: {},
      opts: {
        removeOnComplete: { count: 24 },
        removeOnFail: { count: 50 },
      },
    }
  );

  logger.info("✅ Reconciliation cron scheduled — runs every hour");
}

// ─── Worker that processes the job ────────────────────────────────────────
export function startReconciliationWorker() {
  const reconciliationService = new ReconciliationService();

  const worker = new Worker(
    QUEUE_NAME,
    async (job) => {
      if (job.name !== JOB_NAME) return;

      logger.info("🔄 Reconciliation cron triggered");

      // Build a synthetic context for scheduled runs
      const context = {
        userId: "SYSTEM_RECONCILIATION",
        ip: "127.0.0.1",
        userAgent: "reconciliation-scheduler",
      } as any;

      try {
        const result = await reconciliationService.reconcileAllAccounts(context, {
          triggeredBy: "SCHEDULED",
          freezeOnDrift: true,
        });

        return {
          runId: result.runId,
          accountsChecked: result.accountsChecked,
          driftsFound: result.driftsFound,
          durationMs: result.durationMs,
        };
      } catch (err: any) {
        logger.error("❌ Scheduled reconciliation failed", { error: err.message });
        throw err;
      }
    },
    { connection }
  );

  worker.on("completed", (job, result) => {
    logger.info("✅ Reconciliation job completed", { jobId: job.id, ...result });
  });

  worker.on("failed", (job, err) => {
    logger.error("❌ Reconciliation job failed", { jobId: job?.id, error: err.message });
  });

  return worker;
}