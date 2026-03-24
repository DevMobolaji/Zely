// import mongoose from "mongoose";
// import User from "@/modules/auth/authmodel";
// import { accountStatus } from "@/modules/auth/authinterface";
// import { Wallet, WalletStatus, WalletType } from "@/modules/wallet/wallet.model";
// import { LedgerAccount, LedgerAccountType, LedgerOwnerType } from "@/modules/ledger/ledgerAccount.model";
// import { Account, AccountType } from "@/modules/account/account.model";
// import { generateAccountNumber } from "@/shared/utils/id.generator";
// import { emitOutboxEvent } from "@/infrastructure/helpers/emit.audit.helper";
// import { AuditAction, AuditStatus } from "@/modules/audit/audit.interface";
// import { logger } from "@/shared/utils/logger";
// import { PermanentError, TransientError } from "@/kafka/consumer/helpers/retry.error";
// import { RetryEnvelope } from "@/kafka/consumer/helpers/retry.envelope";
// import { OTPConfigs, OTPPurpose } from "@/config/otp.manager";
// import OTPManager from "@/config/otp.manager";
// import redis from "@/infrastructure/cache/redis.cli";
// import emailQueue from "@/infrastructure/queues/email.queue";
// import { sendToDLQ } from "@/kafka/producer/sendToDlq";

// export async function processAuthEvent(
//   topic: string,
//   envelope: RetryEnvelope,
//   session: mongoose.ClientSession
// ) {
//   const { eventId, payload, version, eventType } = envelope.event;

//   if (!version || version !== 1) {
//     throw new PermanentError(`Unsupported event version: ${version}`);
//   }

//   if (!topic.startsWith("auth.")) {
//     throw new PermanentError(`Unsupported auth topic: ${topic}`);
//   }

//   const otpManager = new OTPManager(redis);

//   switch (eventType) {

//     // =========================
//     // REGISTER → SEND OTP
//     // =========================
//     case "USER_REGISTER_SUCCESS":
//       try {
//         const { code } = await otpManager.create(
//           payload.email,
//           OTPPurpose.EMAIL_VERIFICATION,
//           OTPConfigs.emailVerification
//         );

//         await emailQueue.add("sendVerification", {
//           email: payload.email,
//           name: payload.name,
//           otp: code,
//           type: "VERIFICATION",
//         });

//         logger.info(`[v${version}] Verification email sent`);
//       } catch (err: any) {
//         const isConnectionError =
//           err.message?.includes("Redis") ||
//           err.message?.includes("ECONNREFUSED") ||
//           err.message?.includes("Queue");

//         if (isConnectionError) throw new TransientError(err.message);

//         await sendToDLQ(topic, payload, err);
//         logger.error("Permanent error sending verification email", {
//           userId: payload.userId,
//           error: err.message,
//         });
//       }
//       break;

//     // =========================
//     // VERIFY EMAIL → PROVISION
//     // =========================
//     case "USER_VERIFY_EMAIL_SUCCESS":
//       try {
//         // 1️⃣ Move user → ACCOUNT_PROVISIONING (atomic gate)
//         const updatedUser = await User.findOneAndUpdate(
//           {
//             userId: payload.userId,
//             accountStatus: accountStatus.EMAIL_VERIFIED,
//           },
//           {
//             $set: { accountStatus: accountStatus.ACCOUNT_PROVISIONING },
//           },
//           { session, new: true }
//         );

//         if (!updatedUser) {
//           // Already processed or invalid state
//           logger.warn("User already provisioned or invalid state");
//           return;
//         }

//         logger.info(`[v${version}] User → ACCOUNT_PROVISIONING`);

//         // =========================
//         // 2️⃣ UPSERT LEDGERS
//         // =========================
//         await LedgerAccount.updateOne(
//           {
//             userPublicId: updatedUser.userId,
//             type: LedgerAccountType.MAIN_CHECKINGS,
//           },
//           {
//             $setOnInsert: {
//               ownerId: updatedUser._id,
//               ownerType: LedgerOwnerType.USER,
//               currency: "NGN",
//             },
//           },
//           { upsert: true, session }
//         );

//         await LedgerAccount.updateOne(
//           {
//             userPublicId: updatedUser.userId,
//             type: LedgerAccountType.SAVINGS,
//           },
//           {
//             $setOnInsert: {
//               ownerId: updatedUser._id,
//               ownerType: LedgerOwnerType.USER,
//               currency: "NGN",
//             },
//           },
//           { upsert: true, session }
//         );

//         const ledgers = await LedgerAccount.find({
//           userPublicId: updatedUser.userId,
//         }).session(session);

//         const mainLedger = ledgers.find(l => l.type === LedgerAccountType.MAIN_CHECKINGS)!;
//         const savingsLedger = ledgers.find(l => l.type === LedgerAccountType.SAVINGS)!;

//         // =========================
//         // 3️⃣ UPSERT WALLETS
//         // =========================
//         await Wallet.updateOne(
//           { userId: updatedUser._id, type: WalletType.MAIN_CHECKINGS },
//           {
//             $setOnInsert: {
//               userPublicId: updatedUser.userId,
//               currency: "NGN",
//               availableBalance: 0,
//               lockedBalance: 0,
//               status: WalletStatus.ACTIVE,
//               ledgerAccountId: mainLedger._id,
//             },
//           },
//           { upsert: true, session }
//         );

//         await Wallet.updateOne(
//           { userId: updatedUser._id, type: WalletType.SAVINGS },
//           {
//             $setOnInsert: {
//               userPublicId: updatedUser.userId,
//               currency: "NGN",
//               availableBalance: 0,
//               lockedBalance: 0,
//               status: WalletStatus.ACTIVE,
//               ledgerAccountId: savingsLedger._id,
//             },
//           },
//           { upsert: true, session }
//         );

//         const wallets = await Wallet.find({ userId: updatedUser._id }).session(session);

//         const checkingWallet = wallets.find(w => w.type === WalletType.MAIN_CHECKINGS)!;
//         const savingsWallet = wallets.find(w => w.type === WalletType.SAVINGS)!;

//         // =========================
//         // 4️⃣ UPSERT ACCOUNTS
//         // =========================
//         const checkingAccountNumber = generateAccountNumber();
//         const savingsAccountNumber = generateAccountNumber();

//         await Account.updateOne(
//           { userId: updatedUser._id, type: AccountType.MAIN_CHECKINGS },
//           {
//             $setOnInsert: {
//               userPublicId: updatedUser.userId,
//               accountNumber: checkingAccountNumber,
//               currency: "NGN",
//               status: "ACTIVE",
//               walletId: checkingWallet._id,
//               ledgerAccountId: mainLedger._id,
//               isPublic: true,
//             },
//           },
//           { upsert: true, session }
//         );

//         await Account.updateOne(
//           { userId: updatedUser._id, type: AccountType.SAVINGS },
//           {
//             $setOnInsert: {
//               userPublicId: updatedUser.userId,
//               accountNumber: savingsAccountNumber,
//               currency: "NGN",
//               status: "ACTIVE",
//               walletId: savingsWallet._id,
//               ledgerAccountId: savingsLedger._id,
//               isPublic: false,
//             },
//           },
//           { upsert: true, session }
//         );

//         // =========================
//         // 5️⃣ FINALIZE USER
//         // =========================
//         await User.updateOne(
//           {
//             userId: updatedUser.userId,
//             accountStatus: accountStatus.ACCOUNT_PROVISIONING,
//           },
//           {
//             $set: { accountStatus: accountStatus.ACCOUNT_READY },
//           },
//           { session }
//         );

//         // =========================
//         // 6️⃣ OUTBOX EVENT
//         // =========================
//         await emitOutboxEvent(
//           {
//             topic: "user.account.ready",
//             eventId,
//             eventType: "USER_ACCOUNT_READY",
//             action: AuditAction.ACCOUNT_READY,
//             status: AuditStatus.SUCCESS,
//             payload: { userId: updatedUser.userId },
//             aggregateType: "USER",
//             aggregateId: updatedUser.userId,
//             version,
//           },
//           { session }
//         );

//         logger.info(`[v${version}] Provisioning completed`);

//         return {
//           email: updatedUser.email,
//           name: updatedUser.name,
//         };

//       } catch (err: any) {
//         if (err instanceof PermanentError || err instanceof TransientError) {
//           throw err;
//         }
//         throw new TransientError(`Provisioning failed: ${err.message}`);
//       }

//     // =========================
//     // RESEND OTP
//     // =========================
//     case "USER_EMAIL_RESEND_SUCCESS":
//       try {
//         const result = await otpManager.resend(
//           payload.email,
//           OTPPurpose.EMAIL_VERIFICATION,
//           OTPConfigs.emailVerification,
//           60
//         );

//         if (!result.success) return;

//         logger.info("Verification OTP resent");
//       } catch (err) {
//         throw err;
//       }

//     default:
//       throw new PermanentError(`Unsupported auth event type: ${eventType}`);
//   }
// }




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

        logger.info(`[v${version}] Provisioning completed`);
        // logger.info(`[v${version}] User provisioning completed successfully`, { accountStatus: updatedUser.accountStatus, genAccountNumber: genCheckingAccountNumber });

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