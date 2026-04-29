import z from "zod";
import { BaseEventSchema } from "./index.schema";

export const kycPendingSchema = BaseEventSchema.extend({
  eventType: z.literal("KYC_SUBMITTED"),
  version: z.literal(1),
  aggregateType: z.literal("KYC"),
  aggregateId: z.string(),
  eventId: z.string(),
  payload: z.object({
    userId: z.string(),
    email: z.email(),
    name: z.string(),
    targetTier: z.string(),
    submissionId: z.string()
  }),
})

export const kycCompletedSchema = BaseEventSchema.extend({
  eventType: z.literal("KYC_APPROVED"),
  version: z.literal(1),
  aggregateType: z.literal("KYC"),
  aggregateId: z.string(),
  eventId: z.string(),
  payload: z.object({
    userId: z.string(),
    email: z.email(),
    name: z.string(),
    newTier: z.string(),
    submissionId: z.string(),
    autoApproved: z.boolean()
  }),
})

export const kycFailedSchema = BaseEventSchema.extend({
  eventType: z.literal("KYC_REJECTED"),
  version: z.literal(1),
  aggregateType: z.literal("KYC"),
  aggregateId: z.string(),
  eventId: z.string(),
  payload: z.object({
    userId: z.string(),
    email: z.email(),
    name: z.string(),
    targetTier: z.string(),
    submissionId: z.string(),
    reason: z.string(),
    autoRejected: z.boolean()
  }),
})

export const KycEventSchema = z.discriminatedUnion("eventType", [
  kycPendingSchema,
  kycCompletedSchema,
  kycFailedSchema
]);

export type KycEvent = z.infer<typeof KycEventSchema>;