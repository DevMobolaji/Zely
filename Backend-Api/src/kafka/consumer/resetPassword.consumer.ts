import { kafka } from "../config/kafka.config";
import { initIdempotency, completeIdempotency } from "@/events/idempotency";
import { TOPICS } from "../config/kafka.topics";
import { logger } from "@/shared/utils/logger";
import { RetryEnvelope } from "@/kafka/retry.helpers/retry.envelope";
import { validateWithSchema } from "../schema/zod.helper";
import { AuthEventSchema } from "../schema/user.schema";
import { retryOrDLQ } from "../retry.helpers/retry.handler";
import { resetPasswordProcessor } from "@/events/resetPasswordProcessor.evt";
import {
  kafkaMessagesProcessedTotal,
  kafkaMessagesFailedTotal,
  kafkaProcessingDuration,
} from "@/infrastructure/resilience/metrics";

const AUTH_PASSWORD_RESET_CONSUMER = "resetPassword-consumer";
const resetPasswordConsumer = kafka.consumer({ groupId: AUTH_PASSWORD_RESET_CONSUMER });

export async function runPasswordConsumer() {
  await resetPasswordConsumer.connect();

  await resetPasswordConsumer.subscribe({
    topic: TOPICS.PASSWORD_EVENTS,
    fromBeginning: false,
  });

  await resetPasswordConsumer.run({
    autoCommit: false,
    eachMessage: async ({ topic, partition, message }: { topic: string; partition: number; message: any }) => {
      if (!message.value) return;

      // ✅ Start timer
      const timer = kafkaProcessingDuration.startTimer({
        topic,
        consumer_group: AUTH_PASSWORD_RESET_CONSUMER,
      });

      let envelope: RetryEnvelope;


      try {
        const raw = JSON.parse(message.value.toString());
        const parsedPayload = typeof raw.payload === 'string'
          ? JSON.parse(raw.payload)
          : raw.payload;

        envelope = {
          meta: {
            retryCount: raw.retryCount ?? parsedPayload.meta?.retryCount ?? 0,
            createdAt: parsedPayload.meta?.createdAt ?? new Date().toISOString(),
            originalConsumerGroup: AUTH_PASSWORD_RESET_CONSUMER,
            originalTopic: topic,
            lastError: raw.lastError ?? parsedPayload.meta?.lastError,
            processor: "auth",
          },
          event: {
            ...parsedPayload.event,
            action: raw.action,
            status: raw.status,
          },
        };
      } catch (e) {
        logger.error("Failed to parse Kafka message", { topic, partition, offset: message.offset });
        timer();
        await resetPasswordConsumer.commitOffsets([{
          topic, partition,
          offset: (parseInt(message.offset) + 1).toString(),
        }]);
        return;
      }

      const validatedEvent = validateWithSchema(
        AuthEventSchema,
        envelope.event
      ) as {
        eventId: string;
        eventType: string;
        version: 1;
        aggregateType: string;
        aggregateId: string;
        payload: any;
        occurredAt?: string;
        action: string;
        status: string;
        context: object;
      };

      const validatedEnvelope: RetryEnvelope = {
        meta: envelope.meta,
        event: validatedEvent,
      };

      const IdmChks = await initIdempotency(
        envelope.event.eventId,
        topic,
        AUTH_PASSWORD_RESET_CONSUMER
      );

      if (IdmChks.decision === "SKIP") {
        kafkaMessagesProcessedTotal.inc({
          topic,
          consumer_group: AUTH_PASSWORD_RESET_CONSUMER,
        });
        timer();
        await resetPasswordConsumer.commitOffsets([{
          topic, partition,
          offset: (parseInt(message.offset) + 1).toString(),
        }]);
        return;
      }

      try {

        await resetPasswordProcessor(topic, validatedEnvelope);

        await completeIdempotency(
          envelope.event.eventId,
          AUTH_PASSWORD_RESET_CONSUMER,
          IdmChks.version,
        )

        // ✅ Success metrics
        kafkaMessagesProcessedTotal.inc({ topic, consumer_group: AUTH_PASSWORD_RESET_CONSUMER });
        timer();

        await resetPasswordConsumer.commitOffsets([{
          topic, partition,
          offset: (parseInt(message.offset) + 1).toString(),
        }]);

      } catch (error: any) {
        // ✅ Failure metrics
        kafkaMessagesFailedTotal.inc({ topic, consumer_group: AUTH_PASSWORD_RESET_CONSUMER });
        timer();

        logger.error("Password reset processing failed", {
          topic,
          eventId: envelope.event.eventId,
          error: error.message,
        });

        await retryOrDLQ({ topic, message: envelope, error });

        await resetPasswordConsumer.commitOffsets([{
          topic, partition,
          offset: (parseInt(message.offset) + 1).toString(),
        }]);
      }
    },
  });
}

export async function stopPasswordConsumer() {
  await resetPasswordConsumer.disconnect();
  logger.info("✅ Password consumer disconnected");
}