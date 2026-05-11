// src/modules/payments/webhook.controller.ts
import { Request, Response, Router } from "express";
import { StatusCodes } from "http-status-codes";
import asyncWrapper from "@/shared/middleware/async.wrapper";
import { getRequestContext } from "@/shared/middleware/request.context";
import Controller from "@/config/interfaces/controller.interfaces";
import PaymentService from "./payment.service";
import { logger } from "@/shared/utils/logger";

class WebhookController implements Controller {
  public path = "/webhooks";
  public route = Router();
  private paymentService = new PaymentService();

  constructor() {
    this.initializeRoutes();
  }

  private initializeRoutes(): void {
    // CRITICAL: use express.raw() instead of express.json()
    // We need the raw body bytes for HMAC signature verification.
    // If we let express.json() parse first, the bytes would be re-serialized
    // and the signature would no longer match.
    this.route.post(
      `${this.path}/payments`,
      this.handlePaymentWebhook
    );
  }

  private handlePaymentWebhook = asyncWrapper(async (req: Request, res: Response) => {
    const ctx = getRequestContext(req as any);


    // Body is a Buffer (from express.raw)
    const rawBody = (req as any).rawBody || "";

    // 🔍 DEBUG
    console.log("DEBUG webhook:", {
      hasRawBody: !!rawBody,
      rawBodyLength: rawBody.length,
      rawBodyPreview: rawBody.substring(0, 100),
      bodyKeys: Object.keys(req.body || {}),
      headers: {
        signature: req.headers["x-paystack-signature"],
        contentType: req.headers["content-type"]
      }
    });

    // Signature comes from a provider-specific header
    // Paystack uses: x-paystack-signature
    // Flutterwave uses: verif-hash
    // We pick the right one based on provider configuration (later)
    const signature = req.headers["x-paystack-signature"] as string
      || req.headers["verif-hash"] as string
      || "";

    try {
      const result = await this.paymentService.processWebhook({
        rawBody,
        signature,
        context: ctx,
      });

      logger.info("Webhook processed", {
        acknowledged: result.acknowledged,
        reason: result.reason,
      });

      // Always 200 OK on acknowledged webhooks — even ones we ignored.
      // Returning 4xx/5xx would cause Paystack to retry indefinitely.
      return res.status(StatusCodes.OK).json({ status: "acknowledged", reason: result.reason });
    } catch (err: any) {
      // Signature verification failed or internal processing error.
      // Different error types get different status codes:
      if (err.message === "INVALID_WEBHOOK_SIGNATURE") {
        logger.warn("Webhook rejected: invalid signature");
        return res.status(StatusCodes.UNAUTHORIZED).json({ error: "INVALID_SIGNATURE" });
      }

      // Other errors — return 500 so Paystack retries.
      // Idempotency on our side prevents duplicate processing.
      logger.error("Webhook processing failed, returning 500 for retry", {
        error: err.message,
      });
      throw err;
    }
  });
}

export default WebhookController;