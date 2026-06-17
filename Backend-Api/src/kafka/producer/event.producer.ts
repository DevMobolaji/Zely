// src/events/publishconfirm.event.ts
import { withKafkaBreaker } from "@/infrastructure/resilience/breakers/kafka.breaker";
import { kafkaMessagesProcessedTotal } from "@/infrastructure/resilience/metrics";
import { producer } from "@/kafka/config";
import { TOPICS } from "@/kafka/config/kafka.topics";
import { RetryEnvelope } from "@/kafka/retry.helpers/retry.envelope";
import { logger } from "@/shared/utils/logger";

export async function onEventConfirmed(
  envelope: RetryEnvelope,
  sourceTopic: string,
  maxAttempts: number = 3,
  baseDelayMs: number = 300,
): Promise<void> {
  const key = envelope.event.eventId || "unknown";
  const value = JSON.stringify(envelope);

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await withKafkaBreaker(async () => {
        await producer.send({
          topic: TOPICS.CONFIRMED_EVENTS, // ← one generic topic
          messages: [
            {
              key,
              value,
              headers: {
                "x-source-topic": sourceTopic,
                "x-aggregate-type": envelope.event.aggregateType ?? "UNKNOWN",
              },
            },
          ],
        });
      }, "publishConfirmedEvent");

      kafkaMessagesProcessedTotal.inc({
        topic: TOPICS.CONFIRMED_EVENTS,
        consumer_group: "event-producer",
      });

      logger.info("Event published to confirmed.events", {
        eventId: envelope.event.eventId,
        aggregateType: envelope.event.aggregateType,
        sourceTopic,
      });
      return;
    } catch (err: any) {
      const isLastAttempt = attempt === maxAttempts;

      if (isLastAttempt) {
        logger.error("Failed to publish confirmed event after all attempts", {
          eventId: envelope.event.eventId,
          error: err.message,
        });
        return;
      }

      const delay = baseDelayMs * 2 ** (attempt - 1);
      logger.warn(`Publish attempt ${attempt} failed, retrying in ${delay}ms`, {
        eventId: envelope.event.eventId,
        error: err.message,
      });
      await new Promise((res) => setTimeout(res, delay));
    }
  }
}

// Keep backward compat — existing transfer consumer still calls this
// export const onTransferSuccess = (envelope: RetryEnvelope) =>
//   onEventConfirmed(envelope, TOPICS.TRANSACTION_EVENTS);
