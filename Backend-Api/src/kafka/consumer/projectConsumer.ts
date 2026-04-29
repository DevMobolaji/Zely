import { handleTransactionCompleted } from "@/events/projectionEvt";
import { kafka } from "../config/kafka.config";
import { TOPICS } from "../config/kafka.topics";
import { RetryEnvelope } from "../retry.helpers/retry.envelope";
import { withMongoTransaction } from "@/events/mongo.wrapper";
import { completeIdempotency, initIdempotency } from "@/events/idempotency";
import { logger } from "@/shared/utils/logger";
import { retryOrDLQ } from "../retry.helpers/retry.handler";
import { validateWithSchema } from "../schema/zod.helper";
import { TransferEventSchema } from "../schema/transfer.schema";
import {
  kafkaMessagesProcessedTotal,
  kafkaMessagesFailedTotal,
  kafkaProcessingDuration,
} from "@/infrastructure/resilience/metrics";


const PROJECTION_CONSUMER_GROUP = "projection-consumer";

const ProjectionConsumer = kafka.consumer({
  groupId: PROJECTION_CONSUMER_GROUP,
});

export async function runProjectionConsumer() {
  await ProjectionConsumer.connect();

  // ✅ Now only listens to confirmed events — projections only run
  // after the transfer consumer has successfully processed and published
  await ProjectionConsumer.subscribe({
    topic: TOPICS.CONFIRMED_TRANSFER_EVENTS,
    fromBeginning: false,
  });

  await ProjectionConsumer.run({
    autoCommit: false, // ✅ manual offset control
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
        consumer_group: PROJECTION_CONSUMER_GROUP,
      });

      const rawEvent = JSON.parse(message.value.toString());

      const envelope: RetryEnvelope = {
        meta: {
          retryCount: Number(
            message.headers?.["x-retry-count"] ??
            rawEvent.meta?.retryCount ??
            0
          ),
          createdAt: rawEvent.meta?.createdAt ?? new Date().toISOString(),
          originalConsumerGroup: PROJECTION_CONSUMER_GROUP,
          originalTopic: topic,
          lastError: rawEvent.meta?.lastError,
          processor: "projection",
        },
        event: rawEvent.event ?? rawEvent,
      };

      logger.info("Received confirmed event for projection", {
        topic,
        eventId: envelope.event.eventId,
      });


      /** -------------------------
       * VALIDATION
       * ------------------------- */
      // const validatedEvent = validateWithSchema(
      //   TransferEventSchema,
      //   envelope.event
      // ) as {
      //   eventId: string;
      //   eventType: string;
      //   version: 1;
      //   aggregateType: string;
      //   aggregateId: string;
      //   payload: object;
      //   occurredAt?: string;
      //   action: string;
      //   status: string;
      //   context: object;
      // };

      let validatedEvent;
      try {
        validatedEvent = validateWithSchema(TransferEventSchema, envelope);
      } catch (err) {
        logger.warn("Skipping non-transfer event on projection topic", {
          eventType: envelope.event?.eventType,
          eventId: envelope.event?.eventId,
        });
        // commit offset and skip
        await ProjectionConsumer.commitOffsets([
          { topic, partition, offset: (parseInt(message.offset) + 1).toString() },
        ]);
        return;
      }

      const validatedEnvelope: RetryEnvelope = {
        meta: envelope.meta,
        event: validatedEvent,
      };



      /** -------------------------
       * IDEMPOTENCY CHECK
       * ------------------------- */

      const IdkChks = await initIdempotency(
        envelope.event.eventId,
        topic,
        PROJECTION_CONSUMER_GROUP
      );


      if (IdkChks.decision === "SKIP") {
        kafkaMessagesProcessedTotal.inc({
          topic,
          consumer_group: PROJECTION_CONSUMER_GROUP,
        });
        timer();

        await ProjectionConsumer.commitOffsets([{
          topic, partition,
          offset: (parseInt(message.offset) + 1).toString(),
        }]);
        return;
      }

      try {
        await withMongoTransaction(async (session) => {

          /** -------------------------
           * PROJECTION HANDLER
           * ------------------------- */
          await handleTransactionCompleted(topic, validatedEnvelope, session);

          await completeIdempotency(
            envelope.event.eventId,
            PROJECTION_CONSUMER_GROUP,
            IdkChks.version,
            session
          );
        });



        // ✅ Success metrics
        kafkaMessagesProcessedTotal
          .inc({
            topic,
            consumer_group: PROJECTION_CONSUMER_GROUP,
          });
        timer();

        /** -------------------------
         * COMMIT OFFSET ON SUCCESS
         * ------------------------- */
        await ProjectionConsumer.commitOffsets([
          {
            topic,
            partition,
            offset: (parseInt(message.offset) + 1).toString(),
          },
        ]);
      } catch (error: any) {
        logger.error("Projection event processing failed", {
          topic,
          eventId: envelope.event.eventId,
          error: error.message,
        });

        // ✅ Failure metrics
        kafkaMessagesFailedTotal.inc({
          topic,
          consumer_group: PROJECTION_CONSUMER_GROUP,
        });
        timer();

        /** -------------------------
         * RETRY OR DLQ ON FAILURE
         * ------------------------- */
        await retryOrDLQ({ topic, message: envelope, error });

        /** -------------------------
         * COMMIT OFFSET AFTER ROUTING
         * ------------------------- */
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