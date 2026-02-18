import mongoose from "mongoose";
import { kafka } from "../config/kafka.config";
import { intIdempotency } from "@/events/idempotency";
import { logger } from "@/shared/utils/logger";
import { RetryEnvelope } from "./retry.envelope";
import { processAuthEvent } from "@/events/authProcessor.evt";
import { retryOrDLQ } from "./retry.handler";
import { validateWithSchema } from "../schema/zod.helper";
import { AuthEventSchema } from "../schema/user.schema";
import { TOPICS } from "../config/topics";

const authConsumer = kafka.consumer({ groupId: "auth-consumer" });

export async function runAuthConsumer() {
  await authConsumer.connect();

  await authConsumer.subscribe({
    topic: TOPICS.AUTH_EVENTS,
    fromBeginning: false,
  });

  await authConsumer.run({
    eachMessage: async ({ topic, message }: { topic: string; message: any }) => {
      if (!message.value) return;

      const rawEvent = JSON.parse(message.value.toString());

      const envelope: RetryEnvelope = {
        meta: {
          retryCount: Number(message.headers?.["x-retry-count"] ?? 0),
          createdAt: new Date().toISOString(),
        },
        event: rawEvent.event ? rawEvent.event : rawEvent
      };

      const session = await mongoose.startSession();

      try {
        session.startTransaction();

        const firstTime = await intIdempotency(envelope.event.eventId, session, topic);

        if (!firstTime) {
          logger.info("Duplicate event skipped", { eventId: envelope.event.eventId, topic });
          await session.commitTransaction();
          return;
        }

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
        await processAuthEvent(topic, validatedEnvelope, session);

        // Commit if all succeeds
        await session.commitTransaction();
      } catch (error: any) {
        console.log(error.message)
        if (session.inTransaction()) {
          await session.abortTransaction();
        }

        logger.error("Auth provisioning failed", {
          eventId: envelope.event.eventId,
          topic,
          error: error.message
        });
        await retryOrDLQ({
          topic,
          message: envelope,
          error,
        });
      } finally {
        await session.endSession();
      }
    },
  });
}
