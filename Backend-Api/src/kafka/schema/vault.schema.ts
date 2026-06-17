import { z } from "zod";
import { BaseEventSchema } from "./index.schema";

/**
 * VAULT CREATED PAYLOADS
 */

const FlexibleVaultPayloadSchema = z.object({
  vaultType: z.literal("FLEXIBLE"),
  vaultId: z.string(),
  userId: z.string(),
  title: z.string(),
  targetAmountMinor: z.number(),
});

const TargetVaultPayloadSchema = z.object({
  vaultType: z.literal("TARGET"),
  vaultId: z.string(),
  userId: z.string(),
  title: z.string(),
  targetAmountMinor: z.number(),
});

const LockedVaultPayloadSchema = z.object({
  vaultType: z.literal("LOCKED"),
  vaultId: z.string(),
  userId: z.string(),
  title: z.string(),
  targetAmountMinor: z.number(),
  lockedUntil: z.string(),
});

/**
 * VAULT CREATED
 */

export const VaultCreatedV1Schema = BaseEventSchema.extend({
  eventType: z.literal("VAULT_CREATED"),
  version: z.literal(1),
  aggregateType: z.literal("VAULT"),
  aggregateId: z.string(),

  payload: z.discriminatedUnion("vaultType", [
    FlexibleVaultPayloadSchema,
    TargetVaultPayloadSchema,
    LockedVaultPayloadSchema,
  ]),
});

/**
 * VAULT TRANSFER COMPLETED
 */

export const VaultCompletedV1Schema = BaseEventSchema.extend({
  eventType: z.literal("VAULT_TRANSFER_COMPLETED"),
  version: z.literal(1),
  aggregateType: z.literal("VAULT_TRANSFER"),
  aggregateId: z.string(),

  payload: z.object({
    sender: z.object({
      userId: z.string(),
      name: z.string(),
      previousBalance: z.number(),
      currentBalance: z.number(),
      accountNumber: z.string(),
      accountType: z.string(),
    }),

    receiver: z.object({
      userId: z.string(),
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

export const VaultWithdrawalV1Schema = BaseEventSchema.extend({
  eventType: z.literal("VAULT_WITHDRAWAL"),
  version: z.literal(1),
  aggregateType: z.literal("VAULT"),
  aggregateId: z.string(),

  payload: z.object({
    vaultId: z.string(),
    userId: z.string(),

    amount: z.number(),
    userReceives: z.number(),

    penaltyAmount: z.number(),
    penaltyApplied: z.boolean(),
    penaltyReason: z.string(),

    newBalance: z.number(),
    currency: z.string(),
    type: z.string(),
  }),
});

/**
 * VAULT CLOSED
 */

export const VaultClosedV1Schema = BaseEventSchema.extend({
  eventType: z.literal("VAULT_CLOSED"),
  version: z.literal(1),
  aggregateType: z.literal("VAULT"),
  aggregateId: z.string(),

  payload: z.object({
    vaultId: z.string(),
    userId: z.string(),
    title: z.string(),

    vaultType: z.enum(["FLEXIBLE", "TARGET", "LOCKED"]),

    finalBalanceWithdrawn: z.number(),
    penaltyApplied: z.boolean(),
    penaltyAmount: z.number(),
  }),
});

/**
 * UNION
 */

export const VaultEventSchema = z.discriminatedUnion("eventType", [
  VaultCreatedV1Schema,
  VaultCompletedV1Schema,
  VaultClosedV1Schema,
  VaultWithdrawalV1Schema,
]);

export type VaultEvent = z.infer<typeof VaultEventSchema>;
