// wallet.schema.ts
import z from "zod";
import { BaseEventSchema } from "./index.schema";

const WalletFrozenSchema = BaseEventSchema.extend({
  eventType: z.literal("WALLET_FROZEN"),
  aggregateType: z.literal("WALLET"),
  payload: z.object({
    walletId: z.string(),
    userPublicId: z.string(),
    reason: z.string(),
    frozenBy: z.string().optional(),
  }),
});

const WalletUnfrozenSchema = BaseEventSchema.extend({
  eventType: z.literal("WALLET_UNFROZEN"),
  aggregateType: z.literal("WALLET"),
  payload: z.object({
    walletId: z.string(),
    userPublicId: z.string(),
    unfreezeReason: z.string().optional(),
    unfrozenBy: z.string().optional(),
  }),
});

export const WalletEventSchema = z.discriminatedUnion("eventType", [
  WalletFrozenSchema,
  WalletUnfrozenSchema,
]);

export type WalletEvent = z.infer<typeof WalletEventSchema>;
