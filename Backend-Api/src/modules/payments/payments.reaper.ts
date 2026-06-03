// src/modules/payments/payment.reaper.ts
import { Queue, Worker } from "bullmq";
import { config } from "@/config/index";
import { logger } from "@/shared/utils/logger";
import {
  PaymentInitialization,
  PaymentInitializationStatus,
} from "./payment.initialization.model";
import PaymentService from "./payment.service";

import { emitOutboxEvent } from "@/infrastructure/helpers/emit.audit.helper";
import { AuditAction, AuditStatus } from "../audit/audit.interface";
import { generateEventId } from "@/shared/utils/id.generator";
import FundingService, {
  FundingSource,
} from "@/modules/fee/funding/funding.service";
import { getActivePaymentProvider } from "@/modules/payments/payment.provider.factory";

// ─── Configuration ─────────────────────────────────────────────────────────
const QUEUE_NAME = "payment-reaper-queue";
const JOB_NAME = "payment-reaper-poll";
//const STUCK_THRESHOLD_MS = 30 * 60 * 1000; // 30 minutes
const MAX_RETRY_ATTEMPTS = 3;
const BATCH_SIZE = 50;

const STUCK_THRESHOLD_MS = 30 * 1000; // 30 seconds for testing

const connection = {
  host: config.redis.host,
  port: config.redis.port,
  password: config.redis.password,
};

export const paymentReaperQueue = new Queue(QUEUE_NAME, { connection });

// ─── Schedule the recurring job ────────────────────────────────────────────
export async function schedulePaymentReaper() {
  // Clean up old schedulers (Mongoose 9 API)
  const schedulers = await paymentReaperQueue.getJobSchedulers();
  for (const scheduler of schedulers) {
    if (scheduler.name === JOB_NAME) {
      await paymentReaperQueue.removeJobScheduler(scheduler.key);
    }
  }

  // Schedule new — runs every 5 minutes
  await paymentReaperQueue.upsertJobScheduler(
    JOB_NAME,
    { pattern: "*/5 * * * *" }, // every 5 minutes
    {
      name: JOB_NAME,
      data: {},
      opts: {
        removeOnComplete: { count: 48 },
        removeOnFail: { count: 50 },
      },
    },
  );

  logger.info("✅ Payment reaper scheduled — runs every 5 minutes");
}

// ─── Worker that executes the reaper ───────────────────────────────────────
export function startPaymentReaperWorker() {
  const fundingService = new FundingService();
  const provider = getActivePaymentProvider();

  const worker = new Worker(
    QUEUE_NAME,
    async (job) => {
      if (job.name !== JOB_NAME) return;

      const startTime = Date.now();
      logger.info("🔄 Payment reaper run started");

      const cutoff = new Date(Date.now() - STUCK_THRESHOLD_MS);

      // Find stuck PENDING payments
      const stuckPayments = await PaymentInitialization.find({
        status: PaymentInitializationStatus.PENDING,
        initiatedAt: { $lt: cutoff },
        retryAttempts: { $lt: MAX_RETRY_ATTEMPTS },
      })
        .limit(BATCH_SIZE)
        .sort({ initiatedAt: 1 }); // oldest first

      if (stuckPayments.length === 0) {
        logger.info("✅ No stuck payments found");
        return { processed: 0 };
      }

      logger.info(`Found ${stuckPayments.length} stuck payments to reconcile`);

      let resolved = 0;
      let stillPending = 0;
      let abandonedFinal = 0;

      for (const payment of stuckPayments) {
        try {
          const result = await processStuckPayment(
            payment,
            provider,
            fundingService,
          );

          if (result === "RESOLVED") resolved++;
          else if (result === "STILL_PENDING") stillPending++;
          else if (result === "ABANDONED_FINAL") abandonedFinal++;
        } catch (err: any) {
          const isTimeout =
            err.code === "ECONNABORTED" || err.message?.includes("timeout");
          const isProviderError = err.response?.status >= 400;

          logger.error("Failed to process stuck payment", {
            reference: payment.reference,
            error: err.message,
            responseData: err.response?.data,
            responseStatus: err.response?.status,
            requestUrl: err.config?.url,
          });

          if (isProviderError) {
            // Real provider rejection — counts as an attempt
            await PaymentInitialization.updateOne(
              { _id: payment._id },
              {
                $inc: { retryAttempts: 1 },
                $set: { lastRetryAt: new Date() },
              },
            );
          }
          // Timeouts and network errors don't burn a retry
          // Continue processing other payments — don't let one failure break the batch
        }
      }

      const durationMs = Date.now() - startTime;
      const summary = {
        totalChecked: stuckPayments.length,
        resolved,
        stillPending,
        abandonedFinal,
        durationMs,
      };

      logger.info("✅ Payment reaper run completed", summary);
      return summary;
    },
    { connection },
  );

  worker.on("completed", (job, result) => {
    logger.info("Payment reaper job completed", { jobId: job.id, ...result });
  });

  worker.on("failed", (job, err) => {
    logger.error("Payment reaper job failed", {
      jobId: job?.id,
      error: err.message,
    });
  });

  return worker;
}

// ─── Process a single stuck payment ────────────────────────────────────────
async function processStuckPayment(
  payment: any,
  provider: ReturnType<typeof getActivePaymentProvider>,
  fundingService: FundingService,
): Promise<"RESOLVED" | "STILL_PENDING" | "ABANDONED_FINAL"> {
  logger.info("Polling provider for stuck payment", {
    reference: payment.reference,
    retryAttempts: payment.retryAttempts,
    minutesPending: Math.floor(
      (Date.now() - payment.initiatedAt.getTime()) / 60000,
    ),
  });

  if (!payment.providerReference) {
    // Provider call never completed — treat as abandoned
    return await handleReaperAbandoned(payment, "NO_PROVIDER_REFERENCE");
  }

  const verifyResult = await provider.verifyTransaction(
    payment.providerReference, // ✅ Paystack's own reference
    payment.clientIdempotencyKey, // ✅ Pass our idempotency key for better tracking
  );

  const syntheticContext = {
    userId: "SYSTEM_PAYMENT_REAPER",
    ip: "127.0.0.1",
    userAgent: "payment-reaper",
  } as any;

  switch (verifyResult.status) {
    case "SUCCESS":
      return await handleReaperSuccess(
        payment,
        fundingService,
        syntheticContext,
      );

    case "FAILED":
      return await handleReaperFailed(payment);

    case "ABANDONED":
      return await handleReaperAbandoned(
        payment,
        "PROVIDER_REPORTED_ABANDONED",
      );

    case "PENDING":
      return await handleReaperStillPending(payment);

    default:
      logger.warn("Unknown verifyTransaction status", {
        reference: payment.reference,
        status: verifyResult.status,
      });
      return "STILL_PENDING";
  }
}

// ─── Handler: payment succeeded (we just discovered it) ────────────────────
async function handleReaperSuccess(
  payment: any,
  fundingService: FundingService,
  context: any,
): Promise<"RESOLVED"> {
  try {
    // Credit the wallet — FundingService is idempotent on transactionRef
    await fundingService.creditFromExternalSource({
      targetWalletId: payment.targetWalletId,
      amount: payment.amount,
      currency: payment.currency,
      source: FundingSource.PAYSTACK_WEBHOOK,
      providerReference: payment.reference,
      initiatedByUserId: payment.initiatedByUserId.toString(),
      context,
      metadata: {
        reaperResolved: true,
        paymentInitializationId: payment._id.toString(),
      },
    });

    // Mark initialization SUCCESS with optimistic lock
    await PaymentInitialization.updateOne(
      {
        _id: payment._id,
        status: PaymentInitializationStatus.PENDING,
      },
      {
        $set: {
          status: PaymentInitializationStatus.SUCCESS,
          completedAt: new Date(),
        },
        $inc: { retryAttempts: 1 },
      },
    );

    // Emit success event
    await emitOutboxEvent({
      topic: "payment.events",
      eventId: generateEventId(),
      eventType: AuditAction.PAYMENT_SUCCEEDED,
      action: AuditAction.PAYMENT_SUCCEEDED,
      status: AuditStatus.PENDING,
      payload: {
        reference: payment.reference,
        providerReference: payment.providerReference,
        amount: payment.amount,
        currency: payment.currency,
        purpose: payment.purpose,
        targetWalletId: payment.targetWalletId,
        userPublicId: payment.initiatedByUserPublicId,
        resolvedBy: "REAPER",
      },
      aggregateType: "PAYMENT_SUCCESS",
      aggregateId: payment.reference,
      version: 1,
      context,
    });

    logger.info("✅ Reaper resolved stuck payment as SUCCESS", {
      reference: payment.reference,
    });

    return "RESOLVED";
  } catch (err: any) {
    logger.error("Reaper failed to credit wallet for resolved payment", {
      reference: payment.reference,
      error: err.message,
    });
    throw err;
  }
}

// ─── Handler: payment failed ───────────────────────────────────────────────
async function handleReaperFailed(payment: any): Promise<"RESOLVED"> {
  await PaymentInitialization.updateOne(
    {
      _id: payment._id,
      status: PaymentInitializationStatus.PENDING,
    },
    {
      $set: {
        status: PaymentInitializationStatus.FAILED,
        completedAt: new Date(),
        failureReason: "REAPER_DETECTED_PROVIDER_FAILURE",
        lastRetryAt: new Date(),
      },
      $inc: { retryAttempts: 1 },
    },
  );

  logger.info("✅ Reaper resolved stuck payment as FAILED", {
    reference: payment.reference,
  });

  return "RESOLVED";
}

// ─── Handler: payment abandoned ────────────────────────────────────────────
async function handleReaperAbandoned(
  payment: any,
  reason: string,
): Promise<"ABANDONED_FINAL"> {
  await PaymentInitialization.updateOne(
    {
      _id: payment._id,
      status: PaymentInitializationStatus.PENDING,
    },
    {
      $set: {
        status: PaymentInitializationStatus.ABANDONED,
        completedAt: new Date(),
        failureReason: reason,
        lastRetryAt: new Date(),
      },
      $inc: { retryAttempts: 1 },
    },
  );

  logger.info("✅ Reaper resolved stuck payment as ABANDONED", {
    reference: payment.reference,
    reason,
  });

  return "ABANDONED_FINAL";
}

// ─── Handler: still pending (bump retry) ───────────────────────────────────
async function handleReaperStillPending(
  payment: any,
): Promise<"STILL_PENDING" | "ABANDONED_FINAL"> {
  const nextAttempt = (payment.retryAttempts ?? 0) + 1;

  if (nextAttempt >= MAX_RETRY_ATTEMPTS) {
    // We've polled the max times — give up, mark ABANDONED
    return await handleReaperAbandoned(
      payment,
      `MAX_RETRIES_EXCEEDED_${MAX_RETRY_ATTEMPTS}`,
    );
  }

  // Bump retry counter, leave PENDING for next cycle
  await PaymentInitialization.updateOne(
    { _id: payment._id },
    {
      $inc: { retryAttempts: 1 },
      $set: { lastRetryAt: new Date() },
    },
  );

  logger.info("Payment still pending after reaper poll", {
    reference: payment.reference,
    retryAttempts: nextAttempt,
  });

  return "STILL_PENDING";
}
