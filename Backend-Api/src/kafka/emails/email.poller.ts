import { logger } from "@/shared/utils/logger";
import { EmailOutboxModel } from "./email.Outbox";
import emailQueue from "@/infrastructure/queues/email.queue";
import { Counter, Gauge, Histogram, Pushgateway, Registry } from "prom-client";
// import { emailOutboxPendingCount } from "@/infrastructure/resilience/metrics";
const workerRegistry = new Registry();

const MAX_ATTEMPTS = 5;
const POLL_INTERVAL_MS = 5_000;
const STUCK_PROCESSING_THRESHOLD_MS = 2 * 60 * 1000;

// ─── Email Metrics ────────────────────────────────────────────────────────────
export const emailOutboxPendingCount = new Gauge({
  name: 'email_outbox_pending_count',
  help: 'Number of pending records in the email outbox',
  registers: [workerRegistry],
});

export const emailSendTotal = new Counter({
  name: 'email_send_total',
  help: 'Total email send attempts',
  labelNames: ['status', 'job_name'], // success | failure
  registers: [workerRegistry],
});

export const emailSendDuration = new Histogram({
  name: 'email_send_duration_ms',
  help: 'Duration of email send operations in milliseconds',
  labelNames: ['job_name'],
  buckets: [100, 250, 500, 1000, 2000, 5000],
  registers: [workerRegistry],
});

// ─── Pushgateway ──────────────────────────────────────────────────────────────
const gateway = new Pushgateway(process.env.PUSHGATEWAY_URL || 'http://localhost:9091', [], workerRegistry);

async function pushMetrics(): Promise<void> {
  try {
    await gateway.pushAdd({ jobName: "email-worker" });
  } catch (err: any) {
    console.error("❌ Pushgateway push failed:", err.message);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function pollOnce(): Promise<void> {
  // ✅ Update pending count metric on every poll cycle
  const pendingCount = await EmailOutboxModel.countDocuments({
    status: { $in: ["PENDING", "PROCESSING"] },
  });
  //console.log(`Email outbox pending/processing count: ${pendingCount}`);
  emailOutboxPendingCount.set(pendingCount);

  while (true) {
    const job = await EmailOutboxModel.findOneAndUpdate(
      {
        $or: [
          { status: "PENDING" },
          {
            status: "PROCESSING",
            claimedAt: {
              $lt: new Date(Date.now() - STUCK_PROCESSING_THRESHOLD_MS),
            },
          },
        ],
        attempts: { $lt: MAX_ATTEMPTS },
      },
      {
        $set: {
          status: "PROCESSING",
          claimedAt: new Date(),
        },
      },
      {
        new: true,
        sort: { createdAt: 1 },
      }
    );

    if (!job) break;

    try {
      await emailQueue.add(job.jobName, job.payload, {
        jobId: job.jobId,
      });

      await EmailOutboxModel.updateOne(
        { _id: job._id },
        {
          $set: {
            status: "SENT",
            sentAt: new Date(),
          },
        }
      );

      logger.info("Email outbox job dispatched", {
        jobId: job.jobId,
        jobName: job.jobName,
        eventId: job.eventId,
        transactionRef: job.transactionRef,
      });

    } catch (err: any) {
      const nextAttempts = job.attempts + 1;
      const exhausted = nextAttempts >= MAX_ATTEMPTS;

      await EmailOutboxModel.updateOne(
        { _id: job._id },
        {
          $set: {
            status: exhausted ? "FAILED" : "PENDING",
            lastError: err.message,
            claimedAt: undefined,
          },
          $inc: { attempts: 1 },
        }
      );

      if (exhausted) {
        logger.error("Email outbox job exhausted all attempts", {
          jobId: job.jobId,
          jobName: job.jobName,
          eventId: job.eventId,
          transactionRef: job.transactionRef,
          lastError: err.message,
        });
      } else {
        logger.warn("Email outbox job dispatch failed, will retry", {
          jobId: job.jobId,
          jobName: job.jobName,
          attempts: nextAttempts,
          lastError: err.message,
        });
      }
    }
  }
}

async function startEmailOutboxPoller(): Promise<void> {
  logger.info("Email outbox poller started");

  while (true) {
    try {
      await pollOnce();

      await pushMetrics();
      setInterval(pushMetrics, 15_000);
    } catch (err: any) {
      logger.error("Email outbox poller iteration failed", {
        error: err.message,
      });
    }

    await sleep(POLL_INTERVAL_MS);
  }
}

export { startEmailOutboxPoller };