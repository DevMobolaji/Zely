import {
  completeIdempotency,
  failIdempotency,
  initIdempotency,
} from "@/events/idempotency";
import { withMongoTransaction } from "@/events/mongo.wrapper";
import { processVaultEvents } from "@/events/vaultProcessor.evt";
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
import { VaultEventSchema } from "../schema/vault.schema";
import { validateWithSchema } from "../schema/zod.helper";

const VAULT_CONSUMER_GROUP = "vault-consumer";
const vaultConsumer = kafka.consumer({ groupId: VAULT_CONSUMER_GROUP });

export async function runVaultConsumer() {
  await vaultConsumer.connect();

  await vaultConsumer.subscribe({
    topic: TOPICS.VAULT_EVENTS,
    fromBeginning: false,
  });

  await vaultConsumer.run({
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

      // ✅ Start timer
      const timer = kafkaProcessingDuration.startTimer({
        topic,
        consumer_group: VAULT_CONSUMER_GROUP,
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
            originalConsumerGroup: VAULT_CONSUMER_GROUP,
            originalTopic: topic,
            lastError: raw.lastError ?? parsedPayload.meta?.lastError,
            processor: "vault",
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
        await vaultConsumer.commitOffsets([
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
        VAULT_CONSUMER_GROUP,
        envelope.meta.retryCount,
      );

      if (IdmChks.decision === "SKIP") {
        kafkaMessagesProcessedTotal.inc({
          topic,
          consumer_group: VAULT_CONSUMER_GROUP,
        });
        timer();
        await vaultConsumer.commitOffsets([
          {
            topic,
            partition,
            offset: (parseInt(message.offset) + 1).toString(),
          },
        ]);
        return;
      }

      try {
        const validatedEvent = validateWithSchema(
          VaultEventSchema,
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

        await withMongoTransaction(async (session) => {
          await processVaultEvents(topic, validatedEnvelope, session);

          await completeIdempotency(
            envelope.event.eventId,
            VAULT_CONSUMER_GROUP,
            IdmChks.version,
            session,
            topic,
            envelope.meta.retryCount,
          );
        });

        // ✅ Success metrics
        kafkaMessagesProcessedTotal.inc({
          topic,
          consumer_group: VAULT_CONSUMER_GROUP,
        });
        timer();

        await vaultConsumer.commitOffsets([
          {
            topic,
            partition,
            offset: (parseInt(message.offset) + 1).toString(),
          },
        ]);

        logger.info("Vault committed successfully");

        await onEventConfirmed(validatedEnvelope, TOPICS.VAULT_EVENTS);
      } catch (error: any) {
        // ✅ Failure metrics
        kafkaMessagesFailedTotal.inc({
          topic,
          consumer_group: VAULT_CONSUMER_GROUP,
        });
        timer();

        logger.error("Transfer event processing failed");
        await failIdempotency(
          envelope.event.eventId,
          VAULT_CONSUMER_GROUP,
          topic,
          envelope.meta.retryCount, // always 0 on the main topic
          IdmChks.version,
        );

        await retryOrDLQ({ topic, message: envelope, error });

        await vaultConsumer.commitOffsets([
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

export async function stopVaultConsumer() {
  await vaultConsumer.disconnect();
  logger.info("✅ Vault consumer disconnected");
}
