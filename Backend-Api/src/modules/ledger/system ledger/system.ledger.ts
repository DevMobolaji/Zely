import BadRequestError from "@/shared/errors/badRequest";
import mongoose, { Types } from "mongoose";
import { generateReferenceId, generateTransactionId } from "@/shared/utils/id.generator";
import { emitOutboxEvent } from "@/infrastructure/helpers/emit.audit.helper";
import { AuditAction, AuditStatus } from "@/modules/audit/audit.interface";
import ensureSystemLedger from "./create.system.ledger";
import TransactionBuilder from "../ledger.transaction.builder";
import { ensureWalletsAreActive, lookUpLedgerAccount, resolveAccountByAccountNumber, resolveWallet } from "@/modules/helpers/resolvers";
import { markCompleted, extEnsureIdempotence } from "@/modules/helpers/ext.idempotence";
import { IUser, Wallet, WalletDocument, WalletType } from "@/modules/wallet/wallet.model";
import { LedgerAccountType, LedgerOwnerType } from "../ledger.account.model";
import { IRequestContext } from "@/config/interfaces/request.interface";

interface IWalletPopulated extends Omit<WalletDocument, 'userId'> {
  userId: IUser;
}

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


        const senderWallet = await Wallet.findOne({
          ledgerAccountId: ensureSystem.SYSTEM_TREASURY.id,
          type: LedgerAccountType.SYSTEM_TREASURY
        })

        // --- Resolve user account and wallet ---
        const account = await resolveAccountByAccountNumber(user.accountNumber, "MAIN_CHECKINGS", "NGN", session);

        const wallet = await resolveWallet(account, session);


        /** -------------------------
          * ENSURE ACTIVE WALLETS
        * ------------------------- */
        await ensureWalletsAreActive(senderWallet?._id, wallet._id, session);


        // --- Resolve ledger accounts ---
        const { receiverLedgerId, senderLedgerId } = await lookUpLedgerAccount(
          ensureSystem.SYSTEM_TREASURY.ownerId,
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
        const sysBalBefore = await Wallet.findOne({
          ledgerAccountId: senderLedgerId.toString()
        }).session(session)


        await Wallet.updateOne(
          { userPublicId: 'SYSTEM_USER', type: WalletType.SYSTEM_TREASURY },
          { $inc: { availableBalance: -user.amount } },
          { session }
        );

        await Wallet.updateOne(
          { _id: wallet._id },
          { $inc: { availableBalance: user.amount } },
          { session }
        );

        const UserBalAfter = await Wallet.findById(wallet._id).session(session);
        const sysBalAfter = await Wallet.findOne({
          ledgerAccountId: senderLedgerId
        }).session(session)

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
                userId: ensureSystem.SYSTEM_TREASURY.userPublicId,
                name: "ADMIN_SYSTEM_USER",
                email: "system@zely.app",
                accountType: ensureSystem.SYSTEM_TREASURY.type,
                accountNumber: "1234567899",
                previousBalance: sysBalBefore?.availableBalance,
                currentBalance: sysBalAfter?.availableBalance,
              },
              receiver: {
                walletId: wallet.walletId,
                userId: wallet.userPublicId,
                name: wallet.userId.name,
                email: wallet.userId.email,
                accountType: account.type,
                accountNumber: account.accountNumber,
                previousBalance: userBalBefore?.availableBalance,
                currentBalance: UserBalAfter?.availableBalance,
              },

              amount: user.amount,
              fee: 0,
              totalDeducted: 0,
              currency: "NGN",
              referenceId,
              transactionRef,
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
