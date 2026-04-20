import {
  circuitBreaker,
  handleAll,
  handleWhen,
  ConsecutiveBreaker,
  SamplingBreaker,
  ExponentialBackoff,
  retry,
  wrap,
  BrokenCircuitError,
  IPolicy,
} from 'cockatiel';
import { logger } from '@/shared/utils/logger';
import {
  circuitBreakerState,
  circuitBreakerOpenTotal,
  circuitBreakerFailureTotal,
  circuitBreakerSuccessTotal,
} from './metrics';

// ─── Types ────────────────────────────────────────────────────────────────────
export interface CircuitBreakerConfig {
  // Service name — used for logging and metrics labels
  service: string;

  // Breaker strategy
  // 'consecutive' — opens after N failures in a row (good for Resend, Redis)
  // 'sampling'    — opens when X% of requests fail in a time window (good for MongoDB, Kafka)
  strategy: 'consecutive' | 'sampling';

  // For consecutive breaker — number of failures before opening
  consecutiveFailures?: number;

  // For sampling breaker — failure rate threshold (0-1) and window duration in ms
  samplingThreshold?: number;
  samplingDuration?: number;

  // How long to wait before trying again (ms)
  halfOpenAfter: number;

  // Optional retry policy to wrap around the breaker
  retry?: {
    maxAttempts: number;
    initialDelayMs: number;
  };

  // Which errors should trip the circuit
  // Default: all errors
  handleOnly?: (err: Error) => boolean;
}

export interface CircuitBreakerWrapper<T> {
  // Execute a function through the circuit breaker
  execute: <R>(fn: () => Promise<R>) => Promise<R>;
  // Check if circuit is currently open
  isOpen: () => boolean;
  // Get current state as string
  getState: () => 'closed' | 'open' | 'half-open';
}

// ─── State tracking ───────────────────────────────────────────────────────────
const STATE_VALUES = {
  closed: 0,
  open: 1,
  'half-open': 2,
} as const;

// ─── Factory ──────────────────────────────────────────────────────────────────
export function createCircuitBreaker<T>(
  config: CircuitBreakerConfig
): CircuitBreakerWrapper<T> {
  const {
    service,
    strategy,
    consecutiveFailures = 5,
    samplingThreshold = 0.5,
    samplingDuration = 30_000,
    halfOpenAfter,
    handleOnly,
  } = config;

  // Build error policy
  const errorPolicy = handleOnly
    ? handleWhen(handleOnly)
    : handleAll;

  // Build breaker strategy
  const breakerStrategy = strategy === 'consecutive'
    ? new ConsecutiveBreaker(consecutiveFailures)
    : new SamplingBreaker({
      threshold: samplingThreshold,
      duration: samplingDuration,
    });

  // Build circuit breaker policy
  const breaker = circuitBreaker(errorPolicy, {
    halfOpenAfter,
    breaker: breakerStrategy,
  });

  // ── Track state ─────────────────────────────────────────────────────────────
  let currentState: 'closed' | 'open' | 'half-open' = 'closed';

  const updateState = (state: 'closed' | 'open' | 'half-open') => {
    currentState = state;
    circuitBreakerState.set({ service }, STATE_VALUES[state]);
  };

  // ── Wire events ─────────────────────────────────────────────────────────────
  breaker.onBreak(() => {
    updateState('open');
    circuitBreakerOpenTotal.inc({ service });
    logger.error(`Circuit breaker OPENED for service: ${service}`, { service });
  });

  breaker.onReset(() => {
    updateState('closed');
    logger.info(`Circuit breaker CLOSED for service: ${service}`, { service });
  });

  breaker.onHalfOpen(() => {
    updateState('half-open');
    logger.warn(`Circuit breaker HALF-OPEN for service: ${service} — testing recovery`, { service });
  });

  breaker.onSuccess(() => {
    circuitBreakerSuccessTotal.inc({ service });
  });

  breaker.onFailure(() => {
    circuitBreakerFailureTotal.inc({ service });
  });

  // ── Build final policy ──────────────────────────────────────────────────────
  // Optionally wrap with retry
  let policy: IPolicy;

  if (config.retry) {
    const retryPolicy = retry(errorPolicy, {
      maxAttempts: config.retry.maxAttempts,
      backoff: new ExponentialBackoff({
        initialDelay: config.retry.initialDelayMs,
        maxDelay: 30_000,
      }),
    });
    policy = wrap(retryPolicy, breaker);
  } else {
    policy = breaker;
  }

  // Initialize state metric
  updateState('closed');

  return {
    execute: <R>(fn: () => Promise<R>): Promise<R> => {
      return policy.execute(fn);
    },

    isOpen: () => currentState === 'open',

    getState: () => currentState,
  };
}

// Re-export BrokenCircuitError so callers can catch it
export { BrokenCircuitError };