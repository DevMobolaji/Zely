import z from "zod";
import { BaseEventSchema } from "./index.schema";

export const TransferCompletedV1Schema = BaseEventSchema.extend({
  eventType: z.literal("TRANSACTION_COMPLETED"),
  version: z.literal(1),
  aggregateType: z.literal("TRANSFER"),
  action: z.string(),
  status: z.string(),
  aggregateId: z.string(),
  eventId: z.string(),
  payload: z.object({
    sender: z.object({
      walletId: z.string(),
      userId: z.string(),
      email: z.string().email(),
      name: z.string(),
      previousBalance: z.number(),
      currentBalance: z.number(),
      accountNumber: z.string().optional(),
      accountType: z.string(),
      version: z.number(),
    }),
    receiver: z.object({
      walletId: z.string(),
      userId: z.string(),
      email: z.string(),
      name: z.string(),
      previousBalance: z.number(),
      currentBalance: z.number(),
      accountNumber: z.string(),
      accountType: z.string(),
      version: z.number(),
    }),
    fee: z.number().optional(),
    totalDeducted: z.number().optional(),
    referenceId: z.string(),
    transactionRef: z.string(),
    transferType: z.string(),
    limit: z.number().optional(),
    amount: z.number(),
    currency: z.string(),
  }),
});

const TransferFailedV1Schema = BaseEventSchema.extend({
  eventType: z.literal("TRANSFER_FAILED"),
  version: z.literal(1),
  aggregateType: z.literal("TRANSFER"),
  aggregateId: z.string(),
  payload: z.object({
    transactionRef: z.string(),
    reason: z.string(),
  }),
});

export const TransferEventSchema = z.discriminatedUnion("eventType", [
  TransferCompletedV1Schema,
  TransferFailedV1Schema,
]);

export type TransferEvent = z.infer<typeof TransferEventSchema>;
