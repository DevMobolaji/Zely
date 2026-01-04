import { OutboxEvent } from "@/modules/audit/outbox.model";
import { AuditAction, AuditStatus } from "@/modules/audit/audit.interface";
import { IRequestContext } from "@/config/interfaces/request.interface";
import bcrypt from "bcrypt";
import { ClientSession } from "mongoose";


type emitOutboxOptions = {
  session: ClientSession
}

type emitOutboxInput = {
  eventId: string,
  eventType: string;
  action: AuditAction;
  status: AuditStatus;
  payload: Record<string, any>;
  context: IRequestContext;
  aggregateId: string,
  aggregateType: string
}

export const emitOutboxEvent = async ({ eventId, eventType, action, status, context, payload, aggregateId, aggregateType }: emitOutboxInput, options?: emitOutboxOptions) => {
  await OutboxEvent.create(
    [
      {
        eventId,
        eventType: eventType,
        action: action,
        status: status,
        payload,
        context,
        aggregateId,
        aggregateType,
        occurredAt: new Date()
      }
    ], options?.session ? { session: options.session } : undefined
  );
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


export const generateOTP = (): { otp: string; expires: Date } => {
  const otp = Math.floor(100000 + Math.random() * 900000).toString(); // 6 digits
  const expires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
  return { otp, expires };
}

export const hashOtp = (otp: string) => {
  return bcrypt.hashSync(otp, 10);
}

export function verifyOtp(otp: string, hashedOtp: string): Promise<boolean> {
  return bcrypt.compare(otp, hashedOtp);
}
