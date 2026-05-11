// src/modules/payments/providers/mock.provider.ts
import { logger } from "@/shared/utils/logger";
import {
  PaymentProvider,
  InitializeTransactionParams,
  InitializeTransactionResult,
  VerifyTransactionResult,
  ParsedWebhookEvent,
} from "./payment.provider.interface";

export class MockProvider implements PaymentProvider {
  readonly providerName = "MOCK";

  /**
   * Mock initialization — returns a fake authorization URL.
   * No HTTP call, no real money, but mimics the shape Paystack returns.
   */
  async initializeTransaction(
    params: InitializeTransactionParams
  ): Promise<InitializeTransactionResult> {
    logger.info("[MOCK] Initializing transaction", {
      reference: params.reference,
      amount: params.amount,
      currency: params.currency,
      customerEmail: params.customerEmail,
    });

    // Simulate network latency (like a real API call would have)
    await sleep(50);

    // Generate a fake provider reference
    const providerReference = `mock_ref_${Date.now()}_${randomSuffix()}`;
    const accessCode = `mock_access_${randomSuffix()}`;

    // Return a fake authorization URL
    // In tests, calling this URL won't actually do anything — the test
    // simulates webhook delivery directly
    const authorizationUrl = `http://localhost:3001/mock-payment-page?reference=${params.reference}&providerRef=${providerReference}`;

    return {
      authorizationUrl,
      providerReference,
      accessCode,
      rawResponse: {
        status: true,
        message: "Mock authorization URL created",
        data: {
          authorization_url: authorizationUrl,
          access_code: accessCode,
          reference: params.reference,
        },
      },
    };
  }

  /**
   * Mock verification — returns success/fail based on reference pattern.
   *
   * For testing, encode the desired outcome in the reference:
   *   PAY_SUCCESS_xxx  → returns SUCCESS
   *   PAY_FAIL_xxx     → returns FAILED
   *   PAY_ABANDON_xxx  → returns ABANDONED
   *   PAY_PENDING_xxx  → returns PENDING (e.g., still being processed)
   *   anything else    → defaults to SUCCESS (the common test case)
   */
  async verifyTransaction(reference: string): Promise<VerifyTransactionResult> {
    logger.info("[MOCK] Verifying transaction", { reference });

    await sleep(30);

    const status = parseStatusFromReference(reference);

    return {
      status,
      amount: 0, // caller will validate against their stored amount
      currency: "NGN",
      paidAt: status === "SUCCESS" ? new Date() : undefined,
      channel: "mock_card",
      rawResponse: {
        status: true,
        message: "Verification successful",
        data: {
          status: status.toLowerCase(),
          reference,
          gateway_response: status === "SUCCESS" ? "Approved" : "Mock decline",
          paid_at: status === "SUCCESS" ? new Date().toISOString() : null,
          channel: "mock_card",
        },
      },
    };
  }

  /**
   * Mock signature verification — accepts any non-empty signature.
   * In real Paystack, this validates HMAC-SHA512.
   *
   * For tests that want to verify "invalid signature → 401", just pass
   * an empty string or "invalid".
   */
  verifyWebhookSignature(rawBody: string, signature: string): boolean {
    if (!signature || signature === "invalid") return false;
    if (!rawBody) return false;
    // Mock — any non-empty signature passes
    return true;
  }

  /**
   * Mock webhook parsing — assumes the payload roughly mimics Paystack's shape.
   * In real Paystack, we'd parse their specific JSON structure.
   */
  parseWebhookEvent(payload: any): ParsedWebhookEvent {
    logger.info("[MOCK] Parsing webhook event", { event: payload?.event });

    const reference = payload?.data?.reference || payload?.reference || "";
    const providerReference =
      payload?.data?.provider_reference || `mock_ref_${randomSuffix()}`;
    const amount = payload?.data?.amount || 0;
    const currency = payload?.data?.currency || "NGN";

    let type: ParsedWebhookEvent["type"];
    let status: ParsedWebhookEvent["status"];

    switch (payload?.event) {
      case "charge.success":
        type = "PAYMENT_SUCCESS";
        status = "SUCCESS";
        break;
      case "charge.failed":
        type = "PAYMENT_FAILED";
        status = "FAILED";
        break;
      case "refund.processed":
        type = "REFUND";
        status = "SUCCESS";
        break;
      case "charge.dispute.create":
        type = "DISPUTE";
        status = "SUCCESS";
        break;
      default:
        type = "UNKNOWN";
        status = "PENDING";
    }

    return {
      type,
      reference,
      providerReference,
      amount,
      currency,
      status,
      paidAt: status === "SUCCESS" ? new Date() : undefined,
      channel: payload?.data?.channel || "mock_card",
      customerEmail: payload?.data?.customer?.email,
      rawPayload: payload,
    };
  }
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randomSuffix(): string {
  return Math.random().toString(36).substring(2, 10);
}

function parseStatusFromReference(reference: string): VerifyTransactionResult["status"] {
  const upper = reference.toUpperCase();
  if (upper.includes("FAIL")) return "FAILED";
  if (upper.includes("ABANDON")) return "ABANDONED";
  if (upper.includes("PENDING")) return "PENDING";
  return "SUCCESS"; // default for testing happy path
}