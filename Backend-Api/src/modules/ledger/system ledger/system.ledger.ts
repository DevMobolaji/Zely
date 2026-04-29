import BadRequestError from "@/shared/errors/badRequest";
import mongoose, { Types } from "mongoose";
import { generateReferenceId, generateTransactionId } from "@/shared/utils/id.generator";
import { emitOutboxEvent } from "@/infrastructure/helpers/emit.audit.helper";
import { AuditAction, AuditStatus } from "@/modules/audit/audit.interface";
import ensureSystemLedger from "./create.system.ledger";
import TransactionBuilder from "../ledger.transaction.builder";
import { lookUpLedgerAccount, resolveAccountByAccountNumber, resolveWallet } from "@/modules/helpers/resolvers";
import { markCompleted, extEnsureIdempotence } from "@/modules/helpers/ext.idempotence";
import { Wallet, WalletType } from "@/modules/wallet/wallet.model";
import { LedgerOwnerType } from "../ledger.account.model";
import { IRequestContext } from "@/config/interfaces/request.interface";


export interface FundUsersRequest {
  users: {
    accountNumber: string;
    amount: number;
    idempotencyKey?: string;
  }[];
}

class SystemLedger {
  async fundSystemLedger(users: FundUsersRequest["users"], context: IRequestContext) {
    const fundedUsers: { accountNumber: string; amount: number; transactionRef: string }[] = [];

    for (const user of users) {
      const session = await mongoose.startSession();
      session.startTransaction();

      try {
        if (!session?.inTransaction()) {
          throw new BadRequestError("Transfers must run inside a DB transaction");
        }

        // --- Idempotency check ---
        if (user.idempotencyKey) {
          const { alreadyCompleted, response } = await extEnsureIdempotence(user.idempotencyKey);

          if (alreadyCompleted) {
            fundedUsers.push(response);
            await session.commitTransaction();
            continue;
          }
        }

        const ensureSystem = await ensureSystemLedger("NGN");

        // --- Resolve user account and wallet ---
        const account = await resolveAccountByAccountNumber(user.accountNumber, "MAIN_CHECKINGS", "NGN", session);

        const wallet = await resolveWallet(account, session);

        // --- Resolve ledger accounts ---
        const { receiverLedgerId, senderLedgerId } = await lookUpLedgerAccount(
          ensureSystem.MAIN_CHECKINGS.ownerId,
          LedgerOwnerType.SYSTEM,
          account.userId,
          LedgerOwnerType.USER,
          "NGN",
          session
        );

        if (!senderLedgerId || !receiverLedgerId) {
          throw new BadRequestError("Ledger resolution failed");
        }

        // --- Generate transaction identifiers ---
        const transactionRef = generateTransactionId();
        const referenceId = generateReferenceId();

        // --- Build transaction ---
        const builder = new TransactionBuilder("INTERNAL_TRANSFER");

        builder.addDebit({
          ledgerAccountId: senderLedgerId._id,
          amount: user.amount,
          currency: "NGN",
          referenceId,
          nature: "DEBIT",
          transactionRef,
          referenceType: "INTERNAL_TRANSFER"
        });

        builder.addCredit({
          ledgerAccountId: receiverLedgerId._id,
          amount: user.amount,
          currency: "NGN",
          referenceId,
          nature: "CREDIT",
          transactionRef,
          referenceType: "INTERNAL_TRANSFER"
        });

        // --- Commit ledger entries ---
        const txn = await builder.commit(session);

        const userBalBefore = await Wallet.findById(wallet._id).session(session);
        const sysBalBefore = await Wallet.findById(ensureSystem.MAIN_CHECKINGS.ownerId).session(session);


        await Wallet.updateOne(
          { userPublicId: 'SYSTEM_USER', type: WalletType.MAIN_CHECKINGS },
          { $inc: { availableBalance: -user.amount } },
          { session }
        );

        await Wallet.updateOne(
          { _id: wallet._id },
          { $inc: { availableBalance: user.amount } },
          { session }
        );

        const UserBalAfter = await Wallet.findById(wallet._id).session(session);
        const sysBalAfter = await Wallet.findById(ensureSystem.MAIN_CHECKINGS.ownerId).session(session);

        // --- Mark idempotency ---
        await markCompleted(
          user.idempotencyKey as string,
          transactionRef,
          { transactionRef: txn.transactionRef },
        );


        await emitOutboxEvent(
          {
            topic: "transaction.events",
            eventId: txn.transactionRef,
            eventType: AuditAction.TRANSACTION_COMPLETED,
            action: AuditAction.TRANSACTION_COMPLETED,
            status: AuditStatus.PENDING,
            payload: {
              sender: {
                walletId: sysBalAfter?.walletId,
                email: "system@zely.app",
                name: "ADMIN_SYSTEM_USER",
                userId: ensureSystem.MAIN_CHECKINGS.userPublicId,
                previousBalance: sysBalBefore?.availableBalance,
                currentBalance: sysBalAfter?.availableBalance,
                accountType: ensureSystem.MAIN_CHECKINGS.type,
                accountNumber: "789098767890"
              },
              receiver: {
                walletId: wallet.walletId,
                email: wallet.userId.email,
                name: wallet.userId.name,
                userId: wallet.userPublicId,
                previousBalance: userBalBefore?.availableBalance,
                currentBalance: UserBalAfter?.availableBalance,
                accountNumber: account.accountNumber,
                accountType: account.type
              },

              amount: user.amount,
              currency: "NGN",
              transactionRef,
              referenceId,
              transferType: "INTERNAL_SYSTEM_TRANSFER"

            },
            aggregateType: "TRANSFER",
            aggregateId: txn.transactionRef,
            version: 1,
            context
          },
          { session }
        );


        await session.commitTransaction();

        fundedUsers.push({
          accountNumber: user.accountNumber,
          amount: user.amount,
          transactionRef: txn.transactionRef as string
        });
      } catch (error: any) {
        await session.abortTransaction();

        console.error(`Failed funding user ${user.accountNumber}:`, error.message);
        throw error;
      } finally {
        await session.endSession();
      }
    }

    return fundedUsers;
  }
}

export default SystemLedger;
