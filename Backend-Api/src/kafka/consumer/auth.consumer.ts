import { kafka } from "../config/kafka.config";
import {
  completeIdempotency,
  failIdempotency,
  initIdempotency,
} from "@/events/idempotency";
import { logger } from "@/shared/utils/logger";
import { RetryEnvelope } from "../retry.helpers/retry.envelope";
import { processAuthEvent } from "@/events/authProcessor.evt";
import { retryOrDLQ } from "../retry.helpers/retry.handler";
import { validateWithSchema } from "../schema/zod.helper";
import { AuthEventSchema } from "../schema/user.schema";
import { TOPICS } from "../config/kafka.topics";
import emailQueue from "@/infrastructure/queues/email.queue";
import { withMongoTransaction } from "@/events/mongo.wrapper";
import {
  kafkaMessagesProcessedTotal,
  kafkaMessagesFailedTotal,
  kafkaProcessingDuration,
} from "@/infrastructure/resilience/metrics";

export const AUTH_CONSUMER_GROUP = "auth-consumer";

const authConsumer = kafka.consumer({ groupId: AUTH_CONSUMER_GROUP });

// authProcessor.evt.ts
export async function onAuthSuccess(result: any): Promise<void> {
  if (result?.email) {
    await emailQueue.add("sendWelcomeEmail", {
      email: result.email,
      name: result.name,
      type: "WELCOME",
    });
    logger.info(`[v1] Welcome email queued`);
  }
}

export async function runAuthConsumer() {
  await authConsumer.connect();

  await authConsumer.subscribe({
    topic: TOPICS.AUTH_EVENTS,
    fromBeginning: false,
  });

  await authConsumer.run({
    autoCommit: false,
    eachMessage: async ({
      topic,
      partition,
      message,
    }: {
      topic: string;
      partition: number;
      message: any;
    }) => {
      if (!message.value) return;

      // ✅ Start processing timer
      const timer = kafkaProcessingDuration.startTimer({
        topic,
        consumer_group: AUTH_CONSUMER_GROUP,
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
            originalConsumerGroup: AUTH_CONSUMER_GROUP,
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
        logger.error("Failed to parse Kafka message", {
          topic,
          partition,
          offset: message.offset,
        });
        timer();
        await authConsumer.commitOffsets([
          {
            topic,
            partition,
            offset: (parseInt(message.offset) + 1).toString(),
          },
        ]);
        return;
      }

      const validatedEvent = validateWithSchema(
        AuthEventSchema,
        envelope.event,
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
        AUTH_CONSUMER_GROUP,
        envelope.meta.retryCount,
      );

      if (IdmChks.decision === "SKIP") {
        kafkaMessagesProcessedTotal.inc({
          topic,
          consumer_group: AUTH_CONSUMER_GROUP,
        });
        timer();
        await authConsumer.commitOffsets([
          {
            topic,
            partition,
            offset: (parseInt(message.offset) + 1).toString(),
          },
        ]);
        return;
      }

      try {
        const result = await withMongoTransaction(async (session) => {
          const result = await processAuthEvent(
            topic,
            validatedEnvelope,
            session,
          );

          await completeIdempotency(
            envelope.event.eventId,
            AUTH_CONSUMER_GROUP,
            IdmChks.version,
            session,
            topic,
            envelope.meta.retryCount, // 🔥 ADD THIS
          );

          return result;
        });

        await onAuthSuccess(result); // ← trigger side effects on success

        // ✅ Success metrics
        kafkaMessagesProcessedTotal.inc({
          topic,
          consumer_group: AUTH_CONSUMER_GROUP,
        });
        timer();

        await authConsumer.commitOffsets([
          {
            topic,
            partition,
            offset: (parseInt(message.offset) + 1).toString(),
          },
        ]);
      } catch (error: any) {
        // ✅ Failure metrics
        kafkaMessagesFailedTotal.inc({
          topic,
          consumer_group: AUTH_CONSUMER_GROUP,
        });
        timer();

        logger.error("Auth provisioning failed", {
          eventId: envelope.event.eventId,
          topic,
        });

        await failIdempotency(
          envelope.event.eventId,
          AUTH_CONSUMER_GROUP,
          topic,
          envelope.meta.retryCount, // always 0 on the main topic
          IdmChks.version,
        );

        await retryOrDLQ({ topic, message: envelope, error });

        await authConsumer.commitOffsets([
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

export async function stopAuthConsumer() {
  await authConsumer.disconnect();
  logger.info("✅ Auth consumer disconnected");
}
