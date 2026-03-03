import { kafka } from "../config/kafka.config"; 
import { TOPICS } from "../config/topics";
import { RetryEnvelope } from "./helpers/retry.envelope";
import { intIdempotency } from "@/events/idempotency";
import { logger } from "@/shared/utils/logger";
import mongoose from "mongoose";
import { vaultEvents } from "@/events/vaults.events";
import { retryOrDLQ } from "./helpers/retry.handler";
import { validateWithSchema } from "../schema/zod.helper";
import { VaultEventSchema } from "../schema/vault.schema";

const vaultConsumer = kafka.consumer({ groupId: "vault-consumer" });

export async function runVaultConsumer() {
  await vaultConsumer.connect();

  await vaultConsumer.subscribe({
    topic: TOPICS.VAULT_EVENTS,
    fromBeginning: false,
  });

  await vaultConsumer.run({
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
          event: validatedEvent, // properly validated event
        };

        await vaultEvents(topic, validatedEnvelope, session);

        // Commit if all succeeds
        await session.commitTransaction();
      } catch (error: any) {
        console.log(error.message)
        if (session.inTransaction()) {
          await session.abortTransaction();
        }

        logger.error("Vault provisioning failed", {
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