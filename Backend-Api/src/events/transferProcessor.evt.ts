
import mongoose from "mongoose";
import { RetryEnvelope } from "@/kafka/consumer/retry.envelope";
import { PermanentError, TransientError } from "@/kafka/consumer/retry.error";
import emailQueue from "@/infrastructure/queues/email.queue";
import { logger } from "@/shared/utils/logger";
import { emitOutboxEvent } from "@/infrastructure/helpers/emit.audit.helper";
import { AuditAction, AuditStatus } from "@/modules/audit/audit.interface";

interface TransferEmailJobData {
  email: string;
  name: string;
  amount: number;
  currency: string;
  fromUserEmail: string;
  fromUserId: string;
  toUserId: string;
  previousBalance: number;
  currentBalance: number;
  referenceId: string;
  referenceType: string;
  transactionRef: string;
  type: string;
}

export async function processTransferEvents(
  topic: string,
  envelope: any,
  session: mongoose.ClientSession) {

  const { payload, version, eventType } = envelope.event;
  const { transactionRef, sender, receiver, amount, currency, transferType, referenceId } = payload 

  try {
    if (version !== 1) {
      throw new PermanentError(`Unsupported event version: ${version}`);
    }

    if (!topic.startsWith("transaction.")) {
      throw new PermanentError(`Unsupported topic: ${topic}`);
    }

    if (!transactionRef || !sender || !receiver || !amount || !currency) {
      throw new PermanentError(`Missing required field for TRANSFER_COMPLETED`);
    }

    switch (eventType) {
      case "TRANSACTION_COMPLETED":
        if(transferType === "INTERNAL_TRANSFER"){
          await emailQueue.add('transferCompleted', {
            email: receiver.email,
            name: receiver.name,
            amount: amount as number,
            currency: currency,
            fromUserEmail: sender.email,
            fromUserId: sender.userId,
            previousBalance: sender.previousBalance,
            currentBalance: sender.currentBalance,
            referenceId: referenceId,
            referenceType: transferType,
            transactionRef: transactionRef,
            type: "INTERNAL_TRANSFER",
          } as TransferEmailJobData);

          logger.info("Internal Transfer completed successfully");
        }
        
        logger.info("Transfer completed notification sent", {
          transactionRef,
          senderEmail: sender.email,
          receiverEmail: receiver.email,
        });

        break;

      case "TRANSFER_FAILED": {
        // 🔹 Send failure notification
        await emailQueue.add("transferFailed", {
          transactionRef,
          reason: payload.reason,
          type: "TRANSFER_FAILED",
        });

        logger.warn("Transfer failed notification sent", {
          transactionRef,
          reason: payload.reason,
        });

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
      `[v${version}] Transfer processor failed: ${err.message}`
    );
  }
}

