// src/modules/reconciliation/reconciliation.scheduler.ts
import { Queue, Worker } from "bullmq";
import { config } from "@/config/index";
import { logger } from "@/shared/utils/logger";
import ReconciliationService from "./reconciliation.service";
import { conn } from "@/workers/bullMq.config";
import { escalateUnresolvedDrifts } from "@/modules/reconciliation/reconciliation.helpers";
import { emitOutboxEvent } from "@/infrastructure/helpers/emit.audit.helper";
import { generateEventId } from "@/shared/utils/id.generator";

const QUEUE_NAME = "reconciliation-queue";
const JOB_NAME = "hourly-reconciliation";
const ESCALATION_JOB_NAME = "drift-escalation-check";

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
    { pattern: "* * * * *" }, //{ pattern: "0 * * * *" }, // top of every hour
    {
      name: JOB_NAME,
      data: {},
      opts: {
        removeOnComplete: { count: 24 },
        removeOnFail: { count: 50 },
      },
    },
  );

  logger.info("✅ Reconciliation cron scheduled — runs every hour");
}

// ─── Worker that processes the job ────────────────────────────────────────
export function startReconciliationWorker() {
  const reconciliationService = new ReconciliationService();

  const worker = new Worker(
    QUEUE_NAME,
    async (job) => {
      const context = {
        userId: "SYSTEM_RECONCILIATION",
        ip: "127.0.0.1",
        userAgent: "scheduler",
      } as any;

      switch (job.name) {
        case JOB_NAME:
          logger.info("🔄 Reconciliation cron triggered");

          return await reconciliationService.reconcileAllAccounts(context, {
            triggeredBy: "SCHEDULED",
            freezeOnDrift: true,
          });

        case ESCALATION_JOB_NAME:
          logger.warn("🚨 Drift escalation triggered");

          return await escalateUnresolvedDrifts(context);

        default:
          logger.warn("Unknown job type", { jobName: job.name });
          return;
      }
    },
    { connection },
  );

  worker.on("completed", (job, result) => {
    logger.info("✅ Reconciliation job completed", {
      jobId: job.id,
      ...result,
    });
  });

  worker.on("failed", async (job, err) => {
    logger.error("❌ Reconciliation job failed", {
      jobId: job?.id,
      error: err.message,
    });

    await emitOutboxEvent({
      topic: "reconciliation.events",
      eventId: generateEventId(),
      eventType: "RECONCILIATION_CRON_FAILED",
      action: "RECONCILIATION_CRON_FAILED" as any, //keep this as any for now
      status: "FAILED" as any, //keep this as any for now
      payload: {
        error: err.message,
        jobId: job?.id,
        failedAt: new Date(),
      },
      aggregateType: "RECONCILIATION_FAILURE",
      aggregateId: job?.id ?? "unknown",
      version: 1,
      context: {
        userId: "SYSTEM_RECONCILIATION",
        ip: "127.0.0.1",
        userAgent: "scheduler",
      },
    });
  });

  return worker;
}

export async function scheduleDriftEscalation() {
  await reconciliationQueue.upsertJobScheduler(
    ESCALATION_JOB_NAME,
    { pattern: "0 9 * * *" }, // every day at 9am
    {
      name: ESCALATION_JOB_NAME,
      data: {},
      opts: {
        removeOnComplete: { count: 7 },
        removeOnFail: { count: 10 },
      },
    },
  );

  logger.info("✅ Drift escalation check scheduled — runs daily at 9am");
}
