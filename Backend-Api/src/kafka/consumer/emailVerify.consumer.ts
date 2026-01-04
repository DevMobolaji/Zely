import mongoose from "mongoose";
import { kafka } from "../config/kafka.config";
import { ensureIdempotent } from "@/events/idempotency";
import User from "@/modules/auth/authmodel"
import { TOPICS } from "../config/topics";
import { accountStatus } from "@/modules/auth/authinterface";
import { logger } from "@/shared/utils/logger";
import { Wallet, WalletStatus } from "@/modules/wallet/wallet.model";
import { LedgerAccount, LedgerAccountType } from "@/modules/ledger/ledgerAccount.model";


const consumer = kafka.consumer({ groupId: "user-email-verified-consumer" });

export async function runEmailVerifiedConsumer() {
  await consumer.connect();
  await consumer.subscribe({ topic: TOPICS.AUTH_USER_VERIFY_SUCCESS, fromBeginning: false });

  await consumer.run({
    eachMessage: async ({ topic, partition, message }: any) => {
      if (!message.value) return;

      const event = JSON.parse(message.value.toString());
      const { eventId, payload } = event;

      const session = await mongoose.startSession();
      session.startTransaction();
      try {
        // 1️⃣ Idempotency check
        const firstTime = await ensureIdempotent(eventId, session, topic);

        if (!firstTime) {
          await session.abortTransaction();
          logger.info("Duplicate email_verified event skipped", { eventId });
          return;
        }
        const user = await User.findOne({
          userId: payload.userId,
          accountStatus: accountStatus.EMAIL_VERIFIED,
        }).session(session);

        logger.info("Recieved Email Verfified", user?.userId);

        if (!user) {
          await session.abortTransaction();
          logger.warn("User not eligible for provisioning", { userId: payload.userId });
          return;
        }
        // 2️⃣ Transition → ACCOUNT_PROVISIONING
        user.accountStatus = accountStatus.ACCOUNT_PROVISIONING
        await user.save({ session });

        logger.info("User Transitioned to ACCOUNT_PROVISIONING", user?.userId);

        const wallet = await Wallet.create(
          [
            {
              userId: user.userId,
              currency: "USD",
              availableBalance: 0,
              lockedBalance: 0,
              status: WalletStatus.ACTIVE,
            },
          ],
          { session }
        );

        const walletId = wallet[0].walletId;
        logger.info("Wallet created", walletId);

        await LedgerAccount.create(
          [
            {
              userId: user.userId,
              walletId,
              type: LedgerAccountType.USER_AVAILABLE,
              currency: "USD",
            },
            {
              userId: user.userId,
              walletId,
              type: LedgerAccountType.USER_LOCKED,
              currency: "USD",
            },
          ],
          { session, ordered: true }
        );

        logger.info("Ledger Account created", walletId);

        // 5️⃣ Transition user to ACCOUNT_READY
        await User.updateOne(
          { userId: user.userId },
          { accountStatus: accountStatus.ACCOUNT_READY }
        ).session(session);

        await session.commitTransaction();

        logger.info("User provisioning completed", { userId: payload.userId });
      } catch (error: any) {
        await session.abortTransaction();

        logger.error("User provisioning failed", {
          eventId,
          error: error.message,
        });
        return
        // await sendToDLQ({
        //   topic,
        //   partition,
        //   offset: message.offset,
        //   value: message.value,
        // });
      } finally {
        await session.endSession();
      }
    },
  });
}
