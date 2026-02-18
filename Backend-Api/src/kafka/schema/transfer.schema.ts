import z from "zod";
import { BaseEventSchema } from "./user.schema";

export const TransferCompletedV1Schema = BaseEventSchema.extend({
  eventType: z.literal("TRANSACTION_COMPLETED"),
  version: z.literal(1),
  aggregateType: z.literal("TRANSFER"),
  aggregateId: z.string(),
  payload: z.object({
    sender: z.object({
      userId: z.string(),
      email: z.string().email(),
      name: z.string(),
      previousBalance: z.number(),
      currentBalance: z.number(),
      accountNumber: z.string(),
      accountType: z.string(),
    }),
    receiver: z.object({
      userId: z.string(),
      email: z.string().email(),
      name: z.string(),
      previousBalance: z.number(),
      currentBalance: z.number(),
      accountNumber: z.string(),
      accountType: z.string(),
    }),
    referenceId: z.string(),
    transactionRef: z.string(),
    transferType: z.string(),
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