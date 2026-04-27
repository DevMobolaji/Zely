import mongoose from "mongoose";
import User from "@/modules/auth/authmodel";
import { accountStatus } from "@/modules/auth/authinterface";
import { Wallet, WalletStatus, WalletType } from "@/modules/wallet/wallet.model";
import { LedgerAccount, LedgerAccountType, LedgerOwnerType } from "@/modules/ledger/ledgerAccount.model";
import { Account, AccountType } from "@/modules/account/account.model";
import { generateAccountNumber } from "@/shared/utils/id.generator";
import { emitOutboxEvent } from "@/infrastructure/helpers/emit.audit.helper";
import { AuditAction, AuditStatus } from "@/modules/audit/audit.interface";
import { logger } from "@/shared/utils/logger";
import { PermanentError, TransientError } from "@/kafka/consumer/helpers/retry.error";
import { RetryEnvelope } from "@/kafka/consumer/helpers/retry.envelope";
import { OTPConfigs, OTPPurpose, OTPManager } from "@/modules/helpers/otp.manager"
import redis from "@/infrastructure/cache/redis.cli";
import emailQueue from "@/infrastructure/queues/email.queue";


import crypto from "crypto";
import { OTPModel } from "@/modules/helpers/otp.model";


export const deriveOutboxEventId = (
  aggregateId: string,
  eventType: string,
  sourceEventId: string
): string => {
  const hash = crypto
    .createHash("sha256")
    .update(`${aggregateId}:${eventType}:${sourceEventId}`)
    .digest("base64url")
    .slice(0, 18);

  return `EVT_${hash}`;
};

export async function processAuthEvent(
  topic: string,
  envelope: RetryEnvelope,
  session: mongoose.ClientSession,
) {
  const { eventId, payload, version, eventType } = envelope.event;

  if (!version || version !== 1) {
    throw new PermanentError(`Unsupported event version: ${version}`);
  }

  if (!topic.startsWith("auth.")) {
    throw new PermanentError(`Unsupported auth topic: ${topic}`);
  }

  switch (eventType) {
    case "USER_REGISTER_SUCCESS": {

      const otpManager = new OTPManager()

      const { code } = await otpManager.create(
        payload.email,
        OTPPurpose.EMAIL_VERIFICATION,
        OTPConfigs.emailVerification,
      );

      console.log('OTP CREATED:', { email: payload.email, codeLength: code.length });

      await emailQueue.add(
        "sendVerification",
        { email: payload.email, name: payload.name, otp: code, type: "VERIFICATION" },
        { attempts: 3, backoff: { type: 'exponential', delay: 2000 } }
      );

      logger.info(`[v${version}] Verification email queued`, { email: payload.email });

      const verifyDoc = await OTPModel.findOne({ identifier: payload.email.toLowerCase().trim() });
      console.log('OTP DOC AFTER CREATE:', verifyDoc ? 'EXISTS' : 'MISSING', {
        email: payload.email,
        codeLength: code.length
      });

      break;
    }

    case "USER_EMAIL_RESEND_SUCCESS": {
      const otpManager = new OTPManager();

      const { code } = await otpManager.create(
        payload.email,
        OTPPurpose.EMAIL_VERIFICATION,
        OTPConfigs.emailVerification,
      );

      await emailQueue.add(
        "sendVerification",
        { email: payload.email, name: payload.name, otp: code, type: "VERIFICATION" },
        { attempts: 3, backoff: { type: 'exponential', delay: 2000 } }
      );

      logger.info(`[v${version}] Verification OTP resent`, { email: payload.email });
      break;
    }
    case "USER_VERIFY_EMAIL_SUCCESS":
      try {

        // 1️⃣ Fetch user
        const user = await User.findOne({
          userId: payload.userId,
          accountStatus: accountStatus.EMAIL_VERIFIED,
        }).session(session);

        // if (user?.email === "alan08037896270@outlook.com") {
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


        // Create ledger accounts
        const ledgers = await LedgerAccount.insertMany(
          [
            {
              ownerId: updatedUser._id,
              ownerType: LedgerOwnerType.USER,
              userPublicId: updatedUser.userId,
              type: LedgerAccountType.MAIN_CHECKINGS,
              currency: "NGN",
            },
            {
              ownerId: updatedUser._id,
              ownerType: LedgerOwnerType.USER,
              userPublicId: updatedUser.userId,
              type: LedgerAccountType.SAVINGS,
              currency: "NGN",
            },
          ],
          { session }
        );
        logger.info(`[v${version}] User ledger accounts created successfully`);


        // Create wallets
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
              ledgerAccountId: ledgers[0]._id,
            },
            {
              userId: updatedUser._id,
              userPublicId: updatedUser.userId,
              currency: "NGN",
              availableBalance: 0,
              lockedBalance: 0,
              status: WalletStatus.ACTIVE,
              type: WalletType.SAVINGS,
              ledgerAccountId: ledgers[1]._id,
            },
          ],
          { session }
        );
        logger.info(`[v${version}] User wallets created successfully`);


        const [checkingWalletId, savingsWalletId] = [wallets[0]._id, wallets[1]._id];

        // Generate account numbers
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
            eventId: deriveOutboxEventId(updatedUser.userId, "USER_ACCOUNT_READY", eventId),
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


        logger.info(`[v${version}] User provisioning completed successfully`);

        return {
          email: updatedUser.email,
          name: updatedUser.name,
        };

      } catch (err: any) {
        if (err instanceof PermanentError || err instanceof TransientError) {
          throw err;
        }
        throw new TransientError(`Provisioning failed: ${err.message}`);
      }
    default:
      throw new PermanentError(`Unsupported auth event type: ${eventType}`);
  }
}