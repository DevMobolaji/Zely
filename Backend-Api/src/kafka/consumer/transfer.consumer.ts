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
import { withMongoTransaction } from "@/events/mongo.wrapper";

const TRANSFER_CONSUMER_GROUP = "transfer-consumer";
const transferConsumer = kafka.consumer({ groupId: TRANSFER_CONSUMER_GROUP });

export async function runTransferConsumer() {
  await transferConsumer.connect();
  await transferConsumer.subscribe({
    topic: TOPICS.TRANSACTION_EVENTS,
    fromBeginning: false,
  });

  await transferConsumer.run({
    autoCommit: false,
    eachMessage: async ({ topic, partition, message }: {
      topic: string;
      partition: number,
      message: any;
    }) => {
      if (!message.value) return;
      const rawEvent = JSON.parse(message.value.toString());

      const envelope: RetryEnvelope = {
        meta: {
          retryCount: Number(message.headers?.["x-retry-count"] ?? rawEvent.meta?.retryCount ?? 0),
          createdAt: rawEvent.meta?.createdAt ?? new Date().toISOString(),
          originalConsumerGroup: TRANSFER_CONSUMER_GROUP,
          originalTopic: topic,
          lastError: rawEvent.meta?.lastError,
        },
        event: rawEvent.event ?? rawEvent,
      };

      try {

        await withMongoTransaction(async (session) => {

          const firstTime = await intIdempotency(
            envelope.event.eventId, 
            session, 
            topic, 
            TRANSFER_CONSUMER_GROUP
          );

          if (firstTime === "SKIP") {
            await session.abortTransaction();
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
        })

        await transferConsumer.commitOffsets([
          {
            topic,
            partition,
            offset: (parseInt(message.offset) + 1).toString(),
          },
        ]);
      }
      catch (error: any) {
        logger.error("Transfer event processing failed", { topic, eventId: envelope.event.eventId, error: error.message });

        await retryOrDLQ({ topic, message: envelope, error });
      }
      
      await transferConsumer.commitOffsets([
        {
          topic,
          partition,
          offset: (parseInt(message.offset) + 1).toString(),
        },
      ]);

    },
  });
}
