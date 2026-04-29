import { RetryEnvelope } from "@/kafka/retry.helpers/retry.envelope";
import { PermanentError, TransientError } from "@/kafka/retry.helpers/retry.error";
import { logger } from "@/shared/utils/logger";
import mongoose from "mongoose";



export async function kycEvent(topic: string, envelope: RetryEnvelope, session: mongoose.ClientSession) {
  const { payload, version, eventType } = envelope.event;
  const { code, expiryMinutes, email, name } = payload ?? {};

  try {
    if (version !== 1) {
      throw new PermanentError(`Unsupported event version: ${version}`);
    }

    if (!topic.startsWith("kyc.")) {
      throw new PermanentError(`Unsupported topic: ${topic}`);
    }

    // if (email === "alan08037896270@outlook.com") {
    //   throw new TransientError("Simulated transient error")
    // }

    switch (eventType) {
      case "KYC_SUBMITTED":
        logger.info("We recieved your kyc submission and it is pending");
        break;
      case "KYC_APPROVED":
        logger.info("Your kyc submission has been approved and your Tier has increased");
        break;
      case "KYC_REJECTED":
        logger.info("Your kyc submission has been rejected and here is the reason");
        break;

      default:
        // Unknown event type = contract mismatch → permanent
        throw new PermanentError(`Unhandled eventType: ${eventType}`);
    }
  } catch (err: any) {
    if (err instanceof PermanentError || err instanceof TransientError) {
      throw err;
    }

    throw new TransientError(
      `[v${version}] Kyc event failed: ${err.message}`
    );
  }

}