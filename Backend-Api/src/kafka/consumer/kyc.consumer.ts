import { kafkaMessagesFailedTotal, kafkaMessagesProcessedTotal, kafkaProcessingDuration } from "@/infrastructure/resilience";
import { kafka } from "../config/kafka.config";
import { TOPICS } from "../config/kafka.topics";
import { RetryEnvelope } from "../retry.helpers/retry.envelope";
import { logger } from "@/shared/utils/logger";
import { validateWithSchema } from "../schema/zod.helper";
import { completeIdempotency, initIdempotency } from "@/events/idempotency";
import { KycEventSchema } from "../schema/kyc.schema";
import { kycEvent } from "@/events/kyc.events";
import { retryOrDLQ } from "../retry.helpers/retry.handler";
import { withMongoTransaction } from "@/events/mongo.wrapper";

export const KYC_CONSUMER_GROUP = "kyc-consumer";
const kycConsumer = kafka.consumer({ groupId: KYC_CONSUMER_GROUP });

export async function runKycConsumer() {
  await kycConsumer.connect()

  await kycConsumer.subscribe({
    topic: TOPICS.KYC_EVENTS,
    fromBeginning: false
  })


  await kycConsumer.run({
    autoCommit: false,
    eachMessage: async ({ topic, partition, message }: { topic: string; partition: number; message: any }) => {
      if (!message.value) return;

      // ✅ Start processing timer
      const timer = kafkaProcessingDuration.startTimer({
        topic,
        consumer_group: KYC_CONSUMER_GROUP,
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
            originalConsumerGroup: KYC_CONSUMER_GROUP,
            originalTopic: topic,
            lastError: raw.lastError ?? parsedPayload.meta?.lastError,
            processor: "kyc",
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
        await kycConsumer.commitOffsets([{
          topic, partition,
          offset: (parseInt(message.offset) + 1).toString(),
        }]);
        return;
      }

      const validatedEvent = validateWithSchema(
        KycEventSchema,
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
        KYC_CONSUMER_GROUP
      );

      if (IdmChks.decision === "SKIP") {
        kafkaMessagesProcessedTotal.inc({
          topic,
          consumer_group: KYC_CONSUMER_GROUP,
        });
        timer();
        await kycConsumer.commitOffsets([{
          topic, partition,
          offset: (parseInt(message.offset) + 1).toString(),
        }]);
        return;
      }

      try {
        await withMongoTransaction(async (session) => {
          await kycEvent(topic, validatedEnvelope, session)

          await completeIdempotency(
            envelope.event.eventId,
            KYC_CONSUMER_GROUP,
            IdmChks.version,
            session
          )

        })

        // ✅ Success metrics
        kafkaMessagesProcessedTotal.inc({ topic, consumer_group: KYC_CONSUMER_GROUP });
        timer();

        await kycConsumer.commitOffsets([{
          topic, partition,
          offset: (parseInt(message.offset) + 1).toString(),
        }]);
      } catch (error: any) {
        kafkaMessagesFailedTotal.inc({ topic, consumer_group: KYC_CONSUMER_GROUP });
        timer();

        logger.error("kyc processing failed", {
          topic,
          eventId: envelope.event.eventId,
          error: error.message,
        });

        await retryOrDLQ({ topic, message: envelope, error });

        await kycConsumer.commitOffsets([{
          topic, partition,
          offset: (parseInt(message.offset) + 1).toString(),
        }]);
      }
    }
  })
}

export async function stopKycConsumer() {
  await kycConsumer.disconnect();
  logger.info("✅ Password consumer disconnected");
}