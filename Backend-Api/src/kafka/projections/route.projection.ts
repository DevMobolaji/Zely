import { processPaymentEvents } from "@/events/payment.events";
import { handleFundingProjection } from "@/kafka/projections/funding.projection";
import { handleVaultTransferCompleted } from "@/kafka/projections/vault.projection";
import { handleTransactionCompleted } from "@/kafka/projections/transfer.projection";
import { RetryEnvelope } from "@/kafka/retry.helpers/retry.envelope";
import { logger } from "@/shared/utils/logger";

export async function routeToProjectionHandler(
  aggregateType: string,
  topic: string,
  envelope: RetryEnvelope,
  session: any,
) {
  switch (aggregateType) {
    case "TRANSFER":
      await handleTransactionCompleted(topic, envelope, session);
      break;

    case "PAYMENT_INITIATION":
    case "PAYMENT_SUCCEEDED":
    case "PAYMENT_DISPUTED":
    case "PAYMENT_FAILED":
      await processPaymentEvents(topic, envelope, session);
      break;

    case "FUNDING":
      await handleFundingProjection(topic, envelope, session);
      break;

    case "VAULT_TRANSFER":
      await handleVaultTransferCompleted(topic, envelope, session);
      break;

    default:
      logger.warn("No projection handler for aggregateType", {
        aggregateType,
        eventType: envelope.event.eventType,
      });
    // Don't throw — unknown events are skipped, not retried
  }
}
