import { z } from "zod";

export const BaseEventSchema = z.object({
  // 🔑 identity
  eventId: z.string(),
  eventType: z.string().min(1),
  version: z.literal(1), // ⬅️ explicit version

  // 🧱 aggregate
  aggregateType: z.string().min(1),
  aggregateId: z.string().min(1),

  // 📌 semantics
  action: z.string(),
  status: z.enum(["PENDING", "PROCESSING", "PROCESSED", "FAILED"]),

  // 📦 data
  payload: z.unknown(),

  // 🧠 metadata
  context: z.object({
    requestId: z.string(),
    ip: z.string().optional(),
    userAgent: z.string().optional(),
    deviceId: z.string().optional(),
  }),

  occurredAt: z.string().datetime().optional(),
});

