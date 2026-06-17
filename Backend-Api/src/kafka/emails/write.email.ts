import { logger } from "@/shared/utils/logger";
import { EmailOutboxModel } from "./email.Outbox";
import { RetryEnvelope } from "../retry.helpers/retry.envelope";
import mongoose from "mongoose";

/** -------------------------
 * WRITE TO EMAIL OUTBOX
 * Writes email intent to MongoDB inside the caller's session.
 * The poller picks it up and dispatches to BullMQ.
 * jobId unique constraint prevents duplicate outbox records on replay.
 * ------------------------- */

export async function writeToEmailOutbox(
  {
    jobName,
    payload,
    jobId,
    eventId,
    transactionRef,
    aggregateType,
    envelope,
  }: {
    jobName: string;
    payload: Record<string, any>;
    jobId: string;
    eventId: string;
    transactionRef?: string;
    aggregateType: string;
    envelope: RetryEnvelope;
  },
  session: mongoose.ClientSession,
): Promise<void> {
  try {
    await EmailOutboxModel.create(
      [
        {
          jobName,
          payload,
          jobId,
          eventId,
          transactionRef,
          aggregateType,
          envelope,
          status: "PENDING",
        },
      ],
      { session },
    );
  } catch (err: any) {
    // Duplicate jobId — outbox record already exists from a previous attempt
    // This is safe to skip — the poller will dispatch it
    if (err.code === 11000) {
      logger.warn("Email outbox record already exists, skipping", {
        jobId,
        eventId,
      });
      return;
    }
    throw err;
  }
}
