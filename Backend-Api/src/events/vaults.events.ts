import { PermanentError, TransientError } from "@/kafka/retry.helpers/retry.error";
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
  } catch (err: any) {
    if (err instanceof PermanentError || err instanceof TransientError) {
      throw err;
    }

    throw new TransientError(
      `[v${version}] vault event failed: ${err.message}`
    );
  }
}