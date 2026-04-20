import { z } from "zod";
import { BaseEventSchema } from "./user.schema";

export const VaultCreatedV1Schema = BaseEventSchema.extend({
  eventType: z.literal("VAULT_CREATED"),
  version: z.literal(1),
  aggregateType: z.literal("VAULT"),
  aggregateId: z.string(),
  payload: z.object({
    vaultId: z.string(),
    userId: z.string(),
    title: z.string(),
    targetAmountMinor: z.number(),
    targetDeadline: z.string(),
    autoSave: z.object({
      enabled: z.boolean(),
    }),
    lock: z.object({
      state: z.string(),
    }),
  }),
});

export const VaultCompletedV1Schema = BaseEventSchema.extend({
  eventType: z.literal("VAULT_TRANSFER_COMPLETED"),
  version: z.literal(1),
  aggregateType: z.literal("VAULT_TRANSFER"),
  aggregateId: z.string(),
  payload: z.object({
    sender: z.object({
      userId: z.string(),
      //email: z.string().email(),
      name: z.string(),
      previousBalance: z.number(),
      currentBalance: z.number(),
      accountNumber: z.string(),
      accountType: z.string(),
    }),
    receiver: z.object({
      userId: z.string(),
      //email: z.string().email(),
      vaultId: z.string(),
      previousBalance: z.number(),
      currentBalance: z.number(),
    }),
    referenceId: z.string(),
    transactionRef: z.string(),
    transferType: z.string(),
    amount: z.number(),
    currency: z.string(),
  }),
});



export const VaultEventSchema = z.discriminatedUnion("eventType", [
  VaultCreatedV1Schema,
  VaultCompletedV1Schema
]);

export type VaultEvent = z.infer<typeof VaultEventSchema>;
