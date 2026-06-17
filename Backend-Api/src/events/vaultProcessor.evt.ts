import { EmailOutboxModel } from "@/kafka/emails/email.Outbox";
import {
  PermanentError,
  TransientError,
} from "@/kafka/retry.helpers/retry.error";
import { logger } from "@/shared/utils/logger";
import User from "@/modules/auth/authmodel";
import mongoose from "mongoose";

export async function processVaultEvents(
  topic: string,
  envelope: any,
  session: mongoose.ClientSession,
) {
  const { payload, version, eventType, eventId } = envelope.event;

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

      case "VAULT_WITHDRAWAL":
        logger.info("vault withdrawal completed");
        break;

      case "VAULT_TRANSFER_COMPLETED":
        logger.info(
          "No email for vault transfer yet — projection handled separately",
        );
        break;

      case "VAULT_CLOSED": {
        const user = await User.findOne({ userId: payload.userId })
          .select("email name")
          .session(session)
          .lean();

        if (!user) break;

        await EmailOutboxModel.create(
          [
            {
              jobName: "vaultClosed",
              jobId: `${payload.vaultId}_VAULT_CLOSED`,
              eventId: eventId,
              aggregateType: "VAULT",
              payload: {
                type: "VAULT_CLOSED",
                email: user.email,
                name: user.name,
                vaultId: payload.vaultId,
                title: payload.title,
                finalBalanceWithdrawn: payload.finalBalanceWithdrawn,
                penaltyApplied: payload.penaltyApplied,
                penaltyAmount: payload.penaltyAmount,
              },
              status: "PENDING",
              attempts: 0,
              envelope,
            },
          ],
          { session },
        );
        break;
      }

      default:
        throw new PermanentError(`Unsupported vault event type: ${eventType}`);
    }
  } catch (err: any) {
    if (err instanceof PermanentError || err instanceof TransientError) {
      throw err;
    }

    throw new TransientError(
      `[v${version}] vault event failed: ${err.message}`,
    );
  }
}
