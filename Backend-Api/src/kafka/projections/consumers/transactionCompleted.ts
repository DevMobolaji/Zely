import mongoose from "mongoose";

import {
  UserWalletModel,
  UserBalanceSummaryModel,
  UserTransactionModel,
  UserProfileModel
} from "../models/projectionsModels"
import { intIdempotency } from "@/events/idempotency";
import { logger } from "@/shared/utils/logger";

export async function handleTransactionCompleted(event: any) {
  const session = await mongoose.startSession()

  console.log(event)

  try {
    session.startTransaction()

    const firstTime = await intIdempotency(event.eventId, session)
    if (firstTime) {
      logger.info("Duplicate transfer event skipped", { eventId: event.eventId });
      return;
    }


    const {
      transactionId,
      sender,
      receiver,
      amountMinor,
      currency,
      category
    } = event.payload

    console.log("This is the event payload", event)

    const occurredAt = new Date(event.occurredAt)

    // await UserTransactionModel.create(
    //   [
    //     {
    //       userId: sender.userId,
    //       transactionId,
    //       eventId: event.eventId,
    //       direction: "debit",
    //       amountMinor,
    //       currency,
    //       walletType: sender.walletType,
    //       category,
    //       status: "completed",
    //       counterpartyUserId: receiver.userId,
    //       occurredAt
    //     }
    //   ],
    //   { session }
    // )


    // await UserTransactionModel.create(
    //   [
    //     {
    //       userId: receiver.userId,
    //       transactionId,
    //       eventId: event.eventId,
    //       direction: "credit",
    //       amountMinor,
    //       currency,
    //       walletType: receiver.walletType,
    //       category,
    //       status: "completed",
    //       counterpartyUserId: sender.userId,
    //       occurredAt
    //     }
    //   ],
    //   { session }
    // )

    // await UserWalletModel.updateOne(
    //   { walletId: sender.walletId },
    //   { $inc: { balanceMinor: -amountMinor } },
    //   { session }
    // )

    // await UserWalletModel.updateOne(
    //   { walletId: receiver.walletId },
    //   { $inc: { balanceMinor: amountMinor } },
    //   { session }
    // )


    const senderField = `balances.${sender.walletType}`
    const receiverField = `balances.${receiver.walletType}`

    // await UserBalanceSummaryModel.updateOne(
    //   { userId: sender.userId },
    //   {
    //     $inc: {
    //       [senderField]: -amountMinor,
    //       totalBalanceMinor: -amountMinor
    //     }
    //   },
    //   { session }
    // )

    // await UserBalanceSummaryModel.updateOne(
    //   { userId: receiver.userId },
    //   {
    //     $inc: {
    //       [receiverField]: amountMinor,
    //       totalBalanceMinor: amountMinor
    //     }
    //   },
    //   { session }
    // )
  } catch (error) {

  } finally {
    session.endSession()
  }
}