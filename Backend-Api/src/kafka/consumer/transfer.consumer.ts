import BadRequestError from "@/shared/errors/badRequest";
import { kafka } from "../config/kafka.config";
import { logger } from "@/shared/utils/logger";
import { intIdempotency } from "@/events/idempotency";
import mongoose from "mongoose";
import { TOPICS } from "../config/topics";
import { RetryEnvelope } from "./retry.envelope";
import { validateWithSchema } from "../schema/zod.helper";
import { TransferEventSchema } from "../schema/transfer.schema";
import { retryOrDLQ } from "./retry.handler";
import { processTransferEvents } from "@/events/transferProcessor.evt";

const consumer = kafka.consumer({ groupId: "transfer-consumer" });

export async function runTransferConsumer() {
  await consumer.connect();
  await consumer.subscribe({
    topic: TOPICS.TRANSACTION_EVENTS,
    fromBeginning: false,
  });

  await consumer.run({
    eachMessage: async ({ topic, message }: {
      topic: string;
      message: any;
    }) => {
      if (!message.value) return;
      const rawEvent = JSON.parse(message.value.toString());

      const envelope: RetryEnvelope = {
        meta: {
          retryCount: Number(message.headers?.["x-retry-count"] ?? 0),
          createdAt: new Date().toISOString(),
        },
        event: rawEvent.event ? rawEvent.event : rawEvent,
      };

      const session = await mongoose.startSession();

      try {
        session.startTransaction()

        const firstTime = await intIdempotency(envelope.event.eventId, session, topic);
        if (!firstTime) {
          logger.info("Duplicate transfer event skipped", { eventId: envelope.event.eventId });
          return;
        }

        const validatedEvent = validateWithSchema(TransferEventSchema, envelope.event) as {
          eventId: string;
          eventType: string;
          version: 1;
          aggregateType: string;
          aggregateId: string;
          payload: object;
          occurredAt?: string;
          action: string;
          status: string;
          context: object;
        };

        const validatedEnvelope: RetryEnvelope = {
          meta: envelope.meta,
          event: validatedEvent, // properly validated event
        };

        await processTransferEvents(topic, validatedEnvelope, session);

        //     case TOPICS.TRANSFER_NOTIFICATION:
        //       await emitOutboxEvent(
        //         {
        //           topic: "transfer.completed",
        //           eventId: envelope.event.eventId,
        //           eventType: "TRANSFER_NOTIFICATION",
        //           action: AuditAction.TRANSFER_NOTIFICATION,
        //           status: AuditStatus.SUCCESS,
        //           payload: { userId: envelope.event.payload.fromUserEmail, transactionRef: envelope.event.payload.transactionRef },
        //           aggregateType: "TRANSFER",
        //           aggregateId: envelope.event.payload.fromUserEmail,
        //           version: envelope.event.version,
        //         },
        //         { session }
        //       );
        //       logger.info("Transaction successful,Transfer notification sent successfully");
        //       const { sender, receiver, amount, currency, transactionRef, transferType, referenceId } = payload;

        //       await emailQueue.add("sendTransferEmailDebit", {
        //         recipientEmail: envelope.event.payload.email,
        //         recipientName: envelope.event.payload.name,
        //         amount,
        //         currencySymbol: envelope.event.payload.currency,
        //         previousBalance: envelope.event.payload.previousBalance,
        //         currentBalance: envelope.event.payload.currentBalance,
        //         transactionId: envelope.event.payload.transactionRef,
        //         referenceId: envelope.event.payload.referenceId,
        //         type: "DEBIT",
        //         transferType,
        //         fromAccountType: envelope.event.payload.fromAccountType,
        //         fromAccountLast4: envelope.event.payload.fromAccountLast4,
        //         toAccountType: envelope.event.payload.toAccountType,
        //         toAccountLast4: envelope.event.payload.toAccountLast4,
        //         senderEmail: envelope.event.payload.fromUserEmail,   // actual sender email
        //         senderName: envelope.event.payload.fromUserName      // actual sender name
        //       });

        //       await emailQueue.add("sendTransferEmailCredit", {
        //         recipientEmail: envelope.event.payload.email,
        //         recipientName: envelope.event.payload.name,
        //         amount,
        //         currencySymbol: envelope.event.payload.currency,
        //         previousBalance: envelope.event.payload.previousBalance,
        //         currentBalance: envelope.event.payload.currentBalance,
        //         transactionId: envelope.event.payload.transactionRef,
        //         referenceId: envelope.event.payload.referenceId,
        //         type: "CREDIT",
        //         transferType,
        //         fromAccountType: envelope.event.payload.fromAccountType,
        //         fromAccountLast4: envelope.event.payload.fromAccountLast4,
        //         toAccountType: envelope.event.payload.toAccountType,
        //         toAccountLast4: envelope.event.payload.toAccountLast4,
        //         senderEmail: envelope.event.payload.fromUserEmail,
        //         senderName: envelope.event.payload.fromUserName
        //       });

        //       break;

        //     default:
        //       throw new Error(`Unhandled transfer event: ${envelope.event.eventType}`);
        //   }
        // });
      }
      catch (error: any) {
        if (session.inTransaction()) await session.abortTransaction();
        logger.error("Transfer event processing failed", { topic, eventId: envelope.event.eventId, error: error.message });

        await retryOrDLQ({ topic: envelope.event.eventType, message: envelope, error });
      }
      finally {
        await session.endSession();
      }
    },
  });
}
