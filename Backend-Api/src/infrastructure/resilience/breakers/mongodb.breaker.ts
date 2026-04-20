import { createCircuitBreaker, BrokenCircuitError } from '../circuit-breaker';
import { logger } from '@/shared/utils/logger';

// MongoDB circuit breaker
// Strategy: sampling — opens when 50% of requests fail in a 30s window
// This is better than consecutive for MongoDB because occasional slow queries
// shouldn't trip the circuit — we care about sustained failure rates
export const mongoBreaker = createCircuitBreaker({
  service: 'mongodb',
  strategy: 'sampling',
  samplingThreshold: 0.5,   // 50% failure rate
  samplingDuration: 30_000, // over 30 seconds
  halfOpenAfter: 10_000,    // try again after 10 seconds
  // Don't trip on validation errors — only real DB errors
  handleOnly: (err) => {
    const skipErrors = ['ValidationError', 'CastError'];
    return !skipErrors.includes(err.name);
  },
});

// Convenience wrapper — use this everywhere you call MongoDB
export async function withMongoBreaker<T>(
  fn: () => Promise<T>,
  context?: string
): Promise<T> {
  try {
    return await mongoBreaker.execute(fn);
  } catch (err: any) {
    if (err instanceof BrokenCircuitError) {
      logger.error('MongoDB circuit breaker is OPEN — failing fast', { context });
      throw new Error('Database temporarily unavailable. Please try again in a moment.');
    }
    throw err;
  }
}