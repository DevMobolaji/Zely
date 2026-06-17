import {
  completeIdempotency,
  failIdempotency,
  initIdempotency,
} from "@/events/idempotency";
import { withMongoTransaction } from "@/events/mongo.wrapper";
import { processPaymentEvents } from "@/events/payment.events";
import {
  kafkaMessagesFailedTotal,
  kafkaMessagesProcessedTotal,
  kafkaProcessingDuration,
} from "@/infrastructure/resilience/metrics";
import { onEventConfirmed } from "@/kafka/producer/event.producer";
import { PaymentEventSchema } from "@/kafka/schema/payment.schema";
import { logger } from "@/shared/utils/logger";
import { connectAdmin, kafka } from "../config/kafka.config";
import { TOPICS } from "../config/kafka.topics";
import { RetryEnvelope } from "../retry.helpers/retry.envelope";
import { retryOrDLQ } from "../retry.helpers/retry.handler";
import { validateWithSchema } from "../schema/zod.helper";

const PAYMENT_CONSUMER = "payment-consumer";

const paymentConsumer = kafka.consumer({
  groupId: PAYMENT_CONSUMER,
});

export async function runPaymentConsumer() {
  await paymentConsumer.connect();
  await connectAdmin();

  await paymentConsumer.subscribe({
    topic: TOPICS.PAYMENT_EVENTS,
    fromBeginning: false,
  });

  await paymentConsumer.run({
    autoCommit: false,
    partitionsConsumedConcurrently: 3,
    eachMessage: async ({ topic, partition, message }: any) => {
      if (!message.value) return;

      // ✅ Start processing timer
      const timer = kafkaProcessingDuration.startTimer({
        topic,
        consumer_group: PAYMENT_CONSUMER,
      });

      let envelope: RetryEnvelope;
      try {
        const raw = JSON.parse(message.value.toString());

        const parsedPayload =
          typeof raw.payload === "string"
            ? JSON.parse(raw.payload)
            : raw.payload;

        envelope = {
          meta: {
            retryCount: raw.retryCount ?? parsedPayload.meta?.retryCount ?? 0,
            createdAt:
              parsedPayload.meta?.createdAt ?? new Date().toISOString(),
            originalConsumerGroup: PAYMENT_CONSUMER,
            originalTopic: topic,
            lastError: raw.lastError ?? parsedPayload.meta?.lastError,
            processor: "payment",
          },
          event: {
            ...parsedPayload.event,
            action: raw.action,
            status: raw.status,
          },
        };
      } catch (e) {
        logger.error("Failed to parse Kafka message");
        timer(); // end timer on parse failure
        await paymentConsumer.commitOffsets([
          {
            topic,
            partition,
            offset: (parseInt(message.offset) + 1).toString(),
          },
        ]);
        return;
      }

      const validatedEvent = validateWithSchema(
        PaymentEventSchema,
        envelope.event,
      ) as {
        eventId: string;
        eventType: string;
        version: 1;
        aggregateType: string;
        aggregateId: string;
        payload: object;
        occurredAt?: string;
        context: object;
      };

      const validatedEnvelope: RetryEnvelope = {
        meta: envelope.meta,
        event: validatedEvent,
      };

      const IdmChks = await initIdempotency(
        envelope.event.eventId,
        topic,
        PAYMENT_CONSUMER,
        envelope.meta.retryCount,
      );

      if (IdmChks.decision === "SKIP") {
        kafkaMessagesProcessedTotal.inc({
          topic,
          consumer_group: PAYMENT_CONSUMER,
        });
        timer();
        await paymentConsumer.commitOffsets([
          {
            topic,
            partition,
            offset: (parseInt(message.offset) + 1).toString(),
          },
        ]);
        return;
      }

      try {
        await withMongoTransaction(async (session) => {
          const result = await processPaymentEvents(
            topic,
            validatedEnvelope,
            session,
          );

          await completeIdempotency(
            envelope.event.eventId,
            PAYMENT_CONSUMER,
            IdmChks.version,
            session,
            topic,
            envelope.meta.retryCount, // 🔥 ADD THIS
          );

          return result;
        });

        // ✅ Success metrics
        kafkaMessagesProcessedTotal.inc({
          topic,
          consumer_group: PAYMENT_CONSUMER,
        });
        timer();

        await paymentConsumer.commitOffsets([
          {
            topic,
            partition,
            offset: (parseInt(message.offset) + 1).toString(),
          },
        ]);

        logger.info("payment committed successfully");
      } catch (error: any) {
        // ✅ Failure metrics
        kafkaMessagesFailedTotal.inc({
          topic,
          consumer_group: PAYMENT_CONSUMER,
        });
        timer();

        logger.error("payment event processing failed", {
          topic,
          eventId: envelope.event?.eventId,
          error: error.message,
        });
        await failIdempotency(
          envelope.event.eventId,
          PAYMENT_CONSUMER,
          topic,
          envelope.meta.retryCount, // always 0 on the main topic
          IdmChks.version,
        );

        await retryOrDLQ({ topic, message: envelope, error });

        await paymentConsumer.commitOffsets([
          {
            topic,
            partition,
            offset: (parseInt(message.offset) + 1).toString(),
          },
        ]);

        logger.info("Offset committed after failure", {
          eventId: envelope.event?.eventId,
          offset: (parseInt(message.offset) + 1).toString(),
        });
      }
    },
  });
}
