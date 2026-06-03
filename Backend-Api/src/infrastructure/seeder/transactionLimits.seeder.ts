import {
  KycTier,
  TransactionLimitConfig,
} from "@/modules/transactionLimit/transaction.limit.model";
import { logger } from "@/shared/utils/logger";

const DEFAULT_LIMITS = [
  {
    tier: KycTier.TIER_1,
    currency: "NGN",
    maxPerTransaction: 50_000,
    maxPerDay: 200_000,
    maxWalletBalance: 500_000,
    maxTransfersPerHour: 5,
  },
  {
    tier: KycTier.TIER_2,
    currency: "NGN",
    maxPerTransaction: 200_000,
    maxPerDay: 500_000,
    maxWalletBalance: 1_000_000,
    maxTransfersPerHour: 20,
  },
  {
    tier: KycTier.TIER_3,
    currency: "NGN",
    maxPerTransaction: 5_000_000,
    maxPerDay: 0, // unlimited
    maxWalletBalance: 0, // unlimited
    maxTransfersPerHour: 0, // unlimited
  },
];

export async function ensureTransactionLimits(): Promise<void> {
  for (const limit of DEFAULT_LIMITS) {
    await TransactionLimitConfig.findOneAndUpdate(
      { tier: limit.tier, currency: limit.currency },
      { $setOnInsert: limit },
      { upsert: true, new: true },
    );
  }
  //logger.info("✅ Transaction limit configs ensured");
}
