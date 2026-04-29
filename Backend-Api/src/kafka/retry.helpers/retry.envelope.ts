// export interface RetryEnvelope<T = any> {
//   meta: {
//     originalTopic: string;
//     originalConsumerGroup: string;
//     retryCount: number;
//     lastError?: string;
//     createdAt: string;
//   };
//   event: {
//     eventId: string;
//     eventType: string;
//     version: number;
//     aggregateType: string;
//     aggregateId: string;
//     payload: T;
//     occurredAt?: string;
//   };
// }


export type ProcessorType = "transfer" | "projection" | "auth" | "kyc";

export interface RetryEnvelopeMeta {
  retryCount: number;
  createdAt: string;
  originalConsumerGroup: string;
  originalTopic: string;
  lastError?: string;
  processor: ProcessorType; // ✅ explicit processor — retry consumer routes by this
}

export interface RetryEnvelope {
  meta: RetryEnvelopeMeta;
  event: any;
}
