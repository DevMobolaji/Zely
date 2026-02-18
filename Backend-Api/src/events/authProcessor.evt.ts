import mongoose from "mongoose";
import User from "@/modules/auth/authmodel";
import { accountStatus } from "@/modules/auth/authinterface";
import { Wallet, WalletStatus, WalletType } from "@/modules/wallet/wallet.model";
import { LedgerAccount, LedgerAccountType } from "@/modules/ledger/ledgerAccount.model";
import { Account, AccountType } from "@/modules/account/account.model";
import { generateAccountNumber } from "@/shared/utils/id.generator";
import { emitOutboxEvent } from "@/infrastructure/helpers/emit.audit.helper";
import { AuditAction, AuditStatus } from "@/modules/audit/audit.interface";
import { logger } from "@/shared/utils/logger";
import { PermanentError, TransientError } from "@/kafka/consumer/retry.error";
import { RetryEnvelope } from "@/kafka/consumer/retry.envelope";
import { OTPConfigs, OTPPurpose } from "@/config/otp.manager";
import OTPManager from "@/config/otp.manager";
import redis from "@/infrastructure/cache/redis.cli";
import emailQueue from "@/infrastructure/queues/email.queue";
import { sendToDLQ } from "@/kafka/producer/sendToDlq";

export async function processAuthEvent(
  topic: string,
  envelope: RetryEnvelope,
  session: mongoose.ClientSession
) {
  const { eventId, payload, version, eventType } = envelope.event;

  if (!version || version !== 1) {
    throw new PermanentError(`Unsupported event version: ${version}`);
  }

  if (!topic.startsWith("auth.")) {
    throw new PermanentError(`Unsupported auth topic: ${topic}`);
  }

  const otpManager = new OTPManager(redis)
  switch (eventType) {
    case "USER_REGISTER_SUCCESS":
      try {
        const { code } = await otpManager.create(
          payload.email,
          OTPPurpose.EMAIL_VERIFICATION,
          OTPConfigs.emailVerification
        );

        await emailQueue.add("sendVerification", {
          email: payload.email,
          name: payload.name,
          otp: code,
          type: "VERIFICATION",
        });

        logger.info(`[v${version}] Verification email sent`);

      } catch (err: any) {
        // Handle transient errors (Redis/Queue connection issues)
        const isConnectionError =
          err.message?.includes('Redis') ||
          err.message?.includes('ECONNREFUSED') ||
          err.message?.includes('Queue') ||
          err.code === 'ECONNREFUSED';

        if (isConnectionError) {
          // Temporary issue → retry
          throw new TransientError(err.message);
        }

        // Handle permanent errors (validation/business logic errors)
        const isPermanentError =
          err.message?.includes('Invalid email') ||
          err.message?.includes('User not found');

        if (isPermanentError) {
          await sendToDLQ(topic, payload, err);
          logger.error("Permanent error sending verification email", { userId: payload.userId, error: err.message });
          return;
        }

        throw new TransientError(err.message);
      }
      break;
    case "USER_VERIFY_EMAIL_SUCCESS":
      try {

        // 1️⃣ Fetch user
        const user = await User.findOne({
          userId: payload.userId,
          accountStatus: accountStatus.EMAIL_VERIFIED,
        }).session(session);

        // if (user?.email === "alan08037896270@gmail.com") {
        //   throw new TransientError("Simulated transient failure");
        // }

        // if (user?.role === "USER") {
        //   throw new PermanentError("Simulated permanent failure");
        // }
        if (user?.accountStatus === accountStatus.ACCOUNT_READY) {
          logger.warn("User already provisioned — skipping");
          return;
        }

        if (!user) {
          throw new PermanentError(`[v${version}] User ${payload.userId} not eligible`);
        }

        // 2️⃣ Transition user → ACCOUNT_PROVISIONING
        const updatedUser = await User.findOneAndUpdate(
          { userId: payload.userId, accountStatus: accountStatus.EMAIL_VERIFIED },
          { $set: { accountStatus: accountStatus.ACCOUNT_PROVISIONING } },
          { session, new: true }
        );
        logger.info(`[v${version}] User state transitioned to ACCOUNT_PROVISIONING`);

        if (!updatedUser) {
          throw new PermanentError(`[v${version}] User state transition conflict`);
        }

        // 3️⃣ Create wallets
        const wallets = await Wallet.insertMany(
          [
            {
              userId: updatedUser._id,
              userPublicId: updatedUser.userId,
              currency: "NGN",
              availableBalance: 0,
              lockedBalance: 0,
              status: WalletStatus.ACTIVE,
              type: WalletType.MAIN_CHECKINGS,
            },
            {
              userId: updatedUser._id,
              userPublicId: updatedUser.userId,
              currency: "NGN",
              availableBalance: 0,
              lockedBalance: 0,
              status: WalletStatus.ACTIVE,
              type: WalletType.SAVINGS,
            },
          ],
          { session }
        );
        logger.info(`[v${version}] User wallets created successfully`);

        const [checkingWalletId, savingsWalletId] = [wallets[0]._id, wallets[1]._id];

        // 4️⃣ Create ledger accounts
        const ledgers = await LedgerAccount.insertMany(
          [
            {
              userId: updatedUser._id,
              userPublicId: updatedUser.userId,
              walletId: checkingWalletId,
              type: LedgerAccountType.MAIN_CHECKINGS,
              currency: "NGN",
            },
            {
              userId: updatedUser._id,
              userPublicId: updatedUser.userId,
              walletId: savingsWalletId,
              type: LedgerAccountType.SAVINGS,
              currency: "NGN",
            },
          ],
          { session }
        );
        logger.info(`[v${version}] User ledger accounts created successfully`);

        // 5️⃣ Generate account numbers
        const genCheckingAccountNumber = generateAccountNumber();
        const genSavingsAccountNumber = generateAccountNumber();

        if (!genCheckingAccountNumber || !genSavingsAccountNumber) {
          throw new PermanentError(`[v${version}] Invalid generated account numbers`);
        }

        // 6️⃣ Create accounts
        await Account.insertMany(
          [
            {
              userId: updatedUser._id,
              userPublicId: updatedUser.userId,
              accountNumber: genCheckingAccountNumber,
              currency: "NGN",
              status: "ACTIVE",
              walletId: checkingWalletId,
              ledgerAccountId: ledgers[0]._id,
              isPublic: true,
              type: AccountType.MAIN_CHECKINGS,
            },
            {
              userId: updatedUser._id,
              userPublicId: updatedUser.userId,
              accountNumber: genSavingsAccountNumber,
              currency: "NGN",
              status: "ACTIVE",
              walletId: savingsWalletId,
              ledgerAccountId: ledgers[1]._id,
              isPublic: false,
              type: AccountType.SAVINGS,
            },
          ],
          { session }
        );
        logger.info(`[v${version}] User accounts created successfully`);

        // 7️⃣ Finalize user
        updatedUser.accountStatus = accountStatus.ACCOUNT_READY;
        await updatedUser.save({ session });

        // 8️⃣ Emit outbox event
        await emitOutboxEvent(
          {
            topic: "user.account.ready",
            eventId,
            eventType: "USER_ACCOUNT_READY",
            action: AuditAction.ACCOUNT_READY,
            status: AuditStatus.SUCCESS,
            payload: { userId: updatedUser.userId, genCheckingAccountNumber, genSavingsAccountNumber },
            aggregateType: "USER",
            aggregateId: updatedUser.userId,
            version,
          },
          { session }
        );

        logger.info(`[v${version}] User provisioning completed successfully`, { accountStatus: updatedUser.accountStatus, genAccountNumber: genCheckingAccountNumber });

        await emailQueue.add('sendWelcomeEmail', {
          email: updatedUser.email,
          name: updatedUser.name,
          type: "WELCOME"
        });

        logger.info(`[v${version}] Welcome email sent`);

      } catch (err: any) {
        if (err instanceof PermanentError) {
          throw err;
        }
        throw new TransientError(`[v${version}] User provisioning failed: ${err.message}`);
      }
      break;
    case "USER_EMAIL_RESEND_SUCCESS":
      try {
        const result = await otpManager.resend(payload.email, OTPPurpose.EMAIL_VERIFICATION, OTPConfigs.emailVerification, 60)

        if (!result.success) {
          logger.info("OTP resend blocked by cooldown", {
            email: payload.email,
            waitSeconds: result.waitSeconds,
          });

          return; // no retry needed
        }

        logger.info("Verification OTP resent", {
          email: payload.email,
        });

      } catch (error) {
        logger.error("Failed to resend verification OTP", {
          topic,
          email: payload.email,
          error: error instanceof Error ? error.message : error,
        });

        throw error; // let retry/DLQ strategy handle it
      }
    default:
      throw new PermanentError(`Unsupported auth event type: ${eventType}`);
  }
}