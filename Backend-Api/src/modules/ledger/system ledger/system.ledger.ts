import BadRequestError from "@/shared/errors/badRequest";
import mongoose, { Types } from "mongoose";
import { generateReferenceId, generateTransactionId } from "@/shared/utils/id.generator";
import { emitOutboxEvent } from "@/infrastructure/helpers/emit.audit.helper";
import { AuditAction, AuditStatus } from "@/modules/audit/audit.interface";
import ensureSystemLedger from "./create.system.ledger";
import TransactionBuilder from "../ledger.transaction.builder";
import { lookUpLedgerAccount, resolveAccountByAccountNumber, resolveWallet } from "@/modules/helpers/resolvers";
import { completedIdempotence, extEnsureIdempotence } from "@/modules/helpers/ext.idempotence";
import { Wallet } from "@/modules/wallet/wallet.model";


export interface FundUsersRequest {
  users: {
    accountNumber: string;
    amount: number;
    idempotencyKey?: string;
  }[];
}

class SystemLedger {
  async fundSystemLedger(users: FundUsersRequest["users"]) {
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
          const { alreadyCompleted, response } = await extEnsureIdempotence(user.idempotencyKey, session);
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
          ensureSystem.MAIN_CHECKINGS.walletId, // System ledger
          wallet._id,
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
          ledgerAccountId: senderLedgerId,
          amount: user.amount,
          currency: "NGN",
          referenceId,
          nature: "DEBIT",
          transactionRef,
          referenceType: "INTERNAL_TRANSFER"
        });

        builder.addCredit({
          ledgerAccountId: receiverLedgerId,
          amount: user.amount,
          currency: "NGN",
          referenceId,
          nature: "CREDIT",
          transactionRef,
          referenceType: "INTERNAL_TRANSFER"
        });

        // --- Commit ledger entries ---
        const txn = await builder.commit(session);

        const before = await Wallet.findById(wallet._id).session(session);

        // --- Update wallet balance ---
        await Wallet.updateOne(
          { _id: ensureSystem.MAIN_CHECKINGS.walletId },
          { $inc: { availableBalance: -user.amount } },
          { session }
        );

        await Wallet.updateOne(
          { _id: wallet._id },
          { $inc: { availableBalance: user.amount } },
          { session }
        );

        const after = await Wallet.findById(wallet._id).session(session);

        // --- Mark idempotency ---
        await completedIdempotence(
          user.idempotencyKey as string,
          transactionRef,
          { transactionRef: txn.transactionRef },
          session
        );


        await emitOutboxEvent(
          {
            topic: "transaction.events",
            eventId: txn.transactionRef,
            eventType: AuditAction.TRANSACTION_COMPLETED,
            action: AuditAction.TRANSACTION_COMPLETED,
            status: AuditStatus.PENDING,
            payload: {
              email: wallet.userId.email,
              name: wallet.userId.name,
              fromUserEmail: "system@internal",
              fromUserId: "SYSTEM_USER",
              toUserId: wallet.userPublicId,
              amount: user.amount,
              currency: "NGN",
              previousBalance: before?.availableBalance,
              currentBalance: after?.availableBalance,
              transactionRef,
              referenceId,
              referenceType: "INTERNAL_SYSTEM_TRANSFER"
            },
            aggregateType: "TRANSFER",
            aggregateId: txn.transactionRef,
            version: 1,
            context: {
              ip: "SYSTEM",
              userAgent: "SYSTEM",
            },
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
