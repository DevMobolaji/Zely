import { createCircuitBreaker, BrokenCircuitError } from '../circuit-breaker';
import { logger } from '@/shared/utils/logger';

// Resend circuit breaker
// Strategy: consecutive — opens after 5 failures in a row
// Email sending is less frequent so consecutive makes more sense here
export const resendBreaker = createCircuitBreaker({
  service: 'resend',
  strategy: 'consecutive',
  consecutiveFailures: 5,
  halfOpenAfter: 60_000, // wait 60 seconds before retrying
  // Don't trip on 4xx errors (bad request, invalid email etc)
  // Only trip on 5xx errors (server down, rate limit, etc)
  handleOnly: (err: any) => {
    const status = err?.statusCode ?? err?.status ?? 500;
    return status >= 500;
  },
});

export async function withResendBreaker<T>(
  fn: () => Promise<T>,
  context?: string
): Promise<T> {
  try {
    return await resendBreaker.execute(fn);
  } catch (err: any) {
    if (err instanceof BrokenCircuitError) {
      logger.error('Resend circuit breaker is OPEN — email will remain in outbox', { context });
      throw new Error('Email service temporarily unavailable. Email queued for retry.');
    }
    throw err;
  }
}