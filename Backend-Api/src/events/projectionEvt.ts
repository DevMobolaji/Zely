

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

const accountFieldMap: Record<string, string> = {
  MAIN_CHECKINGS: "mainBalance",
  SAVINGS: "savingsBalance",
  VAULT: "vaultBalance",
};

export async function handleTransactionCompleted(
  topic: string,
  envelope: any,
  session: ClientSession
) {
  const { payload, eventId, occurredAt } = envelope.event;

  const {
    transactionId,
    sender,
    receiver,
    amount,
    currency,
    action,
    transferType,
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
        eventId,
        transactionId,
        category: transferType,
        direction: "debit",
        amount,
        currency,
        walletType: sender.accountType,
        status: action,
        counterpartyUserId: receiver.userId,
        occurredAt: occurredAtDate,
      },
    },
    { upsert: true, session }
  );

  await UserTransactionModel.updateOne(
    { eventId, userId: receiver.userId, walletType: receiver.accountType },
    {
      $setOnInsert: {
        userId: receiver.userId,
        name: receiver.name,
        eventId,
        transactionId,
        category: transferType,
        direction: "credit",
        amount,
        currency,
        walletType: receiver.accountType,
        status: action,
        counterpartyUserId: sender.userId,
        occurredAt: occurredAtDate,
      },
    },
    { upsert: true, session }
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
              status: "active",
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
              status: "active",
            },
          },
          upsert: true,
        },
      },
    ],
    { session }
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
          : existing?.mainBalance ?? 0;

    const savings =
      sender.accountType === "SAVINGS"
        ? sender.currentBalance
        : receiver.accountType === "SAVINGS"
          ? receiver.currentBalance
          : existing?.savingsBalance ?? 0;

    const vault =
      sender.accountType === "VAULT"
        ? sender.currentBalance
        : receiver.accountType === "VAULT"
          ? receiver.currentBalance
          : existing?.vaultBalance ?? 0;

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
      { upsert: true, session }
    );

    logger.info("✅ Internal UserBalanceSummary projection updated");
  }

  // ------------------- EXTERNAL TRANSFER -------------------
  else {
    // Sender
    const senderExisting = await UserBalanceSummaryModel.findOne({
      userId: sender.userId,
    }).session(session);

    const senderMain =
      sender.accountType === "MAIN_CHECKINGS"
        ? sender.currentBalance
        : senderExisting?.mainBalance ?? 0;

    const senderSavings =
      sender.accountType === "SAVINGS"
        ? sender.currentBalance
        : senderExisting?.savingsBalance ?? 0;

    const senderVault =
      sender.accountType === "VAULT"
        ? sender.currentBalance
        : senderExisting?.vaultBalance ?? 0;

    await UserBalanceSummaryModel.updateOne(
      { userId: sender.userId },
      {
        $set: {
          [accountFieldMap[sender.accountType]]: sender.currentBalance,
          totalBalance: senderMain + senderSavings + senderVault,
          currency,
        },
        $inc: { totalDebit: amount },
        $setOnInsert: {
          userId: sender.userId,
          totalCredit: 0,
        },
      },
      { upsert: true, session }
    );

    logger.info("✅ Sender UserBalanceSummary projection updated");

    // Receiver
    const receiverExisting = await UserBalanceSummaryModel.findOne({
      userId: receiver.userId,
    }).session(session);

    const receiverMain =
      receiver.accountType === "MAIN_CHECKINGS"
        ? receiver.currentBalance
        : receiverExisting?.mainBalance ?? 0;

    const receiverSavings =
      receiver.accountType === "SAVINGS"
        ? receiver.currentBalance
        : receiverExisting?.savingsBalance ?? 0;

    const receiverVault =
      receiver.accountType === "VAULT"
        ? receiver.currentBalance
        : receiverExisting?.vaultBalance ?? 0;

    await UserBalanceSummaryModel.updateOne(
      { userId: receiver.userId },
      {
        $set: {
          [accountFieldMap[receiver.accountType]]: receiver.currentBalance,
          totalBalance: receiverMain + receiverSavings + receiverVault,
          currency,
        },
        $inc: { totalCredit: amount },
        $setOnInsert: {
          userId: receiver.userId,
          totalDebit: 0,
        },
      },
      { upsert: true, session }
    );

    logger.info("✅ Receiver UserBalanceSummary projection updated");
  }
}