export type WebhookEventType =
  | "PAYMENT_SUCCESS"
  | "PAYMENT_FAILED"
  | "REFUND"
  | "DISPUTE"
  | "UNKNOWN";

export interface InitializeTransactionParams {
  amount: number;
  currency: string
  customerEmail: string;
  reference: string;
  callbackUrl: String;
  metadata: Record<string, any>
}


export interface InitializeTransactionResult {
  authorizationUrl: string;   // user gets redirected here
  providerReference: string;  // provider's own reference ID
  accessCode?: string;        // some providers use this for additional auth
  rawResponse: any;           // full provider response (for archiving)
}

export interface VerifyTransactionResult {
  status: "SUCCESS" | "FAILED" | "PENDING" | "ABANDONED";
  amount: number;             // amount in minor units (verify against our record)
  currency: string;
  paidAt?: Date;
  channel?: string;           // "card" | "bank_transfer" | "ussd" etc.
  rawResponse: any;
}

export interface ParsedWebhookEvent {
  type: WebhookEventType;
  reference: string;          // OUR reference (so we can look up our record)
  providerReference: string;  // their reference
  amount: number;
  currency: string;
  status: "SUCCESS" | "FAILED" | "PENDING" | "ABANDONED";
  paidAt?: Date;
  channel?: string;
  customerEmail?: string;
  rawPayload: any;            // full original payload
}

// ─── The contract every provider implements ────────────────────────────────

export interface PaymentProvider {
  readonly providerName: string;

  /**
   * Initialize a payment. Returns a URL the user gets redirected to.
   * Provider handles the actual charge — we just kick it off.
   */
  initializeTransaction(
    params: InitializeTransactionParams
  ): Promise<InitializeTransactionResult>;

  /**
   * Check the current status of a transaction.
   * Used by polling fallback when webhooks fail.
   */
  verifyTransaction(reference: string): Promise<VerifyTransactionResult>;

  /**
   * Validate that a webhook came from the real provider.
   * Returns true if signature matches, false if forged.
   */
  verifyWebhookSignature(rawBody: string, signature: string): boolean;

  /**
   * Convert provider-specific webhook payload to our standard format.
   * Each provider has its own JSON shape — this normalizes it.
   */
  parseWebhookEvent(payload: any): ParsedWebhookEvent;
}
