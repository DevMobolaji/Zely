// const firstTime = await intIdempotency(eventId, null, topic)
// if (firstTime) {
//   logger.info("Duplicate transfer event skipped", { eventId });
//   return;
// }

// if (version !== 1) {
//   throw new PermanentError(`Unsupported event version: ${version}`);
// }

// if (!topic.startsWith("vault.")) {
//   throw new PermanentError(`Unsupported topic: ${topic}`);
// }

import { ClientSession } from "mongoose";
import { logger } from "@/shared/utils/logger";
import {
  UserBalanceSummaryModel,
  UserTransactionModel,
  UserWalletModel,
} from "../kafka/projections/models/projectionModels";
import redis from "@/infrastructure/cache/redis.cli";
import { socketRegistry } from "@/infrastructure/websockets/socket.registry";
import NotificationService from "@/modules/notification/notification.service";
// import notificationService from "@/modules/notifications/notification.service";
import { NotificationType } from "@/modules/notification/notification.model";

const accountFieldMap: Record<string, string> = {
  MAIN_CHECKINGS: "mainBalance",
  SAVINGS: "savingsBalance",
  VAULT: "vaultBalance",
};

const notification = new NotificationService();

export async function handleTransactionCompleted(
  topic: string,
  envelope: any,
  session: ClientSession,
) {
  console.log(envelope);
  const { payload, eventId, occurredAt, action } = envelope.event;

  const {
    transactionRef,
    referenceId,
    sender,
    receiver,
    amount,
    currency,
    transferType,
    fee,
    limit,
  } = payload;

  const occurredAtDate = new Date(occurredAt);

  /** -------------------------
   * TRANSACTION PROJECTIONS
   * ------------------------- */

  await UserTransactionModel.updateOne(
    { eventId, userId: sender.userId, walletType: sender.accountType },
    {
      $setOnInsert: {
        userId: sender.userId,
        name: sender.name,
        transactionRef,
        category: transferType,
        direction: "debit",
        amount,
        currency,
        fee,
        walletType: sender.accountType,
        status: action,
        referenceId,
        counterpartyUserId: receiver.userId,
        counterpartyName: receiver.name,
        occurredAt: occurredAtDate,
        counterpartyWalletType: sender.accountType,
      },
    },
    { upsert: true, session },
  );

  await UserTransactionModel.updateOne(
    { eventId, userId: receiver.userId, walletType: receiver.accountType },
    {
      $setOnInsert: {
        userId: receiver.userId,
        name: receiver.name,
        transactionRef,
        category: transferType,
        direction: "credit",
        amount,
        currency,
        referenceId,
        fee,
        walletType: receiver.accountType,
        status: action,
        counterpartyUserId: sender.userId,
        counterpartyName: sender.name,
        occurredAt: occurredAtDate,
        counterpartyWalletType: sender.accountType,
      },
    },
    { upsert: true, session },
  );

  logger.info("Transaction projection updated");

  /** -------------------------
   * WALLET PROJECTIONS
   * ------------------------- */
  await UserWalletModel.bulkWrite(
    [
      {
        updateOne: {
          filter: { walletId: sender.walletId, walletType: sender.accountType },
          update: {
            $set: {
              walletId: sender.walletId,
              userId: sender.userId,
              walletType: sender.accountType,
              currency,
              balance: sender.currentBalance,
              status: "ACTIVE",
              version: sender.version,
              limit,
            },
          },
          upsert: true,
        },
      },
      {
        updateOne: {
          filter: {
            walletId: receiver.walletId,
            walletType: receiver.accountType,
          },
          update: {
            $set: {
              walletId: receiver.walletId,
              userId: receiver.userId,
              walletType: receiver.accountType,
              currency,
              balance: receiver.currentBalance,
              status: "ACTIVE",
              version: receiver.version,
              limit,
            },
          },
          upsert: true,
        },
      },
    ],
    { session },
  );

  logger.info("Wallet projection updated");

  /** -------------------------
   * BALANCE SUMMARY PROJECTIONS
   * ------------------------- */

  // ------------------- INTERNAL TRANSFER -------------------
  if (sender.userId === receiver.userId) {
    const existing = await UserBalanceSummaryModel.findOne({
      userId: sender.userId,
    }).session(session);

    const main =
      sender.accountType === "MAIN_CHECKINGS"
        ? sender.currentBalance
        : receiver.accountType === "MAIN_CHECKINGS"
          ? receiver.currentBalance
          : (existing?.mainBalance ?? 0);

    const savings =
      sender.accountType === "SAVINGS"
        ? sender.currentBalance
        : receiver.accountType === "SAVINGS"
          ? receiver.currentBalance
          : (existing?.savingsBalance ?? 0);

    const vault =
      sender.accountType === "VAULT"
        ? sender.currentBalance
        : receiver.accountType === "VAULT"
          ? receiver.currentBalance
          : (existing?.vaultBalance ?? 0);

    await UserBalanceSummaryModel.updateOne(
      { userId: sender.userId },
      {
        $set: {
          userId: sender.userId,
          [accountFieldMap[sender.accountType]]: sender.currentBalance,
          [accountFieldMap[receiver.accountType]]: receiver.currentBalance,
          totalBalance: main + savings + vault,
          currency,
        },
      },
      { upsert: true, session },
    );

    logger.info("✅ Internal UserBalanceSummary projection updated");

    socketRegistry.emitToUser(sender.userId, "balance:updated", {
      walletId: sender.walletId,
      walletType: sender.accountType,
      newBalance: sender.currentBalance,
      direction: "debit",
      amount,
      currency,
      transactionRef,
      occurredAt: occurredAtDate,
    });

    socketRegistry.emitToUser(receiver.userId, "balance:updated", {
      id: eventId,
      walletId: receiver.walletId,
      walletType: receiver.accountType,
      newBalance: receiver.currentBalance,
      direction: "credit",
      amount,
      currency,
      transactionRef,
      occurredAt: occurredAtDate,
    });

    await notification.createAndEmit({
      userId: sender.userId,
      type: NotificationType.INFO,
      title: "Internal Transfer",
      message: `You moved ₦${amount.toLocaleString("en-NG")} from ${sender.accountType === "MAIN_CHECKINGS" ? "Main Checking" : "Savings"} to ${receiver.accountType === "SAVINGS" ? "Savings" : "Main Checking"}`,
      amount,
      currency,
      referenceId: `${transactionRef}:internal`,
    });

    logger.info("✅ WebSocket events emitted for internal transfer");
  }

  // ------------------- EXTERNAL TRANSFER -------------------
  else {
    const senderExisting = await UserBalanceSummaryModel.findOne({
      userId: sender.userId,
    }).session(session);

    const senderMain =
      sender.accountType === "MAIN_CHECKINGS"
        ? sender.currentBalance
        : (senderExisting?.mainBalance ?? 0);

    const senderSavings =
      sender.accountType === "SAVINGS"
        ? sender.currentBalance
        : (senderExisting?.savingsBalance ?? 0);

    const senderVault =
      sender.accountType === "VAULT"
        ? sender.currentBalance
        : (senderExisting?.vaultBalance ?? 0);

    await UserBalanceSummaryModel.updateOne(
      { userId: sender.userId },
      {
        $set: {
          [accountFieldMap[sender.accountType]]: sender.currentBalance,
          totalBalance: senderMain + senderSavings + senderVault,
          currency,
        },
        $setOnInsert: {
          userId: sender.userId,
          totalCredit: 0,
        },
        $inc: { totalDebit: amount },
      },
      { upsert: true, session },
    );

    logger.info("✅ Sender UserBalanceSummary projection updated");

    const receiverExisting = await UserBalanceSummaryModel.findOne({
      userId: receiver.userId,
    }).session(session);

    const receiverMain =
      receiver.accountType === "MAIN_CHECKINGS"
        ? receiver.currentBalance
        : (receiverExisting?.mainBalance ?? 0);

    const receiverSavings =
      receiver.accountType === "SAVINGS"
        ? receiver.currentBalance
        : (receiverExisting?.savingsBalance ?? 0);

    const receiverVault =
      receiver.accountType === "VAULT"
        ? receiver.currentBalance
        : (receiverExisting?.vaultBalance ?? 0);

    await UserBalanceSummaryModel.updateOne(
      { userId: receiver.userId },
      {
        $set: {
          [accountFieldMap[receiver.accountType]]: receiver.currentBalance,
          totalBalance: receiverMain + receiverSavings + receiverVault,
          currency,
        },
        $setOnInsert: {
          userId: receiver.userId,
          totalDebit: 0,
        },
        $inc: { totalCredit: amount },
      },
      { upsert: true, session },
    );

    logger.info("✅ Receiver UserBalanceSummary projection updated");

    socketRegistry.emitToUser(sender.userId, "balance:updated", {
      id: eventId,
      walletId: sender.walletId,
      walletType: sender.accountType,
      newBalance: sender.currentBalance,
      direction: "debit",
      amount,
      currency,
      transactionRef,
      occurredAt: occurredAtDate,
    });

    socketRegistry.emitToUser(receiver.userId, "balance:updated", {
      id: eventId,
      walletId: receiver.walletId,
      walletType: receiver.accountType,
      newBalance: receiver.currentBalance,
      direction: "credit",
      amount,
      currency,
      transactionRef,
      occurredAt: occurredAtDate,
    });

    await notification.createAndEmit({
      userId: sender.userId,
      type: NotificationType.DEBIT,
      title: "Payment Sent",
      message: `You sent ₦${amount.toLocaleString("en-NG")} to ${receiver.name}`,
      amount,
      currency,
      referenceId: `${transactionRef}:sender`,
    });

    await notification.createAndEmit({
      userId: receiver.userId,
      type: NotificationType.CREDIT,
      title: "Payment Received",
      message: `You received ₦${amount.toLocaleString("en-NG")} from ${sender.name}`,
      amount,
      currency,
      referenceId: `${transactionRef}:receiver`,
    });

    logger.info("✅ WebSocket events emitted for external transfer");
  }

  // ─── Invalidate all caches for both parties ──────────────────────────
  await Promise.all([
    redis.delete(`wallets:${sender.userId}`),
    redis.delete(`wallets:${receiver.userId}`),
    redis.delete(`balance:summary:${sender.userId}`),
    redis.delete(`balance:summary:${receiver.userId}`),
    redis.delete(`transactions:${sender.userId}`),
    redis.delete(`transactions:${receiver.userId}`),
  ]);

  logger.info("✅ Redis cache invalidated for both parties", {
    senderUserId: sender.userId,
    receiverUserId: receiver.userId,
  });

  logger.info("✅ WebSocket events emitted to both parties");
}
