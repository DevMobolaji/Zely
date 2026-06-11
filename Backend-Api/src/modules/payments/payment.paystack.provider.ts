// src/modules/payments/providers/paystack.provider.ts
import { config } from "@/config/index";
import { logger } from "@/shared/utils/logger";
import axios, { AxiosInstance } from "axios";
import crypto from "crypto";
import {
  InitializeTransactionParams,
  InitializeTransactionResult,
  ParsedWebhookEvent,
  PaymentProvider,
  VerifyTransactionResult,
} from "./payment.provider.interface";

export class PaystackProvider implements PaymentProvider {
  readonly providerName = "PAYSTACK";
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: config.payment.paystack.baseUrl,
      headers: {
        Authorization: `Bearer ${config.payment.paystack.secretKey}`,
        "Content-Type": "application/json",
      },
      timeout: 30_000,
    });
  }

  // ─── Initialize a transaction ──────────────────────────────────────────────
  async initializeTransaction(
    params: InitializeTransactionParams,
  ): Promise<InitializeTransactionResult> {
    logger.info("[PAYSTACK] Initializing transaction", {
      reference: params.reference,
      amount: params.amount,
      currency: params.currency,
    });

    const response = await this.client.post("/transaction/initialize", {
      email: params.customerEmail,
      amount: params.amount * 100, // Paystack expects kobo
      reference: params.reference, // OUR reference — Paystack stores it
      currency: params.currency,
      callback_url: params.callbackUrl,
      metadata: params.metadata,
    });

    const { data } = response.data;

    if (!response.data.status) {
      throw new Error(
        `Paystack initialization failed: ${response.data.message}`,
      );
    }

    return {
      authorizationUrl: data.authorization_url,
      providerReference: data.reference, // Paystack echoes back our reference
      accessCode: data.access_code,
      rawResponse: response.data,
    };
  }

  // ─── Verify a transaction ──────────────────────────────────────────────────
  async verifyTransaction(reference: string): Promise<VerifyTransactionResult> {
    logger.info("[PAYSTACK] Verifying transaction", { reference });

    const response = await this.client.get(
      `/transaction/verify/${encodeURIComponent(reference)}`,
    );

    if (!response.data.status) {
      throw new Error(`Paystack verification failed: ${response.data.message}`);
    }

    const { data } = response.data;

    // Translate Paystack status to our internal status
    const status = this.translateStatus(data.status);

    return {
      status,
      amount: data.amount, // kobo
      currency: data.currency,
      paidAt: data.paid_at ? new Date(data.paid_at) : undefined,
      channel: data.channel,
      rawResponse: response.data,
    };
  }

  // ─── Verify webhook signature ──────────────────────────────────────────────
  verifyWebhookSignature(rawBody: string, signature: string): boolean {
    if (!signature || !rawBody) return false;

    const secret = config.payment.paystack.secretKey;

    if (!secret) {
      logger.error("PAYSTACK_WEBHOOK_SECRET not configured");
      return false;
    }

    const expectedSignature = crypto
      .createHmac("sha512", secret)
      .update(rawBody)
      .digest("hex");

    // Constant-time comparison — prevents timing attacks
    const sigBuffer = Buffer.from(signature, "hex");
    const expectedBuffer = Buffer.from(expectedSignature, "hex");

    if (sigBuffer.length !== expectedBuffer.length) return false;

    return crypto.timingSafeEqual(sigBuffer, expectedBuffer);
  }

  // ─── Parse webhook event ───────────────────────────────────────────────────
  parseWebhookEvent(payload: any): ParsedWebhookEvent {
    logger.info("[PAYSTACK] Parsing webhook event", {
      event: payload?.event,
    });

    const data = payload?.data || {};
    const reference = data.reference || "";
    const providerReference = data.reference || "";
    const amount = data.amount || 0;
    const currency = data.currency || "NGN";

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
      paidAt: data.paid_at ? new Date(data.paid_at) : undefined,
      channel: data.channel,
      customerEmail: data.customer?.email,
      rawPayload: payload,
    };
  }

  // ─── Translate Paystack status to our internal status ─────────────────────
  private translateStatus(
    paystackStatus: string,
  ): VerifyTransactionResult["status"] {
    switch (paystackStatus.toLowerCase()) {
      case "success":
        return "SUCCESS";
      case "failed":
        return "FAILED";
      case "abandoned":
        return "ABANDONED";
      case "pending":
      default:
        return "PENDING";
    }
  }
}
