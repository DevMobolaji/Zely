// funding.consumer.ts
import { processFundingEvents } from "@/events/fundingProcessor.evt";
import {
  completeIdempotency,
  failIdempotency,
  initIdempotency,
} from "@/events/idempotency";
import { withMongoTransaction } from "@/events/mongo.wrapper";
import {
  kafkaMessagesFailedTotal,
  kafkaMessagesProcessedTotal,
  kafkaProcessingDuration,
} from "@/infrastructure/resilience/metrics";
import { onEventConfirmed } from "@/kafka/producer/event.producer";
import { logger } from "@/shared/utils/logger";
import { kafka } from "../config/kafka.config";
import { TOPICS } from "../config/kafka.topics";
import { RetryEnvelope } from "../retry.helpers/retry.envelope";
import { retryOrDLQ } from "../retry.helpers/retry.handler";
import { validateWithSchema } from "../schema/zod.helper";
import { FundingEventSchema } from "@/kafka/schema/funding.schema";

const FUNDING_CONSUMER_GROUP = "funding-consumer";

const consumer = kafka.consumer({ groupId: FUNDING_CONSUMER_GROUP });

export async function runFundingConsumer() {
  await consumer.connect();

  await consumer.subscribe({
    topic: TOPICS.FUNDING_EVENTS,
    fromBeginning: false,
  });

  await consumer.run({
    autoCommit: false,
    eachMessage: async ({ topic, partition, message }: any) => {
      if (!message.value) return;

      const timer = kafkaProcessingDuration.startTimer({
        topic,
        consumer_group: FUNDING_CONSUMER_GROUP,
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
            originalConsumerGroup: FUNDING_CONSUMER_GROUP,
            originalTopic: topic,
            lastError: raw.lastError ?? parsedPayload.meta?.lastError,
            processor: "funding",
          },
          event: {
            ...parsedPayload.event,
            action: raw.action,
            status: raw.status,
          },
        };
      } catch {
        logger.error("Failed to parse funding Kafka message", {
          topic,
          partition,
        });
        timer();
        await consumer.commitOffsets([
          {
            topic,
            partition,
            offset: (parseInt(message.offset) + 1).toString(),
          },
        ]);
        return;
      }

      let validatedEnvelope: RetryEnvelope;
      try {
        const validatedEvent = validateWithSchema(
          FundingEventSchema,
          envelope.event,
        );
        validatedEnvelope = { meta: envelope.meta, event: validatedEvent };
      } catch {
        logger.warn("Skipping invalid funding event", {
          eventType: envelope.event?.eventType,
        });
        timer();
        await consumer.commitOffsets([
          {
            topic,
            partition,
            offset: (parseInt(message.offset) + 1).toString(),
          },
        ]);
        return;
      }

      const IdmChks = await initIdempotency(
        envelope.event.eventId,
        topic,
        FUNDING_CONSUMER_GROUP,
        envelope.meta.retryCount,
      );

      if (IdmChks.decision === "SKIP") {
        kafkaMessagesProcessedTotal.inc({
          topic,
          consumer_group: FUNDING_CONSUMER_GROUP,
        });
        timer();
        await consumer.commitOffsets([
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
          await processFundingEvents(topic, validatedEnvelope, session);
          await completeIdempotency(
            envelope.event.eventId,
            FUNDING_CONSUMER_GROUP,
            IdmChks.version,
            session,
            topic,
            envelope.meta.retryCount,
          );
        });

        kafkaMessagesProcessedTotal.inc({
          topic,
          consumer_group: FUNDING_CONSUMER_GROUP,
        });
        timer();
        await consumer.commitOffsets([
          {
            topic,
            partition,
            offset: (parseInt(message.offset) + 1).toString(),
          },
        ]);

        logger.info("funding committed successfully");

        await onEventConfirmed(validatedEnvelope, TOPICS.FUNDING_EVENTS);
      } catch (error: any) {
        kafkaMessagesFailedTotal.inc({
          topic,
          consumer_group: FUNDING_CONSUMER_GROUP,
        });
        timer();

        logger.error("funding processing failed", {
          topic,
          eventId: envelope.event?.eventId,
          error: error.message,
        });

        await failIdempotency(
          envelope.event.eventId,
          FUNDING_CONSUMER_GROUP,
          topic,
          envelope.meta.retryCount,
          IdmChks.version,
        );

        await retryOrDLQ({ topic, message: envelope, error });
        await consumer.commitOffsets([
          {
            topic,
            partition,
            offset: (parseInt(message.offset) + 1).toString(),
          },
        ]);
      }
    },
  });
}

export async function stopFundingConsumer() {
  try {
    await consumer.disconnect();
    logger.info("✅ Funding consumer disconnected");
  } catch (err) {
    logger.error("Funding consumer disconnect error", err);
  }
}
