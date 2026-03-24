// retry.producer.ts
import { producer } from "../config/kafka.config";
import { logger } from "@/shared/utils/logger";
import { RetryEnvelope } from "../consumer/helpers/retry.envelope";
import { resolveRetryPolicy } from "../consumer/helpers/retry.policy";

export async function sendToRetry(
  baseTopic: string,
  envelope: RetryEnvelope,
) {

  const { event, meta } = envelope;
  const { levels } = resolveRetryPolicy(envelope.event.aggregateType);

  const retryCount = meta.retryCount ?? 0;

  logger.info(`Sending to retry topic, attempt #${retryCount}`);

  const retryLevel = levels[retryCount];

  if (!retryLevel) {
    logger.error(`No retry level found for retryCount ${retryCount}`);
  }

  const key = envelope.event.eventId || "unknown";

  const nextEnvelope = {
    event,
    meta: {
      ...meta,
      retryCount: retryCount,
      lastError: meta.lastError,
      originalTopic: baseTopic, // preserve the original source
      createdAt: meta.createdAt || new Date().toISOString(),
    },
  };

  // Send to retry topic
  await producer.send({
    topic: retryLevel.topic, //`${baseTopic}.retry`,
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
  logger.warn("Event sent to retry topic");
}
