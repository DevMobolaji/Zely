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
  { topic: "transfer.retry.3", delayMs: 30_000 },
];

export const TRANSFER_MAX_RETRIES = TRANSFER_RETRY_LEVELS.length;


export function resolveRetryPolicy(aggregateType: string) {
  switch (aggregateType) {
    case "USER":
      return {
        levels: AUTH_RETRY_LEVELS,
        maxRetries: AUTH_MAX_RETRIES
      };

    case "TRANSACTION":
      return {
        levels: TRANSFER_RETRY_LEVELS,
        maxRetries: TRANSFER_MAX_RETRIES
      };

    default:
      throw new Error(`No retry policy for aggregateType: ${aggregateType}`);
  }
}