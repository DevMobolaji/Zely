import { kafka } from "../config/kafka.config";
import { completeIdempotency, initIdempotency } from "@/events/idempotency";
import { logger } from "@/shared/utils/logger";
import { RetryEnvelope } from "../retry.helpers/retry.envelope";
import { processAuthEvent } from "@/events/authProcessor.evt";
import { processTransferEvents } from "@/events/transferProcessor.evt";
import { handleTransactionCompleted } from "@/events/projectionEvt";
import { validateWithSchema } from "../schema/zod.helper";
import { AuthEventSchema } from "../schema/user.schema";
import { TransferEventSchema } from "../schema/transfer.schema";
import {
  AUTH_MAX_RETRIES,
  AUTH_RETRY_LEVELS,
  KYC_MAX_RETRIES,
  KYC_RETRY_LEVELS,
  TRANSFER_MAX_RETRIES,
  TRANSFER_RETRY_LEVELS,
} from "../retry.helpers/retry.policy";
import z from "zod";
import { sendToDLQ } from "../producer/sendToDlq";
import { sendToRetry } from "../producer/retry.producer";
import { withMongoTransaction } from "@/events/mongo.wrapper";
import { ProcessorType } from "../retry.helpers/retry.envelope";
import { ClientSession } from "mongoose";
import {
  kafkaMessagesProcessedTotal,
  kafkaMessagesFailedTotal,
  kafkaProcessingDuration,
} from "@/infrastructure/resilience/metrics";
import { kycEvent } from "@/events/kyc.events";
import { KycEventSchema } from "../schema/kyc.schema";

export const RetryEnvelopeSchema = z.object({
  meta: z.object({
    retryCount: z.number(),
    createdAt: z.string(),
    lastError: z.string().optional(),
    originalConsumerGroup: z.string().optional(),
    originalTopic: z.string(),
    processor: z.enum(["transfer", "projection", "auth", "kyc"]),
  }),
  event: z.union([AuthEventSchema, TransferEventSchema, KycEventSchema]),
});

/** -------------------------
 * PROCESSOR REGISTRY
 * Routes by explicit processor field — not aggregateType or consumer group string.
 * Adding a new processor = adding one entry here.
 * ------------------------- */
type ProcessorFn = (
  topic: string,
  envelope: RetryEnvelope,
  session: ClientSession
) => Promise<any>;

interface ProcessorConfig {
  processor: ProcessorFn;
  retryLevels: { topic: string; delayMs: number }[];
  maxRetries: number;
}

// Thin wrapper so handleTransactionCompleted matches ProcessorFn signature
async function processProjectionEvents(
  topic: string,
  envelope: RetryEnvelope,
  session: ClientSession
): Promise<void> {
  await handleTransactionCompleted(topic, envelope, session);
}

const PROCESSOR_REGISTRY: Record<ProcessorType, ProcessorConfig> = {
  auth: {
    processor: processAuthEvent,
    retryLevels: AUTH_RETRY_LEVELS,
    maxRetries: AUTH_MAX_RETRIES,
  },
  transfer: {
    processor: processTransferEvents,
    retryLevels: TRANSFER_RETRY_LEVELS,
    maxRetries: TRANSFER_MAX_RETRIES,
  },
  projection: {
    processor: processProjectionEvents,
    retryLevels: TRANSFER_RETRY_LEVELS,
    maxRetries: TRANSFER_MAX_RETRIES,
  },
  kyc: {
    processor: kycEvent,
    retryLevels: KYC_RETRY_LEVELS,
    maxRetries: KYC_MAX_RETRIES,
  }
};

const RETRY_CONSUMER_GROUP = "retry-consumer";
const retryConsumer = kafka.consumer({ groupId: RETRY_CONSUMER_GROUP });

const ALL_RETRY_TOPICS = [
  ...AUTH_RETRY_LEVELS.map((l) => l.topic),
  ...TRANSFER_RETRY_LEVELS.map((l) => l.topic),
  ...KYC_RETRY_LEVELS.map((l) => l.topic),
];

export async function runRetryConsumer() {
  await retryConsumer.connect();

  for (const topic of ALL_RETRY_TOPICS) {
    await retryConsumer.subscribe({ topic, fromBeginning: true });
  }

  await retryConsumer.run({
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

      const timer = kafkaProcessingDuration.startTimer({
        topic,
        consumer_group: RETRY_CONSUMER_GROUP,
      });

      const raw = JSON.parse(message.value.toString());

      const envelope: RetryEnvelope = validateWithSchema(
        RetryEnvelopeSchema,
        raw
      );

      const {
        retryCount,
        originalTopic,
        originalConsumerGroup,
        processor: processorType,
      } = envelope.meta;

      //console.log(originalTopic, originalConsumerGroup, processorType, topic);

      if (!originalConsumerGroup) {
        logger.warn("Missing originalConsumerGroup in retry envelope", {
          eventId: envelope.event.eventId,
        });
      }

      /** -------------------------
       * RESOLVE PROCESSOR
       * ------------------------- */
      const config = PROCESSOR_REGISTRY[processorType];
      if (!config) {
        logger.error("Unknown processor type, sending to DLQ", {
          processorType,
          eventId: envelope.event.eventId,
        });
        await sendToDLQ(originalTopic, envelope, new Error(`Unknown processor: ${processorType}`));
        await retryConsumer.commitOffsets([
          { topic, partition, offset: (parseInt(message.offset) + 1).toString() },
        ]);
        return;
      }

      const { processor, retryLevels, maxRetries } = config;
      const nextRetryCount = retryCount + 1;

      /** -------------------------
       * CHECK RETRY EXHAUSTION
       * ------------------------- */
      if (nextRetryCount >= maxRetries) {
        await sendToDLQ(
          originalTopic,
          envelope,
          new Error("Max retries reached")
        );
        logger.error("Retry exhausted, sent to DLQ", {
          eventId: envelope.event.eventId,
          retryCount,
          processorType,
        });
        await retryConsumer.commitOffsets([
          { topic, partition, offset: (parseInt(message.offset) + 1).toString() },
        ]);
        return;
      }

      /** -------------------------
       * APPLY COOL-DOWN DELAY
       * ------------------------- */
      const retryConfig = retryLevels[nextRetryCount] ?? null;
      if (!retryConfig) {
        await sendToDLQ(originalTopic, envelope, new Error("No retry level found"));
        logger.error("No retry level found, sent to DLQ", {
          eventId: envelope.event.eventId,
          retryCount,
          nextRetryCount,
        });
        await retryConsumer.commitOffsets([
          { topic, partition, offset: (parseInt(message.offset) + 1).toString() },
        ]);
        return;
      }

      const createdAtMs = new Date(envelope.meta.createdAt).getTime();
      const delay = Math.max(retryConfig.delayMs - (Date.now() - createdAtMs), 0);

      if (delay > 0) {
        logger.info("Retry cool-down applied", {
          delay,
          eventId: envelope.event.eventId,
        });
        await new Promise((resolve) => setTimeout(resolve, delay));
      }

      /** -------------------------
       * PROCESS WITH TRANSACTION
       * ------------------------- */
      const IdmChks = await initIdempotency(
        envelope.event.eventId,
        topic,
        RETRY_CONSUMER_GROUP
      );

      if (IdmChks.decision === "SKIP") {
        kafkaMessagesProcessedTotal.inc({
          topic,
          consumer_group: RETRY_CONSUMER_GROUP,
        });
        timer();

        await retryConsumer.commitOffsets([{
          topic, partition,
          offset: (parseInt(message.offset) + 1).toString(),
        }]);
        return;
      }

      try {
        await withMongoTransaction(async (session) => {

          await processor(originalTopic, envelope, session);
          logger.info("Processor completed", { eventId: envelope.event.eventId }); // ← does this log?

          await completeIdempotency(
            envelope.event.eventId,
            RETRY_CONSUMER_GROUP,
            IdmChks.version,
            session,
            topic// use current retry topic for idempotency record
          );

        });

        kafkaMessagesProcessedTotal.inc({ topic, consumer_group: RETRY_CONSUMER_GROUP });
        timer();

        await retryConsumer.commitOffsets([
          { topic, partition, offset: (parseInt(message.offset) + 1).toString() },
        ]);

        logger.info("Retry processed successfully", {
          eventId: envelope.event.eventId,
          retryCount: nextRetryCount,
        });


      } catch (error: any) {
        logger.error("Retry processing failed", {
          eventId: envelope.event.eventId,
          processorType,
          error: error.message,
        });

        kafkaMessagesFailedTotal.inc({ topic, consumer_group: RETRY_CONSUMER_GROUP });
        timer();

        if (nextRetryCount >= maxRetries) {
          await sendToDLQ(originalTopic, envelope, error);
          logger.error("Max retries reached, sent to DLQ", {
            eventId: envelope.event.eventId,
          });
        } else {
          await sendToRetry(originalTopic, {
            ...envelope,
            meta: {
              ...envelope.meta,
              retryCount: nextRetryCount,
              lastError: error.message,
              createdAt: envelope.meta.createdAt,
            },
          });
        }

        await retryConsumer.commitOffsets([
          { topic, partition, offset: (parseInt(message.offset) + 1).toString() },
        ]);
      }
    },
  });
}


export async function stopRetryConsumer() {
  await retryConsumer.disconnect();
  logger.info("✅ Retry consumer disconnected");
}