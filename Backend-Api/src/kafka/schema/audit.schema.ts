// audit.schema.ts (shared between producer + consumer)

// import { z } from 'zod';

// export const AuditEventSchema = z.object({
//     action: z.string(),
//     status: z.string().optional(),
//     userId: z.string().nullable().optional(),
//     trackedEmail: z.string().optional(),
//     requestId: z.string(),
//     ip: z.string().optional(),
//     userAgent: z.string().optional(),
//     metadata: z.record(z.string(), z.any()).optional(),
//     severity: z.enum(['INFO', 'WARN', 'CRITICAL']),
//     createdAt: z.string(),
//     lastAttempt: z.string().optional(),
//     attemptTracking: z.boolean(),
//     attemptCount: z.number().optional(),
//     initialStatus: z.string().optional(),
//     latestStatus: z.string().optional(),
// });

// export type AuditEvent = z.infer<typeof AuditEventSchema>;


import { z } from "zod";

export const AuditEventSchema = z.object({
  eventId: z.string(),
  eventType: z.string(),
  action: z.string(),
  status: z.enum(["SUCCESS", "FAILED"]),
  reason: z.string().nullable().optional(),
  userId: z.string().nullable().optional(),
  occurredAt: z.string().datetime(),
  context: z.any().optional(),
  metadata: z.object({
    schemaVersion: z.literal(1),
    source: z.string()
  })
});

export function validateAuditEvent(data: unknown) {
  return AuditEventSchema.parse(data);
}
