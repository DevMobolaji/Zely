import { createCircuitBreaker, BrokenCircuitError } from '../circuit-breaker';
import { logger } from '@/shared/utils/logger';

// Redis circuit breaker
// Strategy: consecutive — opens after 3 failures in a row
// Redis failures are usually binary (up or down) so consecutive is correct
export const redisBreaker = createCircuitBreaker({
  service: 'redis',
  strategy: 'consecutive',
  consecutiveFailures: 3,
  halfOpenAfter: 15_000, // try again after 15 seconds
});

export async function withRedisBreaker<T>(
  fn: () => Promise<T>,
  fallback: () => Promise<T>,
  context?: string
): Promise<T> {
  try {
    return await redisBreaker.execute(fn);
  } catch (err: any) {
    if (err instanceof BrokenCircuitError) {
      logger.warn('Redis circuit breaker is OPEN — falling back to MongoDB polling', { context });
      return fallback();
    }
    throw err;
  }
}