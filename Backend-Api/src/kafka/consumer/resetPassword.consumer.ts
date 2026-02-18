import mongoose from "mongoose";
import { kafka } from "../config/kafka.config";
import { intIdempotency } from "@/events/idempotency";
import { TOPICS } from "../config/topics";
import { logger } from "@/shared/utils/logger";
import { RetryEnvelope } from "@/kafka/consumer/retry.envelope";
import { validateWithSchema } from "../schema/zod.helper";
import { AuthEventSchema } from "../schema/user.schema";
import { retryOrDLQ } from "./retry.handler";
import { resetPasswordProcessor } from "@/events/resetPasswordProcessor.evt";

const consumer = kafka.consumer({ groupId: "auth-password-reset-consumer" });

export async function runPasswordConsumer() {
  await consumer.connect();
  await consumer.subscribe({
    topic: TOPICS.PASSWORD_EVENTS,
    fromBeginning: false,
  });

  await consumer.run({
    eachMessage: async ({ topic, message }: { topic: string; message: any }) => {
      if (!message.value) return;

      const rawEvent = JSON.parse(message.value.toString());

      const envelope: RetryEnvelope = {
        meta: {
          retryCount: Number(message.headers?.["x-retry-count"] ?? 0),
          createdAt: new Date().toISOString(),
        },
        event: rawEvent.event ? rawEvent.event : rawEvent,
      };

      const session = await mongoose.startSession();

      try {
        session.startTransaction();

        // Idempotency check
        const firstTime = await intIdempotency(envelope.event.eventId, session, envelope.event.eventType);
        if (!firstTime) {
          logger.info("Duplicate retry skipped", { eventId: envelope.event.eventId, topic });
          await session.commitTransaction();
          return;
        }

        // Validate payload
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
          event: validatedEvent, // properly validated event
        };

        await resetPasswordProcessor(topic, validatedEnvelope)

        await session.commitTransaction();
      } catch (error: any) {
        if (session.inTransaction()) await session.abortTransaction();

        logger.error("Password reset processing failed", { topic, eventId: envelope.event.eventId, error: error.message });

        await retryOrDLQ({
          topic: envelope.event.eventType,
          message: envelope,
          error,
        });
      } finally {
        await session.endSession();
      }
    },
  });
}
