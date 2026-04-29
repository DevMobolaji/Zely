// src/modules/reconciliation/reconciliation.scheduler.ts
import { Queue, Worker } from "bullmq";
import { config } from "@/config/index";
import { logger } from "@/shared/utils/logger";
import ReconciliationService from "./reconciliation.service";

const QUEUE_NAME = "reconciliation-queue";
const JOB_NAME = "hourly-reconciliation";

const connection = {
  host: config.redis.host,
  port: config.redis.port,
  password: config.redis.password,
};

export const reconciliationQueue = new Queue(QUEUE_NAME, { connection });

// ─── Schedule the recurring job ───────────────────────────────────────────
export async function scheduleReconciliation() {
  // Remove any existing repeatable jobs to avoid duplicates on restart
  const repeatables = await reconciliationQueue.getRepeatableJobs();
  for (const job of repeatables) {
    if (job.name === JOB_NAME) {
      await reconciliationQueue.removeRepeatableByKey(job.key);
    }
  }

  // Schedule new job — runs every hour
  await reconciliationQueue.add(
    JOB_NAME,
    {},
    {
      repeat: { pattern: "0 * * * *" }, // top of every hour
      removeOnComplete: { count: 24 },  // keep last 24 successful runs
      removeOnFail: { count: 50 },
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