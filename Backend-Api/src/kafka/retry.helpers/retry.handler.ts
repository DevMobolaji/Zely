// retry.handler.ts
import { PermanentError, TransientError } from "./retry.error";
import { sendToRetry } from "../producer/retry.producer";
import { sendToDLQ } from "../producer/sendToDlq";
import { logger } from "@/shared/utils/logger";
import { RetryEnvelope } from "./retry.envelope";

interface RetryOrDLQParams {
  topic: string;
  message: RetryEnvelope;
  error: Error;
}

export async function retryOrDLQ({ topic, message, error }: RetryOrDLQParams) {

  const isTransient = (error as any).isTransient === true;
  const isPermanent = (error as any).isPermanent === true;


  try {
    if (isPermanent || error.name === "PermanentError") {
      await sendToDLQ(topic, message, error);
      logger.error("Permanent error, sent to DLQ",);
      return;
    }

    if (isTransient || error.name === "TransientError") {

      try {
        await sendToRetry(topic, {
          ...message,
          meta: {
            ...message.meta,
            lastError: error.message,
          },
        });
        logger.error("Transient error, sent to retry", {
          topic
        });
        return;
      } catch (retryError: any) {
        await sendToDLQ(topic, message, retryError);
        return;
      }
    }

    await sendToDLQ(topic, message, error);
    logger.error("Unknown error type, sent to DLQ");
  } catch (fatalError: any) {
    logger.error(
      "Fatal error in retryOrDLQ",
      {
        eventId: message.event.eventId,
        topic,
        error: fatalError.message,
      });
  }

  // logger.error("Unknown error type, treating as transient", { error: error.message });
  // await sendToRetry(topic, {
  //   ...message,
  //   meta: {
  //     ...message.meta,
  //     lastError: error.message,
  //   },
  // });
}
