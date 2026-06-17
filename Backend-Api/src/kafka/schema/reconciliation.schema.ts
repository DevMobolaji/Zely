// reconciliation.schema.ts
import z from "zod";
import { BaseEventSchema } from "./index.schema";

const ReconciliationDriftSchema = BaseEventSchema.extend({
  eventType: z.literal("RECONCILIATION_DRIFT_DETECTED"),
  aggregateType: z.literal("RECONCILIATION"),
  payload: z.object({
    walletId: z.string(),
    userPublicId: z.string().optional(),
    driftAmount: z.number(),
    direction: z.string(),
    walletBalance: z.number(),
    ledgerBalance: z.number(),
    autoFrozen: z.boolean().optional(),
  }),
});

const ReconciliationRunSchema = BaseEventSchema.extend({
  eventType: z.literal("RECONCILIATION_RUN_COMPLETED"),
  aggregateType: z.literal("RECONCILIATION"),
  payload: z.object({
    totalChecked: z.number(),
    driftsFound: z.number(),
    walletsFrozen: z.number(),
    durationMs: z.number().optional(),
  }),
});

export const ReconciliationEventSchema = z.discriminatedUnion("eventType", [
  ReconciliationDriftSchema,
  ReconciliationRunSchema,
]);

export type ReconciliationEvent = z.infer<typeof ReconciliationEventSchema>;
