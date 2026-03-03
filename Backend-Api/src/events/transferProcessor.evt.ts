
import mongoose from "mongoose";
import emailQueue from "@/infrastructure/queues/email.queue";
import { logger } from "@/shared/utils/logger";
import { PermanentError, TransientError } from "@/kafka/consumer/helpers/retry.error";


interface TransferEmailJobData {
  email: string;
  name: string;
  amount: number;
  currency: string;
  fromUserEmail: string;
  fromUserId: string;
  toUserId: string;
  fromAccountType: string,
  toAccountType: string,
  fromAccountLast4: string,
  toAccountLast4: string,
  previousBalance: number;
  currentBalance: number;
  toPreviousBalance: number,
  toCurrentBalance: number,
  referenceId: string;
  referenceType: string;
  transactionRef: string;
  type: string;
  transferType: string
  transactionId: string
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
        if (transferType === "INTERNAL_TRANSFER") {
          await emailQueue.add('transferCompleted', {
            email: receiver.email,
            name: receiver.name,
            amount: amount as number,
            currency: currency,
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
            referenceId: referenceId,
            referenceType: transferType,
            transactionRef: transactionRef,
            type: "INTERNAL_TRANSFER",
            transferType: payload.transferType
          } as TransferEmailJobData);

          logger.info("Internal Transfer completed successfully");
        } else if (transferType === "P2P_TRANSFER") {
          // For sender
          await emailQueue.add("sendTransferEmail", {
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
            senderName: sender.name
          });

          // For receiver
          await emailQueue.add("sendTransferEmail", {
            recipientEmail: receiver.email,
            recipientName: receiver.name,
            amount,
            currencySymbol: currency,
            previousBalance: receiver.previousBalance,
            currentBalance: receiver.currentBalance,
            transactionId: transactionRef,
            referenceId: referenceId,
            type: "CREDIT",
            transferType,
            fromAccountType: sender.accountType,
            fromAccountLast4: sender.accountNumber.slice(-4),
            toAccountType: receiver.accountType,
            toAccountLast4: receiver.accountNumber.slice(-4),
            senderEmail: sender.email,
            senderName: sender.name
          });

          logger.info("P2P transfer completed successfully");
        }

        logger.info("Transfer completed notification sent");

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

