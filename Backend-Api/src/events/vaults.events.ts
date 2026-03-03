import { PermanentError } from "@/kafka/consumer/helpers/retry.error";
import { logger } from "@/shared/utils/logger";
import mongoose from "mongoose";

export async function vaultEvents(
  topic: string,
  envelope: any,
  session: mongoose.ClientSession
) {
  const { payload, version, eventType } = envelope.event;

  try {

    if (version !== 1) {
      throw new PermanentError(`Unsupported event version: ${version}`);
    }

    if (!topic.startsWith("vault.")) {
      throw new PermanentError(`Unsupported topic: ${topic}`);
    }

    switch (eventType) {
      case "VAULT_CREATED":
        logger.info(`Vault created: ${payload.vaultId}`);
        break;
  
      case "VAULT_TRANSFER_COMPLETED":
        logger.info(`Vault transfer completed: ${payload.transactionRef}`);
        break;

      default:
        break;
    }
  } catch (error) {
    
  }
}