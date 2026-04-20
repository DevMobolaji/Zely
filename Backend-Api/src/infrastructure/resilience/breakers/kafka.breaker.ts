import { createCircuitBreaker, BrokenCircuitError } from '../circuit-breaker';
import { logger } from '@/shared/utils/logger';

// Kafka producer circuit breaker
// Strategy: consecutive — opens after 5 failures in a row
// The outbox pattern means Kafka going down doesn't lose data
// Events are in the outbox and Debezium will route them when Kafka recovers
export const kafkaBreaker = createCircuitBreaker({
  service: 'kafka',
  strategy: 'consecutive',
  consecutiveFailures: 5,
  halfOpenAfter: 30_000, // try again after 30 seconds
});

export async function withKafkaBreaker<T>(
  fn: () => Promise<T>,
  context?: string
): Promise<T> {
  try {
    return await kafkaBreaker.execute(fn);
  } catch (err: any) {
    if (err instanceof BrokenCircuitError) {
      logger.warn('Kafka circuit breaker is OPEN — outbox will handle delivery when Kafka recovers', {
        context,
      });
      // Don't throw — Kafka being down doesn't mean the operation failed
      // The outbox pattern guarantees eventual delivery
      return undefined as unknown as T;
    }
    throw err;
  }
}