import BadRequestError from "@/shared/errors/badRequest";
import { kafka } from "../config/kafka.config";
import { logger } from "@/shared/utils/logger";
import { intIdempotency } from "@/events/idempotency";
import mongoose from "mongoose";
import { TOPICS } from "../config/topics";
import { RetryEnvelope } from "./helpers/retry.envelope";
import { validateWithSchema } from "../schema/zod.helper";
import { TransferEventSchema } from "../schema/transfer.schema";
import { retryOrDLQ } from "./helpers/retry.handler";
import { processTransferEvents } from "@/events/transferProcessor.evt";

const TRANSFER_CONSUMER_GROUP = "transfer-consumer";
const transferConsumer = kafka.consumer({ groupId: TRANSFER_CONSUMER_GROUP });

export async function runTransferConsumer() {
  await transferConsumer.connect();
  await transferConsumer.subscribe({
    topic: TOPICS.TRANSACTION_EVENTS,
    fromBeginning: false,
  });

  await transferConsumer.run({
    eachMessage: async ({ topic, message }: {
      topic: string;
      message: any;
    }) => {
      if (!message.value) return;
      const rawEvent = JSON.parse(message.value.toString());

      const envelope: RetryEnvelope = rawEvent.meta ? rawEvent : {
        meta: {
          retryCount: Number(message.headers?.["x-retry-count"] ?? 0),
          createdAt: new Date().toISOString(),
          originalConsumerGroup: TRANSFER_CONSUMER_GROUP,
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
