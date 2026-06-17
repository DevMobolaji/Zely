import { FundingEventSchema } from "@/kafka/schema/funding.schema";
import { KycEventSchema } from "@/kafka/schema/kyc.schema";
import { PaymentEventSchema } from "@/kafka/schema/payment.schema";
import { TransferEventSchema } from "@/kafka/schema/transfer.schema";
import { AuthEventSchema } from "@/kafka/schema/user.schema";
import { VaultEventSchema } from "@/kafka/schema/vault.schema";
import { WalletEventSchema } from "@/kafka/schema/wallet.schema";
import z from "zod";

export const RetryEnvelopeSchema = z.object({
  meta: z.object({
    retryCount: z.number(),
    createdAt: z.string(),
    lastError: z.string().optional(),
    originalConsumerGroup: z.string().optional(),
    originalTopic: z.string(),
    processor: z.enum([
      "transfer",
      "projection",
      "auth",
      "kyc",
      "funding",
      "payment",
    ]),
  }),
  event: z.union([
    AuthEventSchema,
    TransferEventSchema,
    KycEventSchema,
    PaymentEventSchema,
    WalletEventSchema,
    FundingEventSchema,
    VaultEventSchema,
  ]),
});
