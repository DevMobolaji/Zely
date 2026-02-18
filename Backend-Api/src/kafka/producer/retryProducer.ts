// retry.producer.ts
import { producer } from "../config/kafka.config";
import { logger } from "@/shared/utils/logger";
import { RetryEnvelope } from "../consumer/retry.envelope"; 
import { AUTH_RETRY_LEVELS } from "../consumer/retry.policy";

export async function sendToRetry(
  baseTopic: string,
  envelope: RetryEnvelope
) {

  envelope.meta.retryCount = (envelope.meta.retryCount || 0) + 1;

  if (envelope.meta.retryCount > AUTH_RETRY_LEVELS.length) {
    logger.warn("sendToRetry called but max retries exceeded, skipping");
    return false;
  }

  const key = envelope.event.eventId || "unknown";

  // Send to retry topic
  await producer.send({
    topic: `${baseTopic}.retry`,
    messages: [
      {
        key,
        value: JSON.stringify(envelope),
        headers: {
          "x-retry-count": String(envelope.meta.retryCount),
          "x-last-error": envelope.meta.lastError || "unknown",
        },
      },
    ],
  });
  logger.warn("Event sent to retry topic");
}
