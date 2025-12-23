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
