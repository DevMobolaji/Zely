import { EmailOutboxModel } from "@/kafka/emails/email.Outbox";
import { logger } from "@/shared/utils/logger";
import { Queue, Worker } from "bullmq";
import mongoose from "mongoose";
import { Counter, Gauge, Histogram, Pushgateway, Registry } from "prom-client";
import { EmailService } from "../infrastructure/helpers/email.service.helper";
import { EMAIL_QUEUE } from "../infrastructure/queues/email.queue";
import { conn } from "./bullMq.config";
import { config } from "@/config/index";

console.log("🔥 EMAIL WORKER FILE LOADED");

const workerRegistry = new Registry();

// ─── Worker-local metrics ─────────────────────────────────────────────────────
// Defined here, registered only on workerRegistry — isolated from the main app.
const bullmqJobTotal = new Counter({
  name: "bullmq_job_total",
  help: "Total BullMQ jobs processed",
  labelNames: ["queue", "status"] as const,
  registers: [workerRegistry],
});

const bullmqJobDuration = new Histogram({
  name: "bullmq_job_duration_ms",
  help: "Duration of BullMQ job processing in milliseconds",
  labelNames: ["queue"] as const,
  buckets: [50, 100, 250, 500, 1000, 2000, 5000],
  registers: [workerRegistry],
});

const bullmqQueueDepth = new Gauge({
  name: "bullmq_queue_depth",
  help: "Number of waiting jobs in the BullMQ queue",
  labelNames: ["queue"] as const,
  registers: [workerRegistry],
});

// ─── Pushgateway ──────────────────────────────────────────────────────────────
const gateway = new Pushgateway(
  process.env.PUSHGATEWAY_URL || "http://pushgateway:9091",
  [],
  workerRegistry,
);

async function pushMetrics(): Promise<void> {
  try {
    await gateway.pushAdd({ jobName: "bull-mq-worker" });
  } catch (err: any) {
    console.error("❌ Pushgateway push failed:", err.message);
  }
}

// ─── Bootstrap
//────────────────────────────────────────────────────────────────
async function bootstrap(): Promise<void> {
  const connection = conn;

  const emailQueueRef = new Queue(EMAIL_QUEUE, { connection });

  /** -------------------------
   * CONNECT TO MONGODB
   * ------------------------- */
  await mongoose.connect(config.database.mongodb.uri);
  logger.info("worker connected to MongoDB");

  // ─── Worker ──────────────────────────────────────────────────────────────
  const emailWorker = new Worker(
    EMAIL_QUEUE,
    async (job) => {
      const timer = bullmqJobDuration.startTimer({ queue: EMAIL_QUEUE });

      // console.log("🟢 Processing job", job.id, "| type:", job.data?.type);

      const {
        email,
        name,
        otp,
        expiresAt,
        type,
        amount,
        currency,
        currencySymbol,
        previousBalance,
        currentBalance,
        transactionId,
        referenceId,
        referenceType,
        transactionRef,
        expiryMinutes,
        transferType,
        fromAccountType,
        fromAccountLast4,
        toAccountType,
        toAccountLast4,
        senderEmail,
        senderName,
        recipientEmail,
        recipientName,
        toPreviousBalance,
        toCurrentBalance,
      } = job.data;

      const transactionDate = new Date().toLocaleString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZoneName: "short",
      });

      const formattedExpiry = new Date(expiresAt).toLocaleString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZoneName: "short",
      });

      const transactionLink = `${process.env.APP_URL}/transactions/${transactionRef}`;

      const debitParams = {
        recipientEmail,
        recipientName,
        amount,
        currencySymbol,
        transactionLink,
        previousBalance,
        type,
        newBalance: currentBalance,
        transactionId,
        referenceId,
        referenceType,
        transferType,
        toAccountType,
        toAccountLast4,
        transactionDate,
      };

      const creditParams = {
        recipientEmail,
        recipientName,
        amount,
        currencySymbol,
        senderEmail,
        senderName,
        transactionLink,
        previousBalance,
        newBalance: currentBalance,
        transactionId,
        referenceId,
        referenceType,
        type,
        transactionDate,
      };

      const internalTransferParams = {
        recipientEmail: email,
        recipientName: name,
        amount,
        currencySymbol: currency,
        fromAccountType,
        toAccountType,
        fromAccountLast4,
        toAccountLast4,
        toPreviousBalance,
        toNewBalance: toCurrentBalance,
        fromPreviousBalance: previousBalance,
        fromNewBalance: currentBalance,
        transactionId,
        referenceId,
        transactionDate: new Date().toISOString(),
        type,
        transactionLink,
        transferType,
      };

      if (type === "TRANSFER" && (!email || !name)) {
        throw new Error("Invalid job data: missing recipient email or name");
      }

      try {
        switch (type) {
          case "VERIFICATION":
          case "EMAIL_VERIFICATION":
            if (!otp)
              throw new Error("OTP is required for verification emails");
            await EmailService.sendVerificationEmail(
              email,
              name,
              otp,
              formattedExpiry,
              {
                idempotencyKey: job.id,
              },
            );
            break;

          case "WELCOME":
            await EmailService.sendWelcomeEmail(
              email,
              name,
              { idempotencyKey: job.id }, // This prevent the email from sending twice if the job is retried, since the email service will check if an email with the same idempotencyKey was already sent
            );
            break;

          case "PASSWORD_RESET_REQUEST":
            await EmailService.sendPasswordResetEmail(
              email,
              name,
              otp,
              expiryMinutes,
              { idempotencyKey: job.id },
            );
            break;

          case "PASSWORD_RESET_SUCCESS":
            await EmailService.sendPasswordResetSuccessEmail(email, name, {
              idempotencyKey: job.id,
            });
            break;

          case "INTERNAL_TRANSFER":
          case "INTERNAL_TRANSFER":
            await EmailService.sendInternalTransferNotifications(
              internalTransferParams,
              {
                idempotencyKey: job.id,
              },
            );
            break;

          case "DEBIT":
            await EmailService.sendDebitNotification(debitParams, {
              idempotencyKey: job.id,
            });
            break;

          case "CREDIT":
            await EmailService.sendCreditNotification(creditParams, {
              idempotencyKey: job.id,
            });
            break;

          default:
            throw new Error(`Unknown email type: ${type}`);
        }
        const outboxId = job.data._id;

        try {
          const normalizedOutboxId =
            mongoose.Types.ObjectId.createFromHexString(outboxId);

          const result = await EmailOutboxModel.updateOne(
            { _id: normalizedOutboxId },
            { $set: { status: "DELIVERED", deliveredAt: new Date() } },
          );

          if (result.matchedCount === 0) {
            logger.error("Outbox document not found for delivered job", {
              jobId: job.id,
              outboxId,
            });
          }
        } catch (outboxErr: any) {
          // ⚠️ Email sent — do NOT rethrow. Retrying would duplicate the send.
          // Poller's STUCK_ENQUEUED_THRESHOLD will re-dispatch if doc stays
          // ENQUEUED too long, but idempotencyKey blocks duplicate sends anyway.
          logger.error(
            "Failed to mark outbox DELIVERED — email was already sent",
            {
              jobId: job.id,
              outboxId,
              error: outboxErr.message,
            },
          );
        }

        bullmqJobTotal.inc({ queue: EMAIL_QUEUE, status: "success" });
        timer();
      } catch (err: any) {
        bullmqJobTotal.inc({ queue: EMAIL_QUEUE, status: "failure" });
        timer();
        throw err; // rethrow so BullMQ marks the job as failed
      }
    },
    {
      connection,
      concurrency: 10,
      autorun: true,
      limiter: { max: 10, duration: 1000 },
      removeOnComplete: { count: 1000 },
      removeOnFail: { count: 500 },
    },
  );

  // ─── Queue depth polling ────────────────────────────────────────────────
  setInterval(async () => {
    try {
      const waiting = await emailQueueRef.getWaitingCount();
      bullmqQueueDepth.set({ queue: EMAIL_QUEUE }, waiting);
    } catch {
      // non-critical
    }
  }, 30_000);

  // ─── Worker event hooks ─────────────────────────────────────────────────
  emailWorker.on("failed", (job, err) => {
    console.error("❌ Job failed:", job?.id, err.message);
  });

  emailWorker.on("error", (err) => {
    console.error("❌ Worker error:", err.message);
  });

  // ─── Start pushing metrics ──────────────────────────────────────────────
  // Push immediately so Prometheus doesn't see a cold-start gap,
  // then every 15s. At this point workerRegistry only has 3 metrics —
  // no bleed from main app registry.
  await pushMetrics();
  setInterval(pushMetrics, 15_000);

  console.log("✅ Email worker bootstrapped");
}

bootstrap().catch((err) => {
  console.error("❌ Worker startup failed:", err);
  process.exit(1);
});
