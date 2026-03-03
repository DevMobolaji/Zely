import mongoose from "mongoose";

import { intIdempotency } from "@/events/idempotency";
import { logger } from "@/shared/utils/logger";
// import { PermanentError } from "@/kafka/consumer/retry.error";
import { UserBalanceSummaryModel, UserTransactionModel, UserWalletModel } from "@/kafka/projections/models/projectionsModels";

export async function handleTransactionCompleted(
  topic: string,
  envelope: any,
) {
  const { payload, eventId, occurredAt } = envelope.event;

  try {

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

    const {
      transactionId,
      sender,
      receiver,
      amount,
      currency,
      action,
      transferType
    } = payload

    const OccurredAt = new Date(occurredAt)

    await UserTransactionModel.updateOne(
      { eventId, userId: sender.UserId, walletType: sender.accountType },
      {
        $setOnInsert: {
          userId: sender.userId,
          name: sender.name,
          eventId: eventId,
          transactionId: transactionId,
          category: transferType,
          direction: "debit",
          amount,
          currency,
          walletType: sender.accountType,
          status: action,
          counterpartyUserId: receiver.userId,
          occurredAt: OccurredAt
        }
      },
      { upsert: true }
    );

    await UserTransactionModel.updateOne(
      { eventId, userId: receiver.userId, walletType: receiver.accountType },
      {
        $setOnInsert: {
          userId: receiver.userId,
          name: receiver.name,
          eventId: eventId,
          transactionId: transactionId,
          category: transferType,
          direction: "credit",
          amount,
          currency,
          walletType: receiver.accountType,
          status: action,
          counterpartyUserId: sender.userId,
          occurredAt: OccurredAt
        }
      },
      { upsert: true }
    );

    logger.info("Transaction projection updated")

    const operations = [
      {
        updateOne: {
          filter: { walletId: sender.walletId, walletType: sender.accountType },
          update: {
            $set: {
              walletId: sender.walletId,
              userId: sender.userId,
              walletType: sender.accountType,
              currency: payload.currency,
              balance: sender.currentBalance,
              status: "active",
            },
          },
          upsert: true,
        },
      },
      {
        updateOne: {
          filter: { walletId: receiver.walletId, walletType: receiver.accountType },
          update: {
            $set: {
              walletId: receiver.walletId,
              userId: receiver.userId,
              walletType: receiver.accountType,
              currency: payload.currency,
              balance: receiver.currentBalance,
              status: "active",
            },
          },
          upsert: true,
        },
      },
    ]

    await UserWalletModel.bulkWrite(operations)
    logger.info("Wallet projection updated")


    // const senderField = accountFieldMap[sender.accountType]
    // const receiverField = accountFieldMap[receiver.accountType]

    const accountFieldMap: Record<string, string> = {
      MAIN_CHECKINGS: 'mainBalance',
      SAVINGS: 'savingsBalance',
      VAULT: 'vaultBalance',
    };

    const existing = await UserBalanceSummaryModel.findOne({ userId: sender.userId });

    const main =
      sender.accountType === 'MAIN_CHECKINGS'
        ? sender.currentBalance
        : receiver.accountType === 'MAIN_CHECKINGS'
          ? receiver.currentBalance
          : existing?.mainBalance ?? 0;

    const savings =
      sender.accountType === 'SAVINGS'
        ? sender.currentBalance
        : receiver.accountType === 'SAVINGS'
          ? receiver.currentBalance
          : existing?.savingsBalance ?? 0;

    const vault =
      sender.accountType === 'VAULT'
        ? sender.currentBalance
        : receiver.accountType === 'VAULT'
          ? receiver.currentBalance
          : existing?.vaultBalance ?? 0;

    const totalBalance = main + savings + vault;

    // ------------------- INTERNAL TRANSFER -------------------
    if (sender.userId === receiver.userId) {
      const updateFields: any = {
        [accountFieldMap[sender.accountType]]: sender.currentBalance,
        [accountFieldMap[receiver.accountType]]: receiver.currentBalance,
        totalBalance: totalBalance,   // ← use computed value
        currency: currency,
      };

      await UserBalanceSummaryModel.updateOne(
        { userId: sender.userId },
        {
          $set: {
            ...updateFields,
            userId: sender.userId,
          }
        },
        { upsert: true }
      ); 
      
      logger.info('✅ Internal UserBalanceSummary projection updated');
    }

    
    // ------------------- EXTERNAL TRANSFER -------------------
    else {

      try {
        const senderExisting = await UserBalanceSummaryModel.findOne({ userId: sender.userId });

        const senderMain =
          sender.accountType === 'MAIN_CHECKINGS'
            ? sender.currentBalance
            : senderExisting?.mainBalance ?? 0;

        const senderSavings =
          sender.accountType === 'SAVINGS'
            ? sender.currentBalance
            : senderExisting?.savingsBalance ?? 0;

        const senderVault =
          sender.accountType === 'VAULT'
            ? sender.currentBalance
            : senderExisting?.vaultBalance ?? 0;

        const senderTotalBalance = senderMain + senderSavings + senderVault;

        // update sender
        await UserBalanceSummaryModel.updateOne(
          { userId: sender.userId },
          {
            $set: {
              [accountFieldMap[sender.accountType]]: sender.currentBalance,
              totalBalance: senderTotalBalance,
              currency,
            },
            $inc: { totalDebit: amount },
            $setOnInsert: {
              userId: sender.userId,
              totalCredit: 0,  // only fields $set and $inc don't already touch
            },
          },
          { upsert: true }
        );

        logger.info('✅ Sender UserBalanceSummary projection updated');

        // update receiver
        const receiverExisting = await UserBalanceSummaryModel.findOne({ userId: receiver.userId });

        const receiverMain =
          receiver.accountType === 'MAIN_CHECKINGS'
            ? receiver.currentBalance
            : receiverExisting?.mainBalance ?? 0;

        const receiverSavings =
          receiver.accountType === 'SAVINGS'
            ? receiver.currentBalance
            : receiverExisting?.savingsBalance ?? 0;

        const receiverVault =
          receiver.accountType === 'VAULT'
            ? receiver.currentBalance
            : receiverExisting?.vaultBalance ?? 0;

        const receiverTotalBalance = receiverMain + receiverSavings + receiverVault;


        await UserBalanceSummaryModel.updateOne(
          { userId: receiver.userId },
          {
            $set: {
              [accountFieldMap[receiver.accountType]]: receiver.currentBalance,
              totalBalance: receiverTotalBalance,
              currency,
            },
            $inc: { totalCredit: amount },
            $setOnInsert: {
              userId: receiver.userId,
              totalDebit: 0,  // only fields $set and $inc don't already touch
            },
          },
          { upsert: true }
        );

        logger.info('✅ Receiver UserBalanceSummary projection updated');

      } catch (err) {
        console.log("This is the err", err)
      }
    }
  } catch (error) {

  }
}