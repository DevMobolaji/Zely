import mongoose from "mongoose";
import { kafka } from "../config/kafka.config";
import { intIdempotency, markEventCompleted } from "@/events/idempotency";
import { logger } from "@/shared/utils/logger";
import { RetryEnvelope } from "./helpers/retry.envelope";
import { processAuthEvent } from "@/events/authProcessor.evt";
import { retryOrDLQ } from "./helpers/retry.handler";
import { validateWithSchema } from "../schema/zod.helper";
import { AuthEventSchema } from "../schema/user.schema";
import { TOPICS } from "../config/topics";
import emailQueue from "@/infrastructure/queues/email.queue";
import { withMongoTransaction } from "@/events/mongo.wrapper";


const AUTH_CONSUMER_GROUP = "auth-consumer";

const authConsumer = kafka.consumer({ groupId: AUTH_CONSUMER_GROUP });

export async function runAuthConsumer() {
  await authConsumer.connect();

  await authConsumer.subscribe({
    topic: TOPICS.AUTH_EVENTS,
    fromBeginning: false,
  });

  await authConsumer.run({
    autoCommit: false,
    eachMessage: async ({ topic, partition, message }: { topic: string; partition: number; message: any }) => {
      if (!message.value) return;

      const rawEvent = JSON.parse(message.value.toString());

      const envelope: RetryEnvelope = rawEvent.meta ? rawEvent : {
        meta: {
          retryCount: Number(message.headers?.["x-retry-count"] ?? 0),
          createdAt: new Date().toISOString(),
          originalConsumerGroup: AUTH_CONSUMER_GROUP,
        },
        event: rawEvent.event ? rawEvent.event : rawEvent,
      };

      let result: any = null;
      let isDuplicate = false;

      try {
        // ✅ PHASE 1: DB TRANSACTION ONLY
        await withMongoTransaction(async (session) => {
          const firstTime = await intIdempotency(
            envelope.event.eventId,
            session,
            topic,
            "auth-consumer"
          );

          if (firstTime === "SKIP") {
            await session.abortTransaction();
            return; // do not process
          }

          const validatedEvent = validateWithSchema(
            AuthEventSchema,
            envelope.event
          ) as { eventId: string; eventType: string; version: 1; aggregateType: string; aggregateId: string; payload: any; occurredAt?: string; action: string; status: string; context: object; };;

          const validatedEnvelope: RetryEnvelope = {
            meta: envelope.meta,
            event: validatedEvent,
          };

          result = await processAuthEvent(
            topic,
            validatedEnvelope,
            session
          );

          // Mark event completed
          await markEventCompleted(envelope.event.eventId, "auth-consumer", session);
        });



        // ✅ PHASE 2: SIDE EFFECTS (AFTER COMMIT)
        if (!isDuplicate && result?.email) {
          await emailQueue.add("sendWelcomeEmail", {
            email: result.email,
            name: result.name,
            type: "WELCOME",
          });

          logger.info(`[v1] Welcome email sent`);
        }

        // ✅ PHASE 3: OFFSET COMMIT
        await authConsumer.commitOffsets([
          {
            topic,
            partition,
            offset: (parseInt(message.offset) + 1).toString(),
          },
        ]);

      } catch (error: any) {
        logger.error("Auth provisioning failed", {
          eventId: envelope.event.eventId,
          topic,
          error: error.message,
         // stack: error.stack,
        });

        await retryOrDLQ({
          topic,
          message: envelope,
          error,
        });

        // ✅ still commit offset (because retry topic handles it)
        await authConsumer.commitOffsets([
          {
            topic,
            partition,
            offset: (parseInt(message.offset) + 1).toString(),
          },
        ]);
      }
    }
  });
}
