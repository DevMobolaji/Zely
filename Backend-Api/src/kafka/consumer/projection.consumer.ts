import { completeIdempotency, initIdempotency } from "@/events/idempotency";
import { withMongoTransaction } from "@/events/mongo.wrapper";
import {
  kafkaMessagesFailedTotal,
  kafkaMessagesProcessedTotal,
  kafkaProcessingDuration,
} from "@/infrastructure/resilience/metrics";
import { logger } from "@/shared/utils/logger";
import { kafka } from "../config/kafka.config";
import { TOPICS } from "../config/kafka.topics";
import { RetryEnvelope } from "../retry.helpers/retry.envelope";
import { retryOrDLQ } from "../retry.helpers/retry.handler";
import { routeToProjectionHandler } from "@/kafka/projections/route.projection";

const PROJECTION_CONSUMER_GROUP = "projection-consumer";

const ProjectionConsumer = kafka.consumer({
  groupId: PROJECTION_CONSUMER_GROUP,
});

export async function runProjectionConsumer() {
  await ProjectionConsumer.connect();

  await ProjectionConsumer.subscribe({
    topic: TOPICS.CONFIRMED_TRANSFER_EVENTS,
    fromBeginning: false,
  });

  await ProjectionConsumer.run({
    autoCommit: false,
    eachMessage: async ({ topic, partition, message }: any) => {
      if (!message.value) return;

      const timer = kafkaProcessingDuration.startTimer({
        topic,
        consumer_group: PROJECTION_CONSUMER_GROUP,
      });

      const rawEvent = JSON.parse(message.value.toString());

      const envelope: RetryEnvelope = {
        meta: {
          retryCount: Number(
            message.headers?.["x-retry-count"] ??
              rawEvent.meta?.retryCount ??
              0,
          ),
          createdAt: rawEvent.meta?.createdAt ?? new Date().toISOString(),
          originalConsumerGroup: PROJECTION_CONSUMER_GROUP,
          originalTopic: topic,
          lastError: rawEvent.meta?.lastError,
          processor: "projection",
        },
        event: rawEvent.event ?? rawEvent,
      };

      const aggregateType =
        envelope.event.aggregateType ??
        message.headers?.["x-aggregate-type"]?.toString() ??
        "UNKNOWN";

      logger.info("Received confirmed event for projection");

      const IdkChks = await initIdempotency(
        envelope.event.eventId,
        topic,
        PROJECTION_CONSUMER_GROUP,
        envelope.meta.retryCount,
      );

      if (IdkChks.decision === "SKIP") {
        kafkaMessagesProcessedTotal.inc({
          topic,
          consumer_group: PROJECTION_CONSUMER_GROUP,
        });
        timer();
        await ProjectionConsumer.commitOffsets([
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
          // Route by aggregateType
          await routeToProjectionHandler(
            aggregateType,
            topic,
            envelope,
            session,
          );

          await completeIdempotency(
            envelope.event.eventId,
            PROJECTION_CONSUMER_GROUP,
            IdkChks.version,
            session,
            topic,
            envelope.meta.retryCount,
          );
        });

        logger.info("Projection event", {
          topic,
          aggregateType,
          eventType: envelope.event.eventType,
          aggregateId: envelope.event.aggregateId,
        });

        kafkaMessagesProcessedTotal.inc({
          topic,
          consumer_group: PROJECTION_CONSUMER_GROUP,
        });
        timer();

        await ProjectionConsumer.commitOffsets([
          {
            topic,
            partition,
            offset: (parseInt(message.offset) + 1).toString(),
          },
        ]);
      } catch (error: any) {
        logger.error("Projection event processing failed", {
          error: error?.message,
          stack: error?.stack,
        });

        kafkaMessagesFailedTotal.inc({
          topic,
          consumer_group: PROJECTION_CONSUMER_GROUP,
        });
        timer();

        await retryOrDLQ({ topic, message: envelope, error });

        await ProjectionConsumer.commitOffsets([
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

export async function stopProjectionConsumer() {
  await ProjectionConsumer.disconnect();
  logger.info("✅ Projection consumer disconnected");
}
