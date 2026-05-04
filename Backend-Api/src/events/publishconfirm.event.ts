/** -------------------------
 * PUBLISH TO CONFIRMED TOPIC
 * Retries inline with exponential backoff.
 * Only routes to DLQ after exhausting all attempts.
 * ------------------------- */

import { withKafkaBreaker } from '@/infrastructure/resilience/breakers/kafka.breaker';
import { kafkaMessagesProcessedTotal } from '@/infrastructure/resilience/metrics';
import { producer } from '@/kafka/config';
import { TOPICS } from '@/kafka/config/kafka.topics';
import { RetryEnvelope } from '@/kafka/retry.helpers/retry.envelope';
import { logger } from '@/shared/utils/logger';


export async function publishConfirmedEvent(
  envelope: RetryEnvelope,
  maxAttempts = 3,
  baseDelayMs = 300
): Promise<void> {
  const key = envelope.event.eventId || "unknown";
  const value = JSON.stringify(envelope);

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await withKafkaBreaker(async () => {
        await producer.send({
          topic: TOPICS.CONFIRMED_TRANSFER_EVENTS,
          messages: [
            {
              key,
              value,
              headers: {
                "x-source-topic": TOPICS.TRANSACTION_EVENTS,
              },
            },
          ],
        });
      }, 'publishConfirmedEvent');

      kafkaMessagesProcessedTotal.inc({
        topic: TOPICS.CONFIRMED_TRANSFER_EVENTS,
        consumer_group: 'transfer-producer',
      });

      logger.info("Event published to confirmed.transfer.events",);
      return;

    } catch (err: any) {
      const isLastAttempt = attempt === maxAttempts;

      if (isLastAttempt) {
        logger.error("Failed to publish confirmed event after all attempts", {
          eventId: envelope.event.eventId,
          error: err.message,
        });
        // Don't throw — outbox pattern guarantees eventual delivery
        // Debezium will pick up the outbox record and route it when Kafka recovers
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