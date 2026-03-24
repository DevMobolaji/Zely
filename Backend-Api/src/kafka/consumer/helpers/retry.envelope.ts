export interface RetryEnvelope<T = any> {
  meta: {
    originalTopic: string;
    originalConsumerGroup: string;
    retryCount: number;
    lastError?: string;
    createdAt: string;
  };
  event: {
    eventId: string;
    eventType: string;
    version: number;
    aggregateType: string;
    aggregateId: string;
    payload: T;
    occurredAt?: string;
  };
}
