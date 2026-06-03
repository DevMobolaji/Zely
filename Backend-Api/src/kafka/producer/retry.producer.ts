// retry.producer.ts
import { producer } from "../config/kafka.config";
import { logger } from "@/shared/utils/logger";
import { RetryEnvelope } from "../retry.helpers/retry.envelope";
import { resolveRetryPolicy } from "../retry.helpers/retry.policy";
import { withKafkaBreaker } from "@/infrastructure/resilience/breakers/kafka.breaker";
import { kafkaMessagesProcessedTotal } from "@/infrastructure/resilience/metrics";
import { sendToDLQ } from "@/kafka/producer/sendToDlq";

export async function sendToRetry(baseTopic: string, envelope: RetryEnvelope) {
  const { event, meta } = envelope;
  const { levels } = resolveRetryPolicy(envelope.event.aggregateType);

  const retryCount = meta.retryCount ?? 0;

  logger.info(`Sending to retry topic, attempt #${retryCount}`);

  const retryLevel = levels[retryCount];

  if (!retryLevel) {
    logger.error(`No retry level found for retryCount ${retryCount}`, {
      retryCount,
    });
    await sendToDLQ(
      baseTopic,
      envelope,
      new Error(`No retry level at index ${retryCount}`),
    );
    return;
  }

  const key = envelope.event.eventId || "unknown";

  const nextEnvelope = {
    event,
    meta: {
      ...meta,
      retryCount: retryCount,
      lastError: meta.lastError,
      originalTopic: baseTopic,
      createdAt: new Date().toISOString(),
    },
  };

  await withKafkaBreaker(async () => {
    await producer.send({
      topic: retryLevel.topic,
      messages: [
        {
          key,
          value: JSON.stringify(nextEnvelope),
          headers: {
            "x-retry-count": String(nextEnvelope.meta.retryCount),
            "x-last-error": envelope.meta.lastError || "unknown",
          },
        },
      ],
    });
  }, "sendToRetry");

  kafkaMessagesProcessedTotal.inc({
    topic: retryLevel.topic,
    consumer_group: "retry-producer",
  });

  logger.warn("Event sent to retry topic");
}
