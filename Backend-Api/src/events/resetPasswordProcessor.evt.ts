import emailQueue from "@/infrastructure/queues/email.queue";
import { RetryEnvelope } from "@/kafka/consumer/retry.envelope";
import { PermanentError, TransientError } from "@/kafka/consumer/retry.error";
import { logger } from "@/shared/utils/logger";


export async function resetPasswordProcessor (
  topic: string,
  envelope: RetryEnvelope,
) {
  const { payload, version, eventType } = envelope.event;
  const { code, expiryMinutes, email, name } = payload ?? {};

  try {
    if (version !== 1) {
      throw new PermanentError(`Unsupported event version: ${version}`);
    }

    if (!topic.startsWith("password.")) {
      throw new PermanentError(`Unsupported topic: ${topic}`);
    }

    if (!email) {
      throw new PermanentError(`Missing required field: email`);
    }

    switch (eventType) {

      case "PASSWORD_RESET_REQUESTED": {
        if (!code || !expiryMinutes) {
          throw new PermanentError(
            `Missing OTP payload fields for PASSWORD_RESET_REQUESTED`
          );
        }

        await emailQueue.add("passwordResetRequest", {
          email,
          name,
          otp: code,
          expiryMinutes,
          type: "PASSWORD_RESET_REQUEST",
        });

        logger.info("Password reset code sent", {
          email,
          expiresIn: expiryMinutes,
        });

        break;
      }

      case "PASSWORD_RESET_CODE_VERIFIED": {
        logger.info("Password reset code verified", { email });
        break;
      }

      case "PASSWORD_RESET_SUCCESS": {
        await emailQueue.add("passwordResetSuccess", {
          email,
          name,
          type: "PASSWORD_RESET_SUCCESS",
        });

        logger.info("Password reset successful", { email });
        break;
      }

      default:
        // Unknown event type = contract mismatch → permanent
        throw new PermanentError(`Unhandled eventType: ${eventType}`);
    }

  } catch (err: any) {

    if (err instanceof PermanentError || err instanceof TransientError) {
      throw err;
    }

    throw new TransientError(
      `[v${version}] Password reset processor failed: ${err.message}`
    );
  }
};