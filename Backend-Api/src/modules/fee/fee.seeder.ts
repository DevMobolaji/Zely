// src/db/seeders/fee.config.seeder.ts
import { FeeConfig } from "./fee.model";
import { logger } from '@/shared/utils/logger';

const DEFAULT_NGN_P2P_TIERS = [
  { min: 1, max: 1_000, fee: 10 },
  { min: 1_001, max: 5_000, fee: 25 },
  { min: 5_001, max: 10_000, fee: 50 },
  { min: 10_001, max: 50_000, fee: 100 },
  { min: 50_001, max: 999_999_999, fee: 200 },
];

export async function seedFeeConfig(): Promise<void> {
  const existing = await FeeConfig.findOne({
    currency: 'NGN',
    transferType: 'P2P_TRANSFER',
  });

  if (existing) {
    logger.info('Fee config already exists — skipping seed');
    return;
  }

  await FeeConfig.create({
    currency: 'NGN',
    transferType: 'P2P_TRANSFER',
    tiers: DEFAULT_NGN_P2P_TIERS,
    isActive: true,
  });

  logger.info('✅ Default fee config seeded');
}