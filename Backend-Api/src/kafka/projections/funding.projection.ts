// src/events/projections/funding.projection.ts
import { ClientSession } from "mongoose";
import { RetryEnvelope } from "@/kafka/retry.helpers/retry.envelope";
import {
  UserBalanceSummaryModel,
  UserTransactionModel,
  UserWalletModel,
} from "@/kafka/projections/models/projectionModels";
import { socketRegistry } from "@/infrastructure/websockets/socket.registry";
import NotificationService from "@/modules/notification/notification.service";
import { NotificationType } from "@/modules/notification/notification.model";
import redis from "@/infrastructure/cache/redis.cli";
import { logger } from "@/shared/utils/logger";

const notification = new NotificationService();

export async function handleFundingProjection(
  topic: string,
  envelope: RetryEnvelope,
  session: ClientSession,
) {
  const { payload, eventId, occurredAt } = envelope.event as any;

  function formatSource(source: string): string {
    switch (source) {
      case "PAYSTACK_WEBHOOK":
        return "Paystack";
      case "FLUTTERWAVE_WEBHOOK":
        return "Flutterwave";
      case "ADMIN_TOPUP":
        return "Admin Top-up";
      default:
        return source;
    }
  }

  if (envelope.event.eventType !== "FUNDING_CREDITED") {
    logger.warn("handleFundingProjection received unexpected eventType", {
      eventType: envelope.event.eventType,
    });
    return;
  }

  const userPublicId = payload.targetUserPublicId ?? payload.userPublicId;

  const {
    transactionRef,
    amount,
    currency,
    targetWalletId,
    targetWalletType,
    currentBalance,
    previousBalance,
    source,
  } = payload;

  const occurredAtDate = new Date(occurredAt);

  // ─── 1. Update wallet projection ─────────────────────────────────────
  await UserWalletModel.updateOne(
    { walletId: targetWalletId },
    {
      $set: {
        balance: currentBalance,
        userId: userPublicId,
        walletType: targetWalletType,
        currency,
        status: "ACTIVE",
      },
    },
    { upsert: true, session },
  );

  logger.info("Funding wallet projection updated", {
    walletId: targetWalletId,
    newBalance: currentBalance,
  });

  // ─── 1b. Update transaction projection ───────────────────────────────────
  await UserTransactionModel.updateOne(
    { eventId, userId: userPublicId },
    {
      $setOnInsert: {
        eventId, // ← for the filter + transactionId fallback
        userId: userPublicId,
        name: "Wallet Funding",
        transactionRef, // ← primary transactionId source
        category: "EXTERNAL_FUNDING",
        direction: "credit",
        amount,
        currency,
        fee: 0,
        walletType: targetWalletType,
        status: "TRANSACTION_COMPLETED",
        referenceId: transactionRef,
        counterpartyUserId: source,
        counterpartyName: formatSource(source),
        counterpartyWalletType: null,
        occurredAt: occurredAtDate,
      },
    },
    { upsert: true, session },
  );

  logger.info("Funding transaction projection updated", {
    userPublicId,
    transactionRef,
  });

  // ─── 2. Update balance summary projection ─────────────────────────────
  const existing = await UserBalanceSummaryModel.findOne({
    userId: userPublicId,
  }).session(session);

  const mainBalance =
    targetWalletType === "MAIN_CHECKINGS"
      ? currentBalance
      : (existing?.mainBalance ?? 0);

  const savingsBalance = existing?.savingsBalance ?? 0;
  const vaultBalance = existing?.vaultBalance ?? 0;
  const totalBalance = mainBalance + savingsBalance + vaultBalance;

  await UserBalanceSummaryModel.updateOne(
    { userId: userPublicId },
    {
      $set: {
        userId: userPublicId,
        mainBalance,
        totalBalance,
        currency,
      },
      $inc: { totalCredit: amount },
    },
    { upsert: true, session },
  );

  logger.info("Funding balance summary updated", {
    userPublicId,
    newMainBalance: mainBalance,
    totalBalance,
  });

  // ─── 3. WebSocket — real-time balance update ──────────────────────────
  socketRegistry.emitToUser(userPublicId, "balance:updated", {
    id: eventId,
    walletId: targetWalletId,
    walletType: targetWalletType,
    newBalance: currentBalance,
    previousBalance,
    direction: "credit",
    amount,
    currency,
    transactionRef,
    source,
    occurredAt: occurredAtDate,
  });

  // ─── 4. Notification ──────────────────────────────────────────────────
  await notification.createAndEmit({
    userId: userPublicId,
    type: NotificationType.CREDIT,
    title: "Wallet Funded",
    message: `₦${amount.toLocaleString("en-NG")} has been added to your wallet`,
    amount,
    currency,
    referenceId: `${transactionRef}:funding`,
  });

  // ─── 5. Invalidate Redis cache ────────────────────────────────────────
  await Promise.all([
    redis.delete(`wallets:${userPublicId}`),
    redis.delete(`balance:summary:${userPublicId}`),
    redis.delete(`transactions:${userPublicId}`),
  ]);

  logger.info("✅ Funding projection complete", {
    userPublicId,
    amount,
    transactionRef,
  });
}
