import { OutboxEvent } from "@/modules/audit/outbox.model";
import { AuditAction, AuditStatus } from "@/modules/audit/audit.interface";
import { IRequestContext } from "@/config/interfaces/request.interface";
import { ClientSession } from "mongoose";
import { logger } from "@/shared/utils/logger";


type emitOutboxOptions = {
  session: ClientSession
}

type emitOutboxInput = {
  topic: string,
  eventId: string,
  eventType: string;
  action: AuditAction;
  status: AuditStatus;
  payload: Record<string, any>;
  context?: IRequestContext;
  aggregateId: string,
  aggregateType: string,
  version: number
}

export const emitOutboxEvent = async ({ topic, eventId, eventType, action, status, context, payload, aggregateId, aggregateType, version }: emitOutboxInput, options?: emitOutboxOptions) => {
  try {
    await OutboxEvent.create(
      [
        {
          topic,
          eventId,
          eventType,
          action,
          status,
          payload: JSON.stringify({
            meta: {
              retryCount: 0,
              createdAt: new Date().toISOString(),
              version,
            },
            event: {
              eventId,
              eventType,
              aggregateId,
              aggregateType,
              payload,         // your actual business data
              context,
              occurredAt: new Date().toISOString(),
              version,
            },
          }),
          context,
          aggregateId,
          aggregateType,
          version,
          occurredAt: new Date()
        }
      ], options?.session ? { session: options.session } : undefined
    );
  } catch (err: any) {
    if (err.code === 11000) {
      // Outbox event already committed in a previous attempt — this is safe to skip
      // The event will still be picked up by the outbox processor
      logger.warn("Outbox event already exists, skipping emit", { eventId: eventId });
      return;
    }
    throw err;
  }
}


export const getLockTime = (failedAttempts: number) => {
  let lockDurationMs = 0;
  if (failedAttempts >= 5) {
    if (failedAttempts === 5) lockDurationMs = 60_000;       // 1 min
    else if (failedAttempts <= 7) lockDurationMs = 5 * 60_000;  // 5 min
    else if (failedAttempts <= 9) lockDurationMs = 15 * 60_000; // 15 min
    else lockDurationMs = 60 * 60_000;                          // 1 hour
  }

  return lockDurationMs;
}
