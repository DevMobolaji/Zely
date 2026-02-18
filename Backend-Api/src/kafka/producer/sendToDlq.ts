// dlq.producer.ts
import { producer } from "../config";
import { logger } from "@/shared/utils/logger";
import { RetryEnvelope } from "../consumer/retry.envelope";

export async function sendToDLQ(
  baseTopic: string,
  envelope: RetryEnvelope,
  error: Error
) {
  const key = envelope.event.eventId || "unknown";

  await producer.send({
    topic: `${baseTopic}.dlq`, // final sink per original topic
    messages: [
      {
        key,
        value: JSON.stringify(envelope), // full object
        headers: {
          "x-error": error.message,
          "x-failed-at": new Date().toISOString(),
          "x-retry-count": String(envelope.meta.retryCount ?? 0),
        },
      },
    ],
  });

  logger.error("Event sent to DLQ");
}

