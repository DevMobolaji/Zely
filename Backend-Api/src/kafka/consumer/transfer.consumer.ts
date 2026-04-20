import { admin, connectAdmin, kafka } from "../config/kafka.config";
import { logger } from "@/shared/utils/logger";
import { completeIdempotency, initIdempotency } from "@/events/idempotency";
import { TOPICS } from "../config/topics";
import { RetryEnvelope } from "./helpers/retry.envelope";
import { validateWithSchema } from "../schema/zod.helper";
import { TransferEventSchema } from "../schema/transfer.schema";
import { retryOrDLQ } from "./helpers/retry.handler";
import { processTransferEvents, publishConfirmedEvent } from "@/events/transferProcessor.evt";
import { withMongoTransaction } from "@/events/mongo.wrapper";
import {
  kafkaMessagesProcessedTotal,
  kafkaMessagesFailedTotal,
  kafkaProcessingDuration,
} from "@/infrastructure/resilience/metrics";

let isConsumerReady = false;

export function isTransferConsumerReady() {
  return isConsumerReady;
}

const TRANSFER_CONSUMER_GROUP = "transfer-consumers";

const transferConsumer = kafka.consumer({
  groupId: TRANSFER_CONSUMER_GROUP,
});

export async function runTransferConsumer() {
  await transferConsumer.connect();
  await connectAdmin();

  transferConsumer.on(transferConsumer.events.GROUP_JOIN, async () => {
    try {
      const committed = await admin.fetchOffsets({
        groupId: TRANSFER_CONSUMER_GROUP,
        topic: TOPICS.TRANSACTION_EVENTS,
      });

      const hasNoCommits = committed.every((p: { offset: string }) => p.offset === '-1');

      if (hasNoCommits) {
        logger.info('Fresh consumer group — seeking all partitions to latest');
        const topicOffsets = await admin.fetchTopicOffsets(TOPICS.TRANSACTION_EVENTS);

        for (const { partition, high } of topicOffsets) {
          transferConsumer.seek({
            topic: TOPICS.TRANSACTION_EVENTS,
            partition,
            offset: high,
          });
          logger.info(`Seeked partition ${partition} to offset ${high}`);
        }
      } else {
        logger.info('Existing consumer group — using committed offsets');
      }

      isConsumerReady = true;
      logger.info('✅ Transfer consumer ready — partitions assigned');
    } catch (err: any) {
      logger.error('Error during consumer group join', { error: err.message });
      isConsumerReady = true;
    }
  });

  transferConsumer.on(transferConsumer.events.STOP, () => {
    isConsumerReady = false;
  });

  await transferConsumer.subscribe({
    topic: TOPICS.TRANSACTION_EVENTS,
    fromBeginning: false,
  });

  await transferConsumer.run({
    autoCommit: false,
    partitionsConsumedConcurrently: 3,
    eachMessage: async ({ topic, partition, message }: any) => {
      if (!message.value) return;

      // ✅ Start processing timer
      const timer = kafkaProcessingDuration.startTimer({
        topic,
        consumer_group: TRANSFER_CONSUMER_GROUP,
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
            originalConsumerGroup: TRANSFER_CONSUMER_GROUP,
            originalTopic: topic,
            lastError: raw.lastError ?? parsedPayload.meta?.lastError,
            processor: "transfer",
          },
          event: {
            ...parsedPayload.event,
            action: raw.action,
            status: raw.status,
          },
        };
      } catch (e) {
        logger.error("Failed to parse Kafka message", { topic, partition, offset: message.offset });
        timer(); // end timer on parse failure
        await transferConsumer.commitOffsets([{
          topic, partition,
          offset: (parseInt(message.offset) + 1).toString(),
        }]);
        return;
      }

      const validatedEvent = validateWithSchema(TransferEventSchema, envelope.event) as {
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

      try {
        const firstTime = await initIdempotency(
          envelope.event.eventId,
          topic,
          TRANSFER_CONSUMER_GROUP
        );

        if (firstTime === "SKIP") {
          kafkaMessagesProcessedTotal.inc({
            topic,
            consumer_group: TRANSFER_CONSUMER_GROUP,
          });
          timer();
          await transferConsumer.commitOffsets([{
            topic, partition,
            offset: (parseInt(message.offset) + 1).toString(),
          }]);
          return;
        }

        await withMongoTransaction(async (session) => {
          await processTransferEvents(topic, validatedEnvelope, session);
        });

        await completeIdempotency(
          envelope.event.eventId,
          TRANSFER_CONSUMER_GROUP
        );

        // ✅ Success metrics
        kafkaMessagesProcessedTotal.inc({
          topic,
          consumer_group: TRANSFER_CONSUMER_GROUP,
        });
        timer();

        await transferConsumer.commitOffsets([{
          topic, partition,
          offset: (parseInt(message.offset) + 1).toString(),
        }]);

        logger.info("Transaction committed successfully", {
          eventId: envelope.event.eventId,
        });

        await publishConfirmedEvent(envelope);

      } catch (error: any) {
        // ✅ Failure metrics
        kafkaMessagesFailedTotal.inc({
          topic,
          consumer_group: TRANSFER_CONSUMER_GROUP,
        });
        timer();

        logger.error("Transfer event processing failed", {
          topic,
          eventId: envelope.event?.eventId,
          error: error.message,
        });

        await retryOrDLQ({ topic, message: envelope, error });

        await transferConsumer.commitOffsets([{
          topic, partition,
          offset: (parseInt(message.offset) + 1).toString(),
        }]);

        logger.info("Offset committed after failure", {
          eventId: envelope.event?.eventId,
          offset: (parseInt(message.offset) + 1).toString(),
        });
      }
    },
  });
}

export async function stopTransferConsumer() {
  await Promise.race([
    transferConsumer.disconnect(),
    new Promise<void>((resolve) => setTimeout(resolve, 3000))
  ]);
  logger.info("✅ Transfer consumer disconnected");
}