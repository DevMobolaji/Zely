import { processAuthEvent } from "@/events/authProcessor.evt";
import {
  completeIdempotency,
  failIdempotency,
  initIdempotency,
} from "@/events/idempotency";
import { kycEvent } from "@/events/kyc.events";
import { withMongoTransaction } from "@/events/mongo.wrapper";
import { handleTransactionCompleted } from "@/events/projectionEvt";
import { processTransferEvents } from "@/events/transferProcessor.evt";
import {
  kafkaMessagesFailedTotal,
  kafkaMessagesProcessedTotal,
  kafkaProcessingDuration,
} from "@/infrastructure/resilience/metrics";
import { logger } from "@/shared/utils/logger";
import { ClientSession } from "mongoose";
import z from "zod";
import { kafka } from "../config/kafka.config";
import { sendToRetry } from "../producer/retry.producer";
import { sendToDLQ } from "../producer/sendToDlq";
import { ProcessorType, RetryEnvelope } from "../retry.helpers/retry.envelope";
import {
  AUTH_MAX_RETRIES,
  AUTH_RETRY_LEVELS,
  KYC_MAX_RETRIES,
  KYC_RETRY_LEVELS,
  TRANSFER_MAX_RETRIES,
  TRANSFER_RETRY_LEVELS,
} from "../retry.helpers/retry.policy";
import { KycEventSchema } from "../schema/kyc.schema";
import { TransferEventSchema } from "../schema/transfer.schema";
import { AuthEventSchema } from "../schema/user.schema";
import { validateWithSchema } from "../schema/zod.helper";
import { onAuthSuccess } from "@/kafka/consumer/auth.consumer";
import { onTransferSuccess } from "@/events/publishconfirm.event";

// retry.ready.ts
let markReady: () => void;

export const retryReadySignal = new Promise<void>((resolve) => {
  markReady = resolve;
});

export function signalRetryReady() {
  markReady();
}

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
  session: ClientSession,
) => Promise<any>;

interface ProcessorConfig {
  processor: ProcessorFn;
  retryLevels: { topic: string; delayMs: number }[];
  maxRetries: number;
  onSuccess?: (result: any, envelope: RetryEnvelope) => Promise<void>; // ← optional success callback for side effects
}

// Thin wrapper so handleTransactionCompleted matches ProcessorFn signature
async function processProjectionEvents(
  topic: string,
  envelope: RetryEnvelope,
  session: ClientSession,
): Promise<void> {
  await handleTransactionCompleted(topic, envelope, session);
}

const PROCESSOR_REGISTRY: Record<ProcessorType, ProcessorConfig> = {
  auth: {
    processor: processAuthEvent,
    retryLevels: AUTH_RETRY_LEVELS,
    maxRetries: AUTH_MAX_RETRIES,
    onSuccess: async (result: any, _envelope: RetryEnvelope) => {
      await onAuthSuccess(result); // needs result, not envelope
    },
  },
  transfer: {
    processor: processTransferEvents,
    retryLevels: TRANSFER_RETRY_LEVELS,
    maxRetries: TRANSFER_MAX_RETRIES,
    onSuccess: async (_result: any, envelope: RetryEnvelope) => {
      await onTransferSuccess(envelope); // needs result, not envelope
    },
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
  },
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
      // Wait until all services are fully initialized
      await retryReadySignal;

      if (!message.value) return;

      const timer = kafkaProcessingDuration.startTimer({
        topic,
        consumer_group: RETRY_CONSUMER_GROUP,
      });

      const raw = JSON.parse(message.value.toString());

      const envelope: RetryEnvelope = validateWithSchema(
        RetryEnvelopeSchema,
        raw,
      );

      const {
        retryCount,
        originalTopic,
        originalConsumerGroup,
        processor: processorType,
      } = envelope.meta;

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
        await sendToDLQ(
          originalTopic,
          envelope,
          new Error(`Unknown processor: ${processorType}`),
        );
        await retryConsumer.commitOffsets([
          {
            topic,
            partition,
            offset: (parseInt(message.offset) + 1).toString(),
          },
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
          new Error("Max retries reached"),
        );
        logger.error("Retry exhausted, sent to DLQ", {
          eventId: envelope.event.eventId,
          retryCount,
          processorType,
        });
        await retryConsumer.commitOffsets([
          {
            topic,
            partition,
            offset: (parseInt(message.offset) + 1).toString(),
          },
        ]);
        return;
      }

      /** -------------------------
       * APPLY COOL-DOWN DELAY
       * ------------------------- */
      const retryConfig = retryLevels[nextRetryCount] ?? null;
      if (!retryConfig) {
        await sendToDLQ(
          originalTopic,
          envelope,
          new Error("No retry level found"),
        );
        logger.error("No retry level found, sent to DLQ", {
          eventId: envelope.event.eventId,
          retryCount,
          nextRetryCount,
        });
        await retryConsumer.commitOffsets([
          {
            topic,
            partition,
            offset: (parseInt(message.offset) + 1).toString(),
          },
        ]);
        return;
      }

      const createdAtMs = new Date(envelope.meta.createdAt).getTime();
      const elapsed = Date.now() - createdAtMs;
      const delay = Math.max(retryConfig.delayMs - elapsed, 0);

      if (delay > 0) {
        logger.info("Retry cool-down applied", {
          delay,
          eventId: envelope.event.eventId,
          willProcessAt: new Date(Date.now() + delay).toISOString(), // ← add this
        });
        await new Promise((resolve) => setTimeout(resolve, delay));
      }

      /** -------------------------
       * PROCESS WITH TRANSACTION
       * ------------------------- */
      const IdmChks = await initIdempotency(
        envelope.event.eventId,
        topic,
        RETRY_CONSUMER_GROUP,
        nextRetryCount,
      );

      if (IdmChks.decision === "SKIP") {
        kafkaMessagesProcessedTotal.inc({
          topic,
          consumer_group: RETRY_CONSUMER_GROUP,
        });
        timer();

        await retryConsumer.commitOffsets([
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
          const result = await processor(originalTopic, envelope, session);
          logger.info("Processor completed", {
            eventId: envelope.event.eventId,
          }); // ← does this log?

          await completeIdempotency(
            envelope.event.eventId,
            RETRY_CONSUMER_GROUP,
            IdmChks.version,
            session,
            topic,
            nextRetryCount, // 🔥 ADD THIS
          );

          return result;
        });

        await config.onSuccess?.(result, envelope);

        kafkaMessagesProcessedTotal.inc({
          topic,
          consumer_group: RETRY_CONSUMER_GROUP,
        });
        timer();

        await retryConsumer.commitOffsets([
          {
            topic,
            partition,
            offset: (parseInt(message.offset) + 1).toString(),
          },
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

        kafkaMessagesFailedTotal.inc({
          topic,
          consumer_group: RETRY_CONSUMER_GROUP,
        });
        timer();

        if (nextRetryCount >= maxRetries) {
          await sendToDLQ(originalTopic, envelope, error);
          logger.error("Max retries reached, sent to DLQ", {
            eventId: envelope.event.eventId,
          });
        } else {
          await failIdempotency(
            envelope.event.eventId,
            RETRY_CONSUMER_GROUP,
            topic,
            nextRetryCount,
            IdmChks.version,
          );

          await sendToRetry(originalTopic, {
            ...envelope,
            meta: {
              ...envelope.meta,
              retryCount: nextRetryCount,
              lastError: error.message,
              createdAt: new Date().toISOString(),
            },
          });
        }

        await retryConsumer.commitOffsets([
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

export async function stopRetryConsumer() {
  try {
    await retryConsumer.disconnect();
    logger.info("✅ Retry consumer disconnected");
  } catch (err) {
    logger.error("Retry consumer disconnect error", err);
  }
}
