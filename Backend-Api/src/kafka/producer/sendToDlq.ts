import { producer } from "../config";
import { logger } from "@/shared/utils/logger";
import { RetryEnvelope } from "../retry.helpers/retry.envelope";
import { withKafkaBreaker } from "@/infrastructure/resilience/breakers/kafka.breaker";
import { kafkaMessagesFailedTotal } from "@/infrastructure/resilience/metrics";

export async function sendToDLQ(
  baseTopic: string,
  envelope: RetryEnvelope,
  error: Error,
) {
  const key = envelope.event.eventId || "unknown";
  const dlqTopic = `${baseTopic}.dlq`;

  try {
    await withKafkaBreaker(async () => {
      await producer.send({
        topic: dlqTopic,
        messages: [
          {
            key,
            value: JSON.stringify(envelope),
            headers: {
              "x-error": error.message,
              "x-failed-at": new Date().toISOString(),
              "x-retry-count": String(envelope.meta.retryCount ?? 0),
            },
          },
        ],
      });
    }, "sendToDLQ");

    kafkaMessagesFailedTotal.inc({
      topic: dlqTopic,
      consumer_group: "dlq-producer",
    });

    logger.error("Event sent to DLQ", {
      eventId: envelope.event.eventId,
      topic: dlqTopic,
      error: error.message,
    });
  } catch (dlqErr: any) {
    // DLQ publish failed — this is the last resort
    // Log everything so nothing is silently lost
    logger.error("CRITICAL: Failed to send event to DLQ — Kafka circuit open", {
      eventId: envelope.event.eventId,
      originalTopic: baseTopic,
      dlqTopic,
      originalError: error.message,
      dlqError: dlqErr.message,
      envelope: JSON.stringify(envelope),
    });
    // Don't throw — we've logged everything needed for manual recovery
  }
}
