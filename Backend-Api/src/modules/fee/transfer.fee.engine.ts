import { FeeConfig } from './fee.model';
import { logger } from '@/shared/utils/logger';

// ─── Types ────────────────────────────────────────────────────────────────────
interface IFeeTier {
  min: number;
  max: number;
  fee: number;
}

interface CachedFeeConfig {
  tiers: IFeeTier[];
  cachedAt: number;
}

// ─── Cache ────────────────────────────────────────────────────────────────────
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes
const feeConfigCache = new Map<string, CachedFeeConfig>();

// ─── Fallback tiers ───────────────────────────────────────────────────────────
const FALLBACK_FEE_TIERS: IFeeTier[] = [
  { min: 1, max: 1_000, fee: 10 },
  { min: 1_001, max: 5_000, fee: 25 },
  { min: 5_001, max: 10_000, fee: 50 },
  { min: 10_001, max: 50_000, fee: 100 },
  { min: 50_001, max: 999_999_999, fee: 200 },
];

// ─── Load tiers from DB ───────────────────────────────────────────────────────
async function getFeeConfig(
  currency: string,
  transferType: string
): Promise<IFeeTier[]> {
  const cacheKey = `${currency}:${transferType}`;
  const cached = feeConfigCache.get(cacheKey);

  // Return cached if still fresh
  if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
    return cached.tiers;
  }

  try {
    const config = await FeeConfig.findOne({
      currency,
      transferType,
      isActive: true,
    });

    if (!config) {
      logger.warn(`No fee config in DB for ${currency}/${transferType} — using fallback`);
      return FALLBACK_FEE_TIERS;
    }

    feeConfigCache.set(cacheKey, {
      tiers: config.tiers,
      cachedAt: Date.now(),
    });

    return config.tiers;

  } catch (err: any) {
    logger.error('Failed to load fee config from DB — using fallback tiers', {
      error: err.message,
      currency,
      transferType,
    });

    // Cache fallback with shorter TTL — retry DB sooner when it recovers
    feeConfigCache.set(cacheKey, {
      tiers: FALLBACK_FEE_TIERS,
      cachedAt: Date.now() - (CACHE_TTL_MS - 5 * 60 * 1000),
    });

    return FALLBACK_FEE_TIERS;
  }
}

// ─── Clear cache ──────────────────────────────────────────────────────────────
export function clearFeeConfigCache(): void {
  feeConfigCache.clear();
  logger.info('Fee config cache cleared');
}

// ─── Fee calculation ──────────────────────────────────────────────────────────
export async function calculateFeeBreakdown(
  amount: number,
  currency: string,
  transferType: string = 'P2P_TRANSFER'
): Promise<{ fee: number; totalDeducted: number; currency: string }> {
  const tiers = await getFeeConfig(currency, transferType);
  const tier = tiers.find(t => amount >= t.min && amount <= t.max);
  const fee = tier ? tier.fee : 0;

  return {
    fee,
    totalDeducted: amount + fee,
    currency,
  };
}