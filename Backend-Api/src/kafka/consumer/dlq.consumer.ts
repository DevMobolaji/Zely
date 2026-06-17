// dlq.consumer.ts
import { kafka } from "../config/kafka.config";
import { initFailedEvents } from "@/events/idempotency";
import { logger } from "@/shared/utils/logger";
import { TOPICS } from "../config/kafka.topics";
import {
  kafkaMessagesProcessedTotal,
  kafkaMessagesFailedTotal,
  kafkaProcessingDuration,
} from "@/infrastructure/resilience/metrics";

export const DLQ_CONSUMER_GROUP = "generic-dlq-sink";
const dlqConsumer = kafka.consumer({ groupId: DLQ_CONSUMER_GROUP });

export async function startDLQSink() {
  const failedCollection = await initFailedEvents();

  const DLQ_TOPICS = [
    TOPICS.AUTH_EVENTS_DLQ,
    TOPICS.TRANSFER_EVENTS_DLQ,
    TOPICS.FUNDING_EVENT_DLQ,
    TOPICS.KYC_EVENTS_DLQ,
    TOPICS.PAYMENT_EVENTS_DLQ,
    TOPICS.VAULT_EVENTS_DLQ,
    TOPICS.WALLET_EVENTS_DLQ,
    TOPICS.AUDIT_EVENTS_DLQ,
    TOPICS.RECONCILIATION_EVENTS_DLQ,
  ];

  for (const topic of DLQ_TOPICS) {
    await dlqConsumer.subscribe({ topic, fromBeginning: false });
  }

  await dlqConsumer.run({
    autoCommit: false,
    eachMessage: async ({
      topic,
      partition,
      message,
    }: {
      topic: string;
      partition: number;
      message: any;
    }) => {
      const commitOffset = async () => {
        await dlqConsumer.commitOffsets([
          { topic, partition, offset: (Number(message.offset) + 1).toString() },
        ]);
      };

      // ✅ Start processing timer
      const timer = kafkaProcessingDuration.startTimer({
        topic,
        consumer_group: DLQ_CONSUMER_GROUP,
      });

      try {
        const raw = message.value?.toString();
        if (!raw) return await commitOffset();

        const payload = JSON.parse(raw);

        // Idempotent insert
        await failedCollection.updateOne(
          { "payload.eventId": payload.event?.eventId },
          {
            $setOnInsert: {
              topic,
              key: message.key?.toString() ?? null,
              payload,
              headers: Object.fromEntries(
                Object.entries(message.headers ?? {}).map(([k, v]) => [
                  k,
                  v?.toString(),
                ]),
              ),
              error: payload.meta?.lastError || payload.error || "unknown",
              failedAt: new Date(),
            },
          },
          { upsert: true },
        );

        logger.error("Stored failed event");

        // ✅ Success metrics
        kafkaMessagesProcessedTotal.inc({
          topic,
          consumer_group: DLQ_CONSUMER_GROUP,
        });
        timer();

        await commitOffset();
      } catch (err) {
        logger.error("Failed DLQ write (manual intervention required)", err);
        // ✅ Failure metrics
        kafkaMessagesFailedTotal.inc({
          topic,
          consumer_group: DLQ_CONSUMER_GROUP,
        });
        timer();
        await commitOffset(); // still commit to prevent blocking the consumer
      }
    },
  });
}

export async function stopDLQSink() {
  await dlqConsumer.disconnect();
  logger.info("✅ DLQ sink disconnected");
}
