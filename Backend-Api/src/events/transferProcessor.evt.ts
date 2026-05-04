import mongoose from "mongoose";
import { logger } from "@/shared/utils/logger";
import { PermanentError, TransientError } from "@/kafka/retry.helpers/retry.error";
import { RetryEnvelope } from "@/kafka/retry.helpers/retry.envelope";
import { writeToEmailOutbox } from "@/kafka/emails/write.email";


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
        const jobId = `${transactionRef}_${eventType}`;

        if (transferType === "INTERNAL_SYSTEM_TRANSFER") {
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

          logger.info("Internal transfer email written to outbox");
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

        logger.info("Transfer event processing complete");
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