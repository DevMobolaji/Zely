import redis from "@/infrastructure/cache/redis.cli";
import { socketRegistry } from "@/infrastructure/websockets/socket.registry";
import {
  UserTransactionModel,
  UserBalanceSummaryModel,
} from "@/kafka/projections/models/projectionModels";
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
  const { sender, receiver, amount, currency, transactionRef, referenceId } =
    payload;
  const occurredAtDate = new Date(occurredAt);

  const notification = new NotificationService();

  /** -------------------------
   * TRANSACTION PROJECTIONS
   * ------------------------- */

  // Debit side: money leaving sender's wallet into the vault
  await UserTransactionModel.updateOne(
    { eventId, userId: sender.userId, walletType: sender.accountType },
    {
      $setOnInsert: {
        userId: sender.userId,
        name: sender.name,
        transactionRef,
        category: "VAULT_TRANSFER",
        direction: "debit",
        amount,
        currency,
        walletType: sender.accountType,
        status: "TRANSACTION_COMPLETED",
        referenceId,
        counterpartyName: receiver.title,
        occurredAt: occurredAtDate,
        counterpartyWalletType: "VAULT",
      },
    },
    { upsert: true, session },
  );

  // Credit side: vault's own ledger row (only if vaults get a visible per-vault history —
  // see the same open question flagged for VAULT_DEPOSIT last message)
  await UserTransactionModel.updateOne(
    { eventId, userId: receiver.userId, walletType: "VAULT" },
    {
      $setOnInsert: {
        userId: receiver.userId,
        name: receiver.title,
        transactionRef,
        category: "VAULT_TRANSFER",
        direction: "credit",
        amount,
        currency,
        walletType: "VAULT",
        status: "TRANSACTION_COMPLETED",
        referenceId,
        counterpartyName: sender.name,
        occurredAt: occurredAtDate,
        counterpartyWalletType: sender.accountType,
      },
    },
    { upsert: true, session },
  );

  /** -------------------------
   * BALANCE SUMMARY — always treated as internal
   * ------------------------- */

  await UserBalanceSummaryModel.updateOne(
    { userId: sender.userId },
    {
      $set: {
        mainBalance: sender.currentBalance,
        vaultBalance: receiver.currentBalance,
      },
    },
    { upsert: true, session },
  );

  /** -------------------------
   * REAL-TIME PUSH
   * ------------------------- */

  socketRegistry.emitToUser(sender.userId, "balance:updated", {
    id: eventId,
    walletType: sender.accountType,
    newBalance: sender.currentBalance,
    direction: "debit",
    amount,
    currency,
    transactionRef,
    occurredAt: occurredAtDate,
  });

  socketRegistry.emitToUser(sender.userId, "balance:updated", {
    id: eventId,
    walletType: "VAULT",
    newBalance: receiver.currentBalance,
    direction: "credit",
    amount,
    currency,
    transactionRef,
    occurredAt: occurredAtDate,
  });

  /** -------------------------
   * NOTIFICATION
   * ------------------------- */

  await notification.createAndEmit({
    userId: sender.userId,
    type: NotificationType.INFO,
    title: "Vault Deposit",
    message: `₦${amount.toLocaleString("en-NG")} moved to ${receiver.title}.`,
    amount,
    currency,
    referenceId: `${transactionRef}:vault`,
  });

  /** -------------------------
   * CACHE INVALIDATION
   * ------------------------- */

  await Promise.all([
    redis.delete(`wallets:${sender.userId}`),
    redis.delete(`balance:summary:${sender.userId}`),
    redis.delete(`transactions:${sender.userId}`),
  ]);

  logger.info("✅ Vault transfer projection complete", { transactionRef });
}
