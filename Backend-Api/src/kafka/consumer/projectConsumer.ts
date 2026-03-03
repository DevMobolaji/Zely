import { handleTransactionCompleted } from "@/events/projectionEvt";
import { kafka } from "../config/kafka.config";
import { TOPICS } from "../config/topics";
import { RetryEnvelope } from "./helpers/retry.envelope";
import mongoose from "mongoose";

const consumer = kafka.consumer({ groupId: "projection-consumer" });

export async function runProjectionConsumer() {
  await consumer.connect();

  await consumer.subscribe({ topic: TOPICS.TRANSACTION_EVENTS, fromBeginning: false });
  await consumer.subscribe({ topic: TOPICS.VAULT_EVENTS, fromBeginning: false });
  // await consumer.subscribe({ topic: 'ledger.events', fromBeginning: false });


  await consumer.run({
    eachMessage: async ({ topic, message }: {
      topic: string;
      message: any;
    }) => {
      const rawEvent = JSON.parse(message.value.toString());

      const envelope: RetryEnvelope = {
        meta: {
          retryCount: Number(message.headers?.["x-retry-count"] ?? 0),
          createdAt: new Date().toISOString(),
        },
        event: rawEvent.event ? rawEvent.event : rawEvent,
      };

      try {
        await handleTransactionCompleted(topic, envelope)
      } catch (err) {

      }
    }
  })
}