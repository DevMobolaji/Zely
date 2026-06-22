// retry.policy.ts
export const AUTH_RETRY_LEVELS = [
  { topic: "auth.retry.1", delayMs: 3_000 },
  { topic: "auth.retry.2", delayMs: 5_000 },
  { topic: "auth.retry.3", delayMs: 7_000 },
  { topic: "auth.retry.4", delayMs: 9_000 },
  { topic: "auth.retry.5", delayMs: 11_000 },
];

export const AUTH_MAX_RETRIES = AUTH_RETRY_LEVELS.length;

export const TRANSFER_RETRY_LEVELS = [
  { topic: "transfer.retry.1", delayMs: 3_000 },
  { topic: "transfer.retry.2", delayMs: 5_000 },
  { topic: "transfer.retry.3", delayMs: 7_000 },
  { topic: "transfer.retry.4", delayMs: 11_000 },
  { topic: "transfer.retry.5", delayMs: 30_000 },
];

export const TRANSFER_MAX_RETRIES = TRANSFER_RETRY_LEVELS.length;

export const KYC_RETRY_LEVELS = [
  { topic: "kyc.retry.1", delayMs: 5_000 }, // 5 seconds
  { topic: "kyc.retry.2", delayMs: 30_000 }, // 30 seconds
  { topic: "kyc.retry.3", delayMs: 120_000 }, // 2 minutes
  { topic: "kyc.retry.4", delayMs: 600_000 }, // 10 minutes
  { topic: "kyc.retry.5", delayMs: 3_600_000 }, // 1 hour
];

export const KYC_MAX_RETRIES = KYC_RETRY_LEVELS.length;

export const PAYMENT_RETRY_LEVELS = [
  { topic: "payment.retry.1", delayMs: 5_000 }, // 5 seconds
  { topic: "payment.retry.2", delayMs: 30_000 }, // 30 seconds
  { topic: "payment.retry.3", delayMs: 120_000 }, // 2 minutes
  { topic: "payment.retry.4", delayMs: 600_000 }, // 10 minutes
  { topic: "payment.retry.5", delayMs: 3_600_000 }, // 1 hour
];

export const PAYMENT_MAX_RETRIES = PAYMENT_RETRY_LEVELS.length;

export const FUNDING_RETRY_LEVELS = [
  { topic: "funding.retry.1", delayMs: 5_000 }, // 5 seconds
  { topic: "funding.retry.2", delayMs: 30_000 }, // 30 seconds
  { topic: "funding.retry.3", delayMs: 120_000 }, // 2 minutes
  { topic: "funding.retry.4", delayMs: 600_000 }, // 10 minutes
  { topic: "funding.retry.5", delayMs: 3_600_000 }, // 1 hour
];

export const FUNDING_MAX_RETRIES = FUNDING_RETRY_LEVELS.length;

export const VAULT_RETRY_LEVELS = [
  { topic: "funding.retry.1", delayMs: 5_000 }, // 5 seconds
  { topic: "funding.retry.2", delayMs: 30_000 }, // 30 seconds
  { topic: "funding.retry.3", delayMs: 120_000 }, // 2 minutes
  { topic: "funding.retry.4", delayMs: 600_000 }, // 10 minutes
  { topic: "funding.retry.5", delayMs: 3_600_000 }, // 1 hour
];

export const VAULT_MAX_RETRIES = VAULT_RETRY_LEVELS.length;

export function resolveRetryPolicy(aggregateType: string) {
  switch (aggregateType) {
    case "USER":
      return {
        levels: AUTH_RETRY_LEVELS,
        maxRetries: AUTH_MAX_RETRIES,
      };

    case "TRANSFER":
      return {
        levels: TRANSFER_RETRY_LEVELS,
        maxRetries: TRANSFER_MAX_RETRIES,
      };

    case "KYC":
      return {
        levels: KYC_RETRY_LEVELS,
        maxRetries: KYC_MAX_RETRIES,
      };

    case "PAYMENT":
      return {
        levels: PAYMENT_RETRY_LEVELS,
        maxRetries: PAYMENT_MAX_RETRIES,
      };

    case "FUNDING":
      return {
        levels: FUNDING_RETRY_LEVELS,
        maxRetries: FUNDING_MAX_RETRIES,
      };

    case "VAULT":
      return {
        levels: VAULT_RETRY_LEVELS,
        maxRetries: VAULT_MAX_RETRIES,
      };

    default:
      throw new Error(`No retry policy for aggregateType: ${aggregateType}`);
  }
}
