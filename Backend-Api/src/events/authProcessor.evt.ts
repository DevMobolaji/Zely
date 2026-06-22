import { emitOutboxEvent } from "@/infrastructure/helpers/emit.audit.helper";
import emailQueue from "@/infrastructure/queues/email.queue";
import { RetryEnvelope } from "@/kafka/retry.helpers/retry.envelope";
import {
  PermanentError,
  TransientError,
} from "@/kafka/retry.helpers/retry.error";
import { Account, AccountType } from "@/modules/account/account.model";
import { AuditAction, AuditStatus } from "@/modules/audit/audit.interface";
import { accountStatus } from "@/modules/auth/authinterface";
import User from "@/modules/auth/authmodel";
import {
  OTPConfigs,
  OTPManager,
  OTPPurpose,
} from "@/modules/helpers/otp.manager";
import {
  LedgerAccount,
  LedgerAccountType,
  LedgerOwnerType,
} from "@/modules/ledger/ledger.account.model";
import {
  Wallet,
  WalletStatus,
  WalletType,
} from "@/modules/wallet/wallet.model";
import { generateAccountNumber } from "@/shared/utils/id.generator";
import { logger } from "@/shared/utils/logger";
import mongoose from "mongoose";

import crypto from "crypto";
import {
  UserBalanceSummaryModel,
  UserWalletModel,
} from "@/kafka/projections/models/projectionModels";
import { EmailOutboxModel } from "@/kafka/emails/email.Outbox";
import { writeToEmailOutbox } from "@/kafka/emails/write.email";

export const deriveOutboxEventId = (
  aggregateId: string,
  eventType: string,
  sourceEventId: string,
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

  try {
    if (!version || version !== 1) {
      throw new PermanentError(`Unsupported event version: ${version}`);
    }

    if (!topic.startsWith("auth.")) {
      throw new PermanentError(`Unsupported auth topic: ${topic}`);
    }

    switch (eventType) {
      // USER_REGISTER_SUCCESS consumer — before emailQueue.add()

      case "USER_REGISTER_SUCCESS": {
        const otpManager = new OTPManager();

        const { code, expiresAt } = await otpManager.create(
          payload.email,
          OTPPurpose.EMAIL_VERIFICATION,
          OTPConfigs.emailVerification,
          { bypassThrottle: true },
        );

        const jobId = deriveOutboxEventId(
          payload.email,
          "VERIFICATION_EMAIL",
          eventId,
        );

        await writeToEmailOutbox(
          {
            jobName: "sendVerification",
            jobId,
            eventId,
            aggregateType: "AUTH",
            envelope,
            payload: {
              email: payload.email,
              name: payload.name,
              otp: code,
              expiresAt,
              type: "VERIFICATION",
            },
          },
          session,
        );
        // ↑ OTP hash stored in DB — plaintext discarded intentionally
        // Worker will call otpManager.create() again with bypassThrottle
        // which invalidates this one and issues a fresh code at send time

        // await EmailOutboxModel.create({
        //   jobName: "sendVerification",
        //   jobId: generateEventId(),
        //   eventId,
        //   payload: {
        //     email: payload.email,
        //     name: payload.name,
        //     type: "VERIFICATION",
        //   },
        //   status: "PENDING",
        //   attempts: 0,
        // });

        // logger.info(`[v${version}] Verification email intent stored`, {
        //   email: payload.email,
        // });
        // break;

       await emailQueue.add(
  "sendVerification",
  {
    email: payload.email,
    name: payload.name,
    otpRef: userId,          // ← reference, not the OTP itself
    type: "VERIFICATION",
  },
  {
    jobId: `VERIFY_${userId}_${Math.floor(Date.now() / 60000)}`, // ← 1-min bucket
    attempts: 2,             // only retry once — OTP is time-sensitive
    backoff: { type: "fixed", delay: 3000 },
  }
);

        logger.info(`[v${version}] Verification email queued`);

        break;
      }

      case "USER_EMAIL_RESEND_SUCCESS": {
        const otpManager = new OTPManager();

        const { code, expiresAt } = await otpManager.create(
          payload.email,
          OTPPurpose.EMAIL_VERIFICATION,
          OTPConfigs.emailVerification,
        );

        const jobId = deriveOutboxEventId(
          payload.email,
          "VERIFICATION_EMAIL_RESEND",
          eventId,
        );

        await writeToEmailOutbox(
          {
            jobName: "sendVerification",
            jobId,
            eventId,
            aggregateType: "AUTH",
            envelope,
            payload: {
              email: payload.email,
              name: payload.name,
              otp: code,
              expiresAt,
              type: "VERIFICATION",
            },
          },
          session,
        );

        logger.info(`[v${version}] Verification OTP resent`, {
          email: payload.email,
        });

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

          if (user?.accountStatus === accountStatus.ACCOUNT_READY) {
            logger.warn("User already provisioned — skipping");
            return;
          }

          if (!user) {
            throw new PermanentError(
              `[v${version}] User ${payload.userId} not eligible`,
            );
          }

          // 2️⃣ Transition user → ACCOUNT_PROVISIONING
          const updatedUser = await User.findOneAndUpdate(
            {
              userId: payload.userId,
              accountStatus: accountStatus.EMAIL_VERIFIED,
            },
            { $set: { accountStatus: accountStatus.ACCOUNT_PROVISIONING } },
            { session, new: true },
          );

          logger.info(
            `[v${version}] User state transitioned to ACCOUNT_PROVISIONING`,
          );

          if (!updatedUser) {
            throw new PermanentError(
              `[v${version}] User state transition conflict`,
            );
          }

          // Create ledger accounts
          const [checkingLedger, savingsLedger] = await Promise.all([
            LedgerAccount.findOneAndUpdate(
              {
                ownerId: updatedUser._id,
                type: LedgerAccountType.MAIN_CHECKINGS,
              },
              {
                $setOnInsert: {
                  ownerId: updatedUser._id,
                  ownerType: LedgerOwnerType.USER,
                  userPublicId: updatedUser.userId,
                  type: LedgerAccountType.MAIN_CHECKINGS,
                  currency: "NGN",
                },
              },
              { upsert: true, new: true, session },
            ),
            LedgerAccount.findOneAndUpdate(
              {
                ownerId: updatedUser._id,
                type: LedgerAccountType.SAVINGS,
              },
              {
                $setOnInsert: {
                  ownerId: updatedUser._id,
                  ownerType: LedgerOwnerType.USER,
                  userPublicId: updatedUser.userId,
                  type: LedgerAccountType.SAVINGS,
                  currency: "NGN",
                },
              },
              { upsert: true, new: true, session },
            ),
          ]);

          logger.info(
            `[v${version}] User ledger accounts created successfully`,
          );

          // Create wallets
          const [checkingWallet, savingsWallet] = await Promise.all([
            Wallet.findOneAndUpdate(
              {
                userId: updatedUser._id,
                type: WalletType.MAIN_CHECKINGS,
              },
              {
                $setOnInsert: {
                  userId: updatedUser._id,
                  userPublicId: updatedUser.userId,
                  currency: "NGN",
                  availableBalance: 0,
                  lockedBalance: 0,
                  status: WalletStatus.ACTIVE,
                  type: WalletType.MAIN_CHECKINGS,
                  ledgerAccountId: checkingLedger._id,
                },
              },
              { upsert: true, new: true, session },
            ),
            Wallet.findOneAndUpdate(
              {
                userId: updatedUser._id,
                type: WalletType.SAVINGS,
              },
              {
                $setOnInsert: {
                  userId: updatedUser._id,
                  userPublicId: updatedUser.userId,
                  currency: "NGN",
                  availableBalance: 0,
                  lockedBalance: 0,
                  status: WalletStatus.ACTIVE,
                  type: WalletType.SAVINGS,
                  ledgerAccountId: savingsLedger._id,
                },
              },
              { upsert: true, new: true, session },
            ),
          ]);

          logger.info(`[v${version}] User wallets created successfully`);

          // Seed wallet projections — ensure read model is complete from day one
          await UserWalletModel.bulkWrite(
            [
              {
                updateOne: {
                  filter: { walletId: checkingWallet.walletId },
                  update: {
                    $setOnInsert: {
                      walletId: checkingWallet.walletId,
                      userId: updatedUser.userId,
                      walletType: checkingWallet.type,
                      currency: checkingWallet.currency,
                      balance: 0,
                      status: WalletStatus.ACTIVE,
                    },
                  },
                  upsert: true,
                },
              },
              {
                updateOne: {
                  filter: { walletId: savingsWallet.walletId },
                  update: {
                    $setOnInsert: {
                      walletId: savingsWallet.walletId,
                      userId: updatedUser.userId,
                      walletType: savingsWallet.type,
                      currency: savingsWallet.currency,
                      balance: 0,
                      status: WalletStatus.ACTIVE,
                    },
                  },
                  upsert: true,
                },
              },
            ],
            { session },
          );

          logger.info(`[v${version}] Wallet and balance projections seeded`);

          // Generate account numbers only if accounts don't exist yet
          const existingAccounts = await Account.find({
            userId: updatedUser._id,
          })
            .session(session)
            .lean();

          const existingChecking = existingAccounts.find(
            (a) => a.type === AccountType.MAIN_CHECKINGS,
          );
          const existingSavings = existingAccounts.find(
            (a) => a.type === AccountType.SAVINGS,
          );

          const genCheckingAccountNumber =
            existingChecking?.accountNumber ?? generateAccountNumber();
          const genSavingsAccountNumber =
            existingSavings?.accountNumber ?? generateAccountNumber();

          if (!genCheckingAccountNumber || !genSavingsAccountNumber) {
            throw new PermanentError(
              `[v${version}] Invalid generated account numbers`,
            );
          }

          await Promise.all([
            Account.findOneAndUpdate(
              {
                userId: updatedUser._id,
                type: AccountType.MAIN_CHECKINGS,
              },
              {
                $setOnInsert: {
                  userId: updatedUser._id,
                  userPublicId: updatedUser.userId,
                  accountNumber: genCheckingAccountNumber,
                  currency: "NGN",
                  status: "ACTIVE",
                  walletId: checkingWallet,
                  ledgerAccountId: checkingLedger._id,
                  isPublic: true,
                  type: AccountType.MAIN_CHECKINGS,
                },
              },
              { upsert: true, new: true, session },
            ),
            Account.findOneAndUpdate(
              {
                userId: updatedUser._id,
                type: AccountType.SAVINGS,
              },
              {
                $setOnInsert: {
                  userId: updatedUser._id,
                  userPublicId: updatedUser.userId,
                  accountNumber: genSavingsAccountNumber,
                  currency: "NGN",
                  status: "ACTIVE",
                  walletId: savingsWallet,
                  ledgerAccountId: savingsLedger._id,
                  isPublic: false,
                  type: AccountType.SAVINGS,
                },
              },
              { upsert: true, new: true, session },
            ),
          ]);

          logger.info(`[v${version}] User accounts created successfully`);

          // 7️⃣ Finalize user
          updatedUser.accountStatus = accountStatus.ACCOUNT_READY;
          await updatedUser.save({ session });

          // 8️⃣ Emit outbox event
          await emitOutboxEvent(
            {
              topic: "user.account.ready",
              eventId: deriveOutboxEventId(
                updatedUser.userId,
                "USER_ACCOUNT_READY",
                eventId,
              ),
              eventType: "USER_ACCOUNT_READY",
              action: AuditAction.ACCOUNT_READY,
              status: AuditStatus.SUCCESS,
              payload: {
                userId: updatedUser.userId,
                genCheckingAccountNumber,
                genSavingsAccountNumber,
              },
              aggregateType: "USER",
              aggregateId: updatedUser.userId,
              version,
            },
            { session },
          );

          logger.info(`[v${version}] User provisioning completed successfully`);

          return {
            email: updatedUser.email,
            name: updatedUser.name,
          };
        } catch (err: any) {
          if (err instanceof PermanentError) {
            // Mark user as failed so frontend can surface actionable error
            await User.updateOne(
              { userId: payload.userId },
              { $set: { accountStatus: accountStatus.PROVISIONING_FAILED } },
            ).catch((updateErr) => {
              logger.error("Failed to mark user as PROVISIONING_FAILED", {
                userId: payload.userId,
                error: updateErr.message,
              });
            });
            throw err;
          }
          if (err instanceof TransientError) {
            throw err;
          }
          throw new TransientError(`Provisioning failed: ${err.message}`);
        }
      default:
        throw new PermanentError(`Unsupported auth event type: ${eventType}`);
    }
  } catch (err: any) {
    if (err instanceof PermanentError || err instanceof TransientError) {
      throw err;
    }

    throw new TransientError(`[v${version}] Auth event failed: ${err.message}`);
  }
}
