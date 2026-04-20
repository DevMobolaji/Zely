import { kafka } from "../config/kafka.config";
import { initIdempotency, completeIdempotency } from "@/events/idempotency";
import { TOPICS } from "../config/topics";
import { logger } from "@/shared/utils/logger";
import { RetryEnvelope } from "@/kafka/consumer/helpers/retry.envelope";
import { validateWithSchema } from "../schema/zod.helper";
import { AuthEventSchema } from "../schema/user.schema";
import { retryOrDLQ } from "./helpers/retry.handler";
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
        const rawEvent = JSON.parse(message.value.toString());
        envelope = rawEvent.meta ? rawEvent : {
          meta: {
            retryCount: Number(message.headers?.["x-retry-count"] ?? 0),
            createdAt: new Date().toISOString(),
            originalConsumerGroup: AUTH_PASSWORD_RESET_CONSUMER,
            originalTopic: topic,
            processor: "auth",
          },
          event: rawEvent.event ? rawEvent.event : rawEvent,
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

      const firstTime = await initIdempotency(
        envelope.event.eventId,
        topic,
        AUTH_PASSWORD_RESET_CONSUMER
      );

      if (firstTime === "SKIP") {
        kafkaMessagesProcessedTotal.inc({ topic, consumer_group: AUTH_PASSWORD_RESET_CONSUMER });
        timer();
        await resetPasswordConsumer.commitOffsets([{
          topic, partition,
          offset: (parseInt(message.offset) + 1).toString(),
        }]);
        return;
      }

      try {
        const validatedEvent = validateWithSchema(AuthEventSchema, envelope.event) as {
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

        await resetPasswordProcessor(topic, validatedEnvelope);

        await completeIdempotency(
          envelope.event.eventId,
          AUTH_PASSWORD_RESET_CONSUMER
        );

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