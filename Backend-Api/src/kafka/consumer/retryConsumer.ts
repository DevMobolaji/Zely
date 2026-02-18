// retry.consumer.ts
import mongoose from "mongoose";
import { kafka } from "../config/kafka.config";
import { intIdempotency } from "@/events/idempotency";
import { logger } from "@/shared/utils/logger";
import { RetryEnvelope } from "./retry.envelope";
import { processAuthEvent } from "@/events/authProcessor.evt";
import { retryOrDLQ } from "./retry.handler";
import { validateWithSchema } from "../schema/zod.helper";
import { AuthEventSchema } from "../schema/user.schema";
import { AUTH_MAX_RETRIES, AUTH_RETRY_LEVELS } from "./retry.policy";
import z from "zod";
import { sendToDLQ } from "../producer/sendToDlq";
import { sendToRetry } from "../producer/retryProducer";
import { withMongoTransaction } from "@/events/mongo.wrapper";
import { TOPICS } from "../config/topics";

export const RetryEnvelopeSchema = z.object({
  meta: z.object({
    retryCount: z.number(),
    createdAt: z.string(),
    lastError: z.string().optional(),
  }),
  event: AuthEventSchema,
})


function originalTopicFromRetry(topic: string) {
  return topic.replace(/\.retry$/, "");
}


const retryConsumer = kafka.consumer({ groupId: "auth-retry-consumer" });

function getRetryConfig(retryCount: number) {
  if (retryCount >= AUTH_MAX_RETRIES) return null;

  return AUTH_RETRY_LEVELS[retryCount];
}

export async function runRetryConsumer() {
  await retryConsumer.connect();

  await retryConsumer.subscribe({
    topic: TOPICS.AUTH_EVENTS_RETRY,
    fromBeginning: false,
  });

  await retryConsumer.run({
    autoCommit: false,
    eachMessage: async ({ topic, partition, message }: { topic: string; partition: number; message: any }) => {
      if (!message.value) return;

      const msg = JSON.parse(message.value.toString())

      const envelope: RetryEnvelope = validateWithSchema(
        RetryEnvelopeSchema,
        msg
      );

      const baseTopic = originalTopicFromRetry(topic);

      const retryCount = envelope.meta.retryCount

      const createdAtMs = new Date(envelope.meta.createdAt).getTime();
      const now = Date.now();
      const retryConfig = getRetryConfig(envelope.meta.retryCount);
      if (!retryConfig) {
        await sendToDLQ(
          baseTopic,
          envelope,
          new Error("Max retries reached"),
        );
        logger.error("Retry exhausted, sent to DLQ");

        return;

      }

      const delay = Math.max(retryConfig.delayMs - (now - createdAtMs), 0);

      if (delay > 0) {
        logger.info("Retry cool-down applied");
        await new Promise((resolve) => setTimeout(resolve, delay));
      }

      try {
        await withMongoTransaction(async (session) => {
          const firstTime = await intIdempotency(envelope.event.eventId, session, envelope.event.eventType);
          if (!firstTime) {
            logger.info("Duplicate retry skipped", { eventId: envelope.event.eventId, topic });

            return;
          }
          await processAuthEvent(
            baseTopic,
            envelope,
            session
          );
          await retryConsumer.commitOffsets([{ topic, partition, offset: (parseInt(message.offset) + 1).toString() }]);
          logger.info("Retry processed successfully");
        });
      } catch (error: any) {
        logger.error("Retry processing failed");

        if (retryCount >= AUTH_MAX_RETRIES) {
          await sendToDLQ(baseTopic, envelope, error);
          logger.error("Max retries reached, sent to DLQ");
        } else {
          await sendToRetry(baseTopic, {
            ...envelope,
            meta: {
              ...envelope.meta,
              retryCount: (envelope.meta.retryCount || 0) + 1,
              lastError: error.message,
              createdAt: envelope.meta.createdAt,
            },
          });

          await retryConsumer.commitOffsets([{ topic, partition, offset: (parseInt(message.offset) + 1).toString() }]);
        }
      } 
    },
  });

}



