import { Registry, Counter, Gauge, Histogram, collectDefaultMetrics } from 'prom-client';

// ─── Registry ────────────────────────────────────────────────────────────────
// One registry per app — all metrics registered here
export const registry = new Registry();

// Collect default Node.js metrics (memory, CPU, event loop lag, etc.)
collectDefaultMetrics({ register: registry });

// ─── Circuit Breaker Metrics ──────────────────────────────────────────────────
export const circuitBreakerState = new Gauge({
  name: 'circuit_breaker_state',
  help: 'Current state of circuit breaker (0=closed, 1=open, 2=half-open)',
  labelNames: ['service'],
  registers: [registry],
});

export const circuitBreakerOpenTotal = new Counter({
  name: 'circuit_breaker_open_total',
  help: 'Total number of times circuit breaker opened',
  labelNames: ['service'],
  registers: [registry],
});

export const circuitBreakerFailureTotal = new Counter({
  name: 'circuit_breaker_failure_total',
  help: 'Total number of failures recorded by circuit breaker',
  labelNames: ['service'],
  registers: [registry],
});

export const circuitBreakerSuccessTotal = new Counter({
  name: 'circuit_breaker_success_total',
  help: 'Total number of successes recorded by circuit breaker',
  labelNames: ['service'],
  registers: [registry],
});

// ─── Kafka Metrics ────────────────────────────────────────────────────────────
export const kafkaConsumerLag = new Gauge({
  name: 'kafka_consumer_lag',
  help: 'Current consumer lag per topic and partition',
  labelNames: ['topic', 'partition', 'consumer_group'],
  registers: [registry],
});

export const kafkaMessagesProcessedTotal = new Counter({
  name: 'kafka_messages_processed_total',
  help: 'Total messages processed per consumer group',
  labelNames: ['topic', 'consumer_group'],
  registers: [registry],
});

export const kafkaMessagesFailedTotal = new Counter({
  name: 'kafka_messages_failed_total',
  help: 'Total messages failed per consumer group',
  labelNames: ['topic', 'consumer_group'],
  registers: [registry],
});

export const kafkaProcessingDuration = new Histogram({
  name: 'kafka_message_processing_duration_ms',
  help: 'Duration of Kafka message processing in milliseconds',
  labelNames: ['topic', 'consumer_group'],
  buckets: [10, 50, 100, 200, 500, 1000, 2000, 5000],
  registers: [registry],
});

// ─── MongoDB Metrics ──────────────────────────────────────────────────────────
export const mongoOperationDuration = new Histogram({
  name: 'mongo_operation_duration_ms',
  help: 'Duration of MongoDB operations in milliseconds',
  labelNames: ['operation', 'collection'],
  buckets: [5, 10, 25, 50, 100, 250, 500, 1000],
  registers: [registry],
});

export const mongoTransactionTotal = new Counter({
  name: 'mongo_transaction_total',
  help: 'Total MongoDB transactions',
  labelNames: ['status'], // success | failure
  registers: [registry],
});


// ─── HTTP Metrics ─────────────────────────────────────────────────────────────
export const httpRequestTotal = new Counter({
  name: 'http_request_total',
  help: 'Total HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
  registers: [registry],
});

export const httpRequestDuration = new Histogram({
  name: 'http_request_duration_ms',
  help: 'Duration of HTTP requests in milliseconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [10, 50, 100, 200, 500, 1000, 2000, 5000],
  registers: [registry],
});

export const httpErrorTotal = new Counter({
  name: 'http_error_total',
  help: 'Total HTTP errors',
  labelNames: ['method', 'route', 'status_code'],
  registers: [registry],
});