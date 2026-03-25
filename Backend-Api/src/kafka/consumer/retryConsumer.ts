// retry.consumer.ts
import mongoose from "mongoose";
import { kafka } from "../config/kafka.config";
import { intIdempotency } from "@/events/idempotency";
import { logger } from "@/shared/utils/logger";
import { RetryEnvelope } from "./helpers/retry.envelope";
import { processAuthEvent } from "@/events/authProcessor.evt";
import { validateWithSchema } from "../schema/zod.helper";
import { AuthEventSchema } from "../schema/user.schema";
import { AUTH_MAX_RETRIES, AUTH_RETRY_LEVELS, TRANSFER_MAX_RETRIES, TRANSFER_RETRY_LEVELS } from "./helpers/retry.policy";
import z from "zod";
import { sendToDLQ } from "../producer/sendToDlq";
import { sendToRetry } from "../producer/retryProducer";
import { withMongoTransaction } from "@/events/mongo.wrapper";
import { TOPICS } from "../config/topics";
import { TransferEventSchema } from "../schema/transfer.schema";
import { processTransferEvents } from "@/events/transferProcessor.evt";
import emailQueue from "@/infrastructure/queues/email.queue";

export const RetryEnvelopeSchema = z.object({
  meta: z.object({
    retryCount: z.number(),
    createdAt: z.string(),
    lastError: z.string().optional(),
    originalConsumerGroup: z.string().optional(),
    originalTopic: z.string(),
  }),
  event: z.union([AuthEventSchema, TransferEventSchema]),
})


function originalTopicFromRetry(topic: string) {
  return topic.replace(/\.retry$/, "");
}

function resolveProcessorAndRetry(event: any) {
  switch (event.aggregateType) {
    case "USER":
      return { processor: processAuthEvent, retryLevels: AUTH_RETRY_LEVELS, maxRetries: AUTH_MAX_RETRIES }
    case "TRANSACTION":
      return { processor: processTransferEvents, retryLevels: TRANSFER_RETRY_LEVELS, maxRetries: TRANSFER_MAX_RETRIES };
    default:
      throw new Error(`Unsupported aggregateType: ${event.aggregateType}`);
  }
}

const retryConsumer = kafka.consumer({ groupId: "generic-retry-consumer" });
const AUTH_RETRY_TOPICS = AUTH_RETRY_LEVELS.map(l => l.topic);
const TRANSFER_RETRY_TOPICS = TRANSFER_RETRY_LEVELS.map(l => l.topic);

export async function runRetryConsumer() {
  await retryConsumer.connect();

  const allRetryTopics = [...AUTH_RETRY_TOPICS, ...TRANSFER_RETRY_TOPICS];

  for (const topic of allRetryTopics) {
    await retryConsumer.subscribe({ topic, fromBeginning: true });
  }


  await retryConsumer.run({
    autoCommit: false,
    eachMessage: async ({ topic, partition, message }: { topic: string; partition: number; message: any }) => {
      if (!message.value) return;

      const msg = JSON.parse(message.value.toString())

      const envelope: RetryEnvelope = validateWithSchema(
        RetryEnvelopeSchema,
        msg
      );

      console.log("Envelope", envelope)

      const originalBaseTopic = envelope.meta.originalTopic || originalTopicFromRetry(topic);

      const retryCount = envelope.meta.retryCount
      const consumerGroup = envelope.meta.originalConsumerGroup;

      if (!consumerGroup) {
        logger.error("Missing originalConsumerGroup — cannot guarantee idempotency");
      }
      

      const { processor, retryLevels, maxRetries } = resolveProcessorAndRetry(envelope.event);

      const createdAtMs = new Date(envelope.meta.createdAt).getTime();
      const now = Date.now();

      const nextRetryCount = (envelope.meta.retryCount || 0) + 1;

      if (nextRetryCount >= maxRetries) {
        await sendToDLQ(
          originalBaseTopic,
          envelope,
          new Error("Max retries reached")
        );

        logger.error("Retry exhausted, sent to DLQ", {
          eventId: envelope.event.eventId,
          retryCount,
        });

        await retryConsumer.commitOffsets([
          {
            topic,
            partition,
            offset: (parseInt(message.offset) + 1).toString(),
          },
        ]);

        return;
      }
      const retryConfig = retryLevels[nextRetryCount] ?? null

      if (!retryConfig) {
        await sendToDLQ(
          originalBaseTopic,
          envelope,
          new Error("Max retries reached"),
        );
        logger.error("Retry exhausted, sent to DLQ");

        return;

      }

      const delay = Math.max(retryConfig.delayMs - (now - createdAtMs), 0);

      if (delay > 0) {
        logger.info("Retry cool-down applied", { delay });
        await new Promise((resolve) => setTimeout(resolve, delay));
      }

      let result: any = null;

      try {
        result = await withMongoTransaction(async (session) => {

          const firstTime = await intIdempotency(
            envelope.event.eventId,
            session,
            topic,
            consumerGroup
          );

          if (firstTime === "SKIP") {
            await session.abortTransaction();
            return;
          }
          return await processor(originalBaseTopic, envelope, session);
        });

        if (result?.email) {
          await emailQueue.add("sendWelcomeEmail", {
            email: result.email,
            name: result.name,
            type: "WELCOME",
          });
          logger.info("Welcome email sent after retry");
        }
      
        await retryConsumer.commitOffsets([{ topic, partition, offset: (parseInt(message.offset) + 1).toString() }]);

        logger.info("Retry processed successfully");

      } catch (error: any) {
        logger.error("Retry processing failed", {
          error: error.message,
        });

        if (nextRetryCount >= maxRetries) {
          await sendToDLQ(originalBaseTopic, envelope, error);
          logger.error("Max retries reached, sent to DLQ");

          await retryConsumer.commitOffsets([{ topic, partition, offset: (parseInt(message.offset) + 1).toString() }]);

          return;

        } else {
          await sendToRetry(originalBaseTopic, {
            ...envelope,
            meta: {
              ...envelope.meta,
              retryCount: nextRetryCount,
              lastError: error.message,
              createdAt: envelope.meta.createdAt,
            }
          });

          await retryConsumer.commitOffsets([{ topic, partition, offset: (parseInt(message.offset) + 1).toString() }]);
        }

      }
    },
  });

}
