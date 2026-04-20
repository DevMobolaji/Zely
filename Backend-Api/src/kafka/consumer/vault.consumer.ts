import { kafka } from "../config/kafka.config";
import { TOPICS } from "../config/topics";
import { RetryEnvelope } from "./helpers/retry.envelope";
import { completeIdempotency, initIdempotency } from "@/events/idempotency";
import { logger } from "@/shared/utils/logger";
import { vaultEvents } from "@/events/vaults.events";
import { retryOrDLQ } from "./helpers/retry.handler";
import { validateWithSchema } from "../schema/zod.helper";
import { VaultEventSchema } from "../schema/vault.schema";
import { withMongoTransaction } from "@/events/mongo.wrapper";
import {
  kafkaMessagesProcessedTotal,
  kafkaMessagesFailedTotal,
  kafkaProcessingDuration,
} from "@/infrastructure/resilience/metrics";

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
    eachMessage: async ({ topic, partition, message }: { topic: string; partition: number; message: any }) => {
      if (!message.value) return;

      // ✅ Start timer
      const timer = kafkaProcessingDuration.startTimer({
        topic,
        consumer_group: VAULT_CONSUMER_GROUP,
      });

      let envelope: RetryEnvelope;
      try {
        const rawEvent = JSON.parse(message.value.toString());
        envelope = rawEvent.meta ? rawEvent : {
          meta: {
            retryCount: Number(message.headers?.["x-retry-count"] ?? 0),
            createdAt: new Date().toISOString(),
            originalConsumerGroup: VAULT_CONSUMER_GROUP,
            originalTopic: topic,
            processor: "vault",
          },
          event: rawEvent.event ? rawEvent.event : rawEvent,
        };
      } catch (e) {
        logger.error("Failed to parse Kafka message", { topic, partition, offset: message.offset });
        timer();
        await vaultConsumer.commitOffsets([{
          topic, partition,
          offset: (parseInt(message.offset) + 1).toString(),
        }]);
        return;
      }

      const firstTime = await initIdempotency(
        envelope.event.eventId,
        topic,
        VAULT_CONSUMER_GROUP
      );

      if (firstTime === "SKIP") {
        kafkaMessagesProcessedTotal.inc({ topic, consumer_group: VAULT_CONSUMER_GROUP });
        timer();
        await vaultConsumer.commitOffsets([{
          topic, partition,
          offset: (parseInt(message.offset) + 1).toString(),
        }]);
        return;
      }

      try {
        const validatedEvent = validateWithSchema(VaultEventSchema, envelope.event) as {
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
          await vaultEvents(topic, validatedEnvelope, session);
        });

        await completeIdempotency(
          envelope.event.eventId,
          VAULT_CONSUMER_GROUP
        );

        // ✅ Success metrics
        kafkaMessagesProcessedTotal.inc({ topic, consumer_group: VAULT_CONSUMER_GROUP });
        timer();

        await vaultConsumer.commitOffsets([{
          topic, partition,
          offset: (parseInt(message.offset) + 1).toString(),
        }]);

      } catch (error: any) {
        // ✅ Failure metrics
        kafkaMessagesFailedTotal.inc({ topic, consumer_group: VAULT_CONSUMER_GROUP });
        timer();

        logger.error("Vault provisioning failed", {
          eventId: envelope.event.eventId,
          topic,
          error: error.message,
        });

        await retryOrDLQ({ topic, message: envelope, error });

        await vaultConsumer.commitOffsets([{
          topic, partition,
          offset: (parseInt(message.offset) + 1).toString(),
        }]);
      }
    },
  });
}

export async function stopVaultConsumer() {
  await vaultConsumer.disconnect();
  logger.info("✅ Vault consumer disconnected");
}