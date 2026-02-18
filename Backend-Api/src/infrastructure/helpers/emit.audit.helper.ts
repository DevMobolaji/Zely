import { OutboxEvent } from "@/modules/audit/outbox.model";
import { AuditAction, AuditStatus } from "@/modules/audit/audit.interface";
import { IRequestContext } from "@/config/interfaces/request.interface";
import { ClientSession } from "mongoose";


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
          payload,
          context,
          aggregateId,
          aggregateType,
          version,
          occurredAt: new Date()
        }
      ], options?.session ? { session: options.session } : undefined
    );
  } catch (error: any) {
    if (error.code === 11000) return;
    throw error;
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
