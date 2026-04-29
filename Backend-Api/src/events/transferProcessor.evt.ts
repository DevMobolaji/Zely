import mongoose from "mongoose";
import { logger } from "@/shared/utils/logger";
import { PermanentError, TransientError } from "@/kafka/retry.helpers/retry.error";
import { RetryEnvelope } from "@/kafka/retry.helpers/retry.envelope";
import { producer } from "@/kafka/config/kafka.config";
import { TOPICS } from "@/kafka/config/kafka.topics";
import { EmailOutboxModel } from "@/kafka/emails/email.Outbox";


/** -------------------------
 * PUBLISH TO CONFIRMED TOPIC
 * Retries inline with exponential backoff.
 * Only routes to DLQ after exhausting all attempts.
 * ------------------------- */

import { withKafkaBreaker } from '@/infrastructure/resilience/breakers/kafka.breaker';
import { kafkaMessagesProcessedTotal } from '@/infrastructure/resilience/metrics';

export async function publishConfirmedEvent(
  envelope: RetryEnvelope,
  maxAttempts = 3,
  baseDelayMs = 300
): Promise<void> {
  const key = envelope.event.eventId || "unknown";
  const value = JSON.stringify(envelope);

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await withKafkaBreaker(async () => {
        await producer.send({
          topic: TOPICS.CONFIRMED_TRANSFER_EVENTS,
          messages: [
            {
              key,
              value,
              headers: {
                "x-source-topic": TOPICS.TRANSACTION_EVENTS,
              },
            },
          ],
        });
      }, 'publishConfirmedEvent');

      kafkaMessagesProcessedTotal.inc({
        topic: TOPICS.CONFIRMED_TRANSFER_EVENTS,
        consumer_group: 'transfer-producer',
      });

      logger.info("Event published to confirmed.transfer.events", {
        eventId: envelope.event.eventId,
      });
      return;

    } catch (err: any) {
      const isLastAttempt = attempt === maxAttempts;

      if (isLastAttempt) {
        logger.error("Failed to publish confirmed event after all attempts", {
          eventId: envelope.event.eventId,
          error: err.message,
        });
        // Don't throw — outbox pattern guarantees eventual delivery
        // Debezium will pick up the outbox record and route it when Kafka recovers
        return;
      }

      const delay = baseDelayMs * 2 ** (attempt - 1);
      logger.warn(`Publish attempt ${attempt} failed, retrying in ${delay}ms`, {
        eventId: envelope.event.eventId,
        error: err.message,
      });
      await new Promise((res) => setTimeout(res, delay));
    }
  }
}
/** -------------------------
 * WRITE TO EMAIL OUTBOX
 * Writes email intent to MongoDB inside the caller's session.
 * The poller picks it up and dispatches to BullMQ.
 * jobId unique constraint prevents duplicate outbox records on replay.
 * ------------------------- */

async function writeToEmailOutbox(
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
  session: mongoose.ClientSession
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
      { session }
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

/** -------------------------
 * PROCESS TRANSFER EVENTS
 * ------------------------- */
export async function processTransferEvents(
  topic: string,
  envelope: RetryEnvelope,
  session: mongoose.ClientSession
) {
  const { payload, version, eventType, eventId } = envelope.event as any;
  const {
    transactionRef,
    sender,
    receiver,
    amount,
    currency,
    transferType,
    referenceId,
  } = payload;

  try {
    /** -------------------------
   * GUARDS
   * ------------------------- */
    if (version !== 1) {
      throw new PermanentError(`Unsupported event version: ${version}`);
    }

    if (!topic.startsWith("transaction.")) {
      throw new PermanentError(`Unsupported topic: ${topic}`);
    }

    if (!transactionRef || !sender || !receiver || !amount || !currency) {
      throw new PermanentError(`Missing required fields for ${eventType}`);
    }

    if (amount === 5) {
      throw new TransientError("Simulated transient error for testing retries");
    }

    /** -------------------------
     * EVENT ROUTING
     * ------------------------- */
    switch (eventType) {
      case "TRANSACTION_COMPLETED": {
        const jobId = `${transactionRef}:${eventType}`;

        if (transferType === "INTERNAL_TRANSFER") {
          await writeToEmailOutbox(
            {
              jobName: "transferCompleted",
              payload: {
                email: receiver.email,
                name: receiver.name,
                amount,
                currency,
                fromUserEmail: sender.email,
                fromUserId: sender.userId,
                fromAccountType: sender.accountType,
                toAccountType: receiver.accountType,
                fromAccountLast4: sender.accountNumber,
                toAccountLast4: receiver.accountNumber,
                previousBalance: sender.previousBalance,
                currentBalance: sender.currentBalance,
                toPreviousBalance: receiver.previousBalance,
                toCurrentBalance: receiver.currentBalance,
                transactionId: transactionRef,
                referenceId,
                referenceType: transferType,
                transactionRef,
                type: "INTERNAL_TRANSFER",
                transferType,
              },
              jobId,
              eventId,
              transactionRef,
              aggregateType: "TRANSFER",
              envelope,
            },
            session
          );

          logger.info("Internal transfer email written to outbox", {
            transactionRef,
          });
        } else if (transferType === "P2P_TRANSFER") {
          // Sender email
          await writeToEmailOutbox(
            {
              jobName: "sendTransferEmail",
              payload: {
                recipientEmail: sender.email,
                recipientName: sender.name,
                amount,
                currencySymbol: currency,
                previousBalance: sender.previousBalance,
                currentBalance: sender.currentBalance,
                transactionId: transactionRef,
                referenceId,
                type: "DEBIT",
                transferType,
                fromAccountType: sender.accountType,
                fromAccountLast4: sender.accountNumber.slice(-4),
                toAccountType: receiver.accountType,
                toAccountLast4: receiver.accountNumber.slice(-4),
                senderEmail: sender.email,
                senderName: sender.name,
              },
              jobId: `${jobId}:sender`,
              eventId,
              transactionRef,
              aggregateType: "TRANSFER",
              envelope,
            },
            session
          );

          // Receiver email
          await writeToEmailOutbox(
            {
              jobName: "sendTransferEmail",
              payload: {
                recipientEmail: receiver.email,
                recipientName: receiver.name,
                amount,
                currencySymbol: currency,
                previousBalance: receiver.previousBalance,
                currentBalance: receiver.currentBalance,
                transactionId: transactionRef,
                referenceId,
                type: "CREDIT",
                transferType,
                fromAccountType: sender.accountType,
                fromAccountLast4: sender.accountNumber.slice(-4),
                toAccountType: receiver.accountType,
                toAccountLast4: receiver.accountNumber.slice(-4),
                senderEmail: sender.email,
                senderName: sender.name,
              },
              jobId: `${jobId}:receiver`,
              eventId,
              transactionRef,
              aggregateType: "TRANSFER",
              envelope,
            },
            session
          );

          logger.info("P2P transfer emails written to outbox");
        } else {
          throw new PermanentError(`Unsupported transferType: ${transferType}`);
        }

        logger.info("Transfer event processing complete", { transactionRef });
        break;
      }

      case "TRANSFER_FAILED": {
        await writeToEmailOutbox(
          {
            jobName: "transferFailed",
            payload: {
              transactionRef,
              reason: payload.reason,
              type: "TRANSFER_FAILED",
            },
            jobId: `${transactionRef}:${eventType}`,
            eventId,
            transactionRef,
            aggregateType: "TRANSFER",
            envelope,
          },
          session
        );

        logger.warn("Transfer failed email written to outbox", {
          transactionRef,
          reason: payload.reason,
        });

        // ✅ No publish to confirmed topic — failed transfers have nothing to project
        break;
      }

      default:
        throw new PermanentError(`Unhandled eventType: ${eventType}`);
    }
  } catch (err: any) {
    if (err instanceof PermanentError || err instanceof TransientError) {
      throw err;
    }

    throw new TransientError(
      `[v${version}] transfer event failed: ${err.message}`
    );
  }

}