export type ProcessorType =
  | "transfer"
  | "projection"
  | "auth"
  | "kyc"
  | "payment"
  | "funding"
  | "vault";

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
