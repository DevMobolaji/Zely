import redis from "@/infrastructure/cache/redis.cli";
import { UserTransactionModel } from "@/kafka/projections/models/projectionModels";
import { NotificationType } from "@/modules/notification/notification.model";
import NotificationService from "@/modules/notification/notification.service";
import { logger } from "@/shared/utils/logger";
import { ClientSession } from "mongoose";

export async function handleVaultTransferCompleted(
  topic: string,
  envelope: any,
  session: ClientSession,
) {
  const { payload, eventId, occurredAt, action } = envelope.event;
  const {
    userId,
    amount,
    userReceives,
    penaltyAmount,
    penaltyApplied,
    penaltyReason,
    previousBalance,
    newBalance,
    currency,
    transactionRef,
    type, // vault type, e.g. "TARGET"
  } = payload;
  const occurredAtDate = new Date(occurredAt);

  const direction = action === "VAULT_WITHDRAWAL" ? "credit" : "debit";
  // withdrawal = money leaving vault, landing back in main wallet → credit to user's main wallet view
  // deposit = money leaving main wallet, entering vault → debit from main wallet view
  // (confirm this matches your existing direction convention elsewhere)

  try {
    await UserTransactionModel.updateOne(
      { eventId, userId, walletType: "VAULT" },
      {
        $setOnInsert: {
          userId,
          transactionRef,
          category:
            action === "VAULT_WITHDRAWAL"
              ? "VAULT_WITHDRAWAL"
              : "VAULT_DEPOSIT",
          direction,
          amount: action === "VAULT_WITHDRAWAL" ? userReceives : amount,
          currency,
          walletType: "VAULT",
          status: "TRANSACTION_COMPLETED",
          occurredAt: occurredAtDate,
          ...(penaltyApplied && { penaltyAmount, penaltyReason }),
        },
      },
      { upsert: true, session },
    );

    const notification = new NotificationService();
    await notification.createAndEmit({
      userId,
      type: NotificationType.INFO,
      title:
        action === "VAULT_WITHDRAWAL" ? "Vault withdrawal" : "Vault deposit",
      message:
        action === "VAULT_WITHDRAWAL"
          ? `₦${userReceives.toLocaleString("en-NG")} withdrawn from your vault${penaltyApplied ? ` (₦${penaltyAmount} early-withdrawal penalty applied)` : ""}.`
          : `₦${amount.toLocaleString("en-NG")} added to your vault.`,
      amount: action === "VAULT_WITHDRAWAL" ? userReceives : amount,
      currency,
      referenceId: transactionRef,
    });

    await Promise.all([
      redis.delete(`wallets:${userId}`),
      redis.delete(`balance:summary:${userId}`),
      redis.delete(`transactions:${userId}`),
    ]);

    logger.info("✅ Vault withdrawal/deposit projection complete", {
      transactionRef,
      newBalance,
    });
  } catch (error: any) {
    logger.error("vault Projection event processing failed", {
      error: error?.message,
      stack: error?.stack,
    });
    throw error;
  }
}
