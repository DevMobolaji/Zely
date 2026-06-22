// funding.schema.ts
import z from "zod";
import { BaseEventSchema } from "./index.schema";

const FundingCreditedSchema = BaseEventSchema.extend({
  eventType: z.literal("FUNDING_CREDITED"),
  aggregateType: z.literal("FUNDING"),
  payload: z.object({
    transactionRef: z.string(),
    source: z.string(),
    providerReference: z.string().optional(),
    amount: z.number(),
    currency: z.string(),
    targetWalletId: z.string(),
    targetWalletType: z.string().optional(),
    targetUserPublicId: z.string().optional(), // ← corrected
    userPublicId: z.string().optional(), // ← keep for backward compat
    initiatedByUserId: z.string().optional(), // ← add
    previousBalance: z.number().optional(),
    currentBalance: z.number().optional(),
    metadata: z.record(z.string(), z.any()).optional(), // ← add
  }),
});

export const FundingEventSchema = z.discriminatedUnion("eventType", [
  FundingCreditedSchema,
]);

export type FundingEvent = z.infer<typeof FundingEventSchema>;
