import { handleTransactionCompleted } from "@/events/projectionEvt";
import { kafka } from "../config/kafka.config";
import { TOPICS } from "../config/topics";
import { RetryEnvelope } from "./helpers/retry.envelope";
import mongoose from "mongoose";

const PROJECTION_CONSUMER_GROUP = "projection-consumer";

const consumer = kafka.consumer({ groupId: PROJECTION_CONSUMER_GROUP });

export async function runProjectionConsumer() {
  await consumer.connect();

  await consumer.subscribe({ topic: TOPICS.TRANSACTION_EVENTS, fromBeginning: false });
  await consumer.subscribe({ topic: TOPICS.VAULT_EVENTS, fromBeginning: false });

  await consumer.run({
    eachMessage: async ({ topic, message }: {topic: string, message: any }) => {
      const rawEvent = JSON.parse(message.value.toString());

      const envelope: RetryEnvelope = rawEvent.meta
        ? rawEvent
        : {
          meta: {
            retryCount: Number(message.headers?.["x-retry-count"] ?? 0),
            createdAt: new Date().toISOString(),
            originalConsumerGroup: PROJECTION_CONSUMER_GROUP, // ✅ FIXED
          },
          event: rawEvent.event ?? rawEvent,
        };

      try {
        await handleTransactionCompleted(topic, envelope);
      } catch (err) {
        // await retryOrDLQ({
        //   topic,
        //   message: envelope,
        //   error,
        //   consumerGroup: PROJECTION_CONSUMER_GROUP,
        // });
        // send to retryOrDLQ here (missing currently)
      }
    },
  });
}