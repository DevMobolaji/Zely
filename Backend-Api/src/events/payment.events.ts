import { RetryEnvelope } from "@/kafka/retry.helpers/retry.envelope";
import {
  PermanentError,
  TransientError,
} from "@/kafka/retry.helpers/retry.error";
import { logger } from "@/shared/utils/logger";
import mongoose from "mongoose";

export async function processPaymentEvents(
  topic: string,
  envelope: RetryEnvelope,
  session: mongoose.ClientSession,
) {
  const { payload, version, eventType } = envelope.event as any;

  try {
    /** -------------------------
     * GUARDS
     * ------------------------- */
    if (version !== 1) {
      throw new PermanentError(`Unsupported event version: ${version}`);
    }

    if (!topic.startsWith("payment.")) {
      throw new PermanentError(`Unsupported topic: ${topic}`);
    }

    switch (eventType) {
      case "PAYMENT_INITIATED":
        logger.info("External payment initiated");
        break;

      case "PAYMENT_SUCCEEDED":
        logger.info("External payment succeeded");
        break;

      case "PAYMENT_FAILED":
        logger.warn("External payment failed");
        break;

      case "PAYMENT_DISPUTED":
        logger.error("External payment disputed — manual resolution required", {
          reference: payload.reference,
          providerReference: payload.providerReference,
          amount: payload.amount,
          reason: payload.reason,
          requiresManualResolution: payload.requiresManualResolution,
        });
        break;

      default:
        throw new PermanentError(`Unhandled eventType: ${eventType}`);
    }
  } catch (err: any) {
    if (err instanceof PermanentError || err instanceof TransientError) {
      throw err;
    }

    throw new TransientError(
      `[v${version}] payment event failed: ${err.message}`,
    );
  }
}
