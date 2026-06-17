import z from "zod";
import { BaseEventSchema } from "./index.schema";

// ─── Per-event payload schemas ──────────────────────────────────
const PaymentInitiatedPayload = z.object({
  reference: z.string(),
  providerName: z.string(),
  providerReference: z.string(),
  amount: z.number(),
  currency: z.string(),
  purpose: z.string(),
  targetWalletId: z.string(),
  targetWalletType: z.string(),
  userPublicId: z.string(),
  userEmail: z.string().email(),
});

const PaymentSucceededPayload = z.object({
  reference: z.string(),
  providerReference: z.string(),
  amount: z.number(),
  currency: z.string(),
  purpose: z.string(),
  targetWalletId: z.string(),
  userPublicId: z.string(),
  fundingTransactionRef: z.string(),
  previousBalance: z.number(),
  currentBalance: z.number(),
});

const PaymentFailedPayload = z.object({
  reference: z.string(),
  providerName: z.string(),
  amount: z.number(),
  currency: z.string(),
  purpose: z.string(),
  targetWalletId: z.string(),
  userPublicId: z.string(),
  failureReason: z.string(),
  status: z.string(),
  completedAt: z.string().or(z.date()),
});

const PaymentDisputedPayload = z.object({
  reference: z.string(),
  providerReference: z.string(),
  amount: z.number(),
  currency: z.string(),
  targetWalletId: z.string(),
  userPublicId: z.string(),
  reason: z.string(),
  requiresManualResolution: z.boolean(),
});

export const PaymentInitiatedEventSchema = BaseEventSchema.extend({
  eventType: z.literal("PAYMENT_INITIATED"),
  aggregateType: z.literal("PAYMENT_INITIATION"),
  payload: PaymentInitiatedPayload,
});

export const PaymentSucceededEventSchema = BaseEventSchema.extend({
  eventType: z.literal("PAYMENT_SUCCEEDED"),
  aggregateType: z.literal("PAYMENT_SUCCESS"),
  payload: PaymentSucceededPayload,
});

export const PaymentFailedEventSchema = BaseEventSchema.extend({
  eventType: z.literal("PAYMENT_FAILED"),
  aggregateType: z.literal("PAYMENT_INITIATION"),
  payload: PaymentFailedPayload,
});

export const PaymentDisputedEventSchema = BaseEventSchema.extend({
  eventType: z.literal("PAYMENT_DISPUTED"),
  aggregateType: z.literal("PAYMENT_DISPUTED"),
  payload: PaymentDisputedPayload,
});

export const PaymentEventSchema = z.discriminatedUnion("eventType", [
  PaymentInitiatedEventSchema,
  PaymentSucceededEventSchema,
  PaymentFailedEventSchema,
  PaymentDisputedEventSchema,
]);
export type AnyPaymentEvent = z.infer<typeof PaymentEventSchema>;
