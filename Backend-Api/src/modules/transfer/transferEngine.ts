import mongoose, { Types } from "mongoose";
import { internalTransferRequest, TransferRequestInput, transferType } from "./transfer.interface";
import { completedIdempotence, extEnsureIdempotence } from "@/modules/helpers/ext.idempotence";
import BadRequestError from "@/shared/errors/badRequest";

import { generateReferenceId, generateTransactionId } from "@/shared/utils/id.generator";
import { IRequestContext } from "@/config/interfaces/request.interface";
import TransactionBuilder from "../ledger/ledger.transaction.builder";

import {
  deductWalletFunds,
  ensureWalletsAreActive,
  findWalletByType,
  lockAccountToPreventConcurrency,
  lockWalletFunds,
  lookUpLedgerAccount,
  lookUpPrimaryWallets
} from "../helpers/resolvers";

import { Wallet, WalletDocument } from "../wallet/wallet.model";
import { LedgerEntryNature } from "../ledger/ledger.entry.model";
import { Account } from "../account/account.model";
import { emitOutboxEvent } from "@/infrastructure/helpers/emit.audit.helper";
import { AuditAction, AuditStatus } from "../audit/audit.interface";
import { AccountDocument } from "../account/account.interface";
import { WalletType } from "../wallet/wallet.model";

export interface TransferEngineInput {
  senderAccount: AccountDocument;
  receiverAccount: AccountDocument;
  senderLedgerId: Types.ObjectId;
  receiverLedgerId: Types.ObjectId;

  amount: number;
  currency: string;
  idempotencyKey: string;

  senderWallet: WalletDocument;
  receiverWallet: WalletDocument;
}




class TransferEngine {
  constructor(
    private readonly input: TransferEngineInput,
    private readonly transferType: transferType
  ) { }

  async transferEngines(
    context: IRequestContext,
    session: mongoose.ClientSession
  ) {
    if (!session.inTransaction()) {
      throw new BadRequestError("Transfers must run inside a DB transaction");
    }

    const {
      senderAccount,
      receiverAccount,
      senderLedgerId,
      receiverLedgerId,
      senderWallet,
      receiverWallet,
      amount,
      currency,
      idempotencyKey,
    } = this.input;

    const transactionRef = generateTransactionId();
    const referenceId = generateReferenceId();

    /** -------------------------
     * IDEMPOTENCY
     * ------------------------- */
    const { alreadyCompleted, response } =
      await extEnsureIdempotence(idempotencyKey, session);

    if (alreadyCompleted) return response;

    /** -------------------------
     * DEADLOCK-SAFE LOCKING FOR CONCURRENCY CONTROL
     * ------------------------- */
    const [first, second] =
      senderAccount._id.toHexString() < receiverAccount._id.toHexString()
        ? [senderAccount, receiverAccount]
        : [receiverAccount, senderAccount];

    if (!await lockAccountToPreventConcurrency(first._id, session)) {
      throw new BadRequestError("LOCK_FAILED");
    }

    if (!await lockAccountToPreventConcurrency(second._id, session)) {
      throw new BadRequestError("LOCK_FAILED");
    }

    /** -------------------------
     * BALANCE SNAPSHOT (USER FACING BALANCES)
     * ------------------------- */
    const prevSenderBalance = senderWallet.availableBalance;
    const prevReceiverBalance = receiverWallet.availableBalance;


    /** -------------------------
     * LOCK FUNDS
     * ------------------------- */
    await lockWalletFunds(senderWallet._id, amount, session);


    /** -------------------------
     * LEDGER ENTRIES
     * ------------------------- */
    const builder = new TransactionBuilder(this.transferType);

    builder.addDebit({
      ledgerAccountId: senderLedgerId,
      amount,
      currency,
      nature: LedgerEntryNature.DEBIT,
      transactionRef,
      referenceId,
      referenceType: this.transferType,
    });

    builder.addCredit({
      ledgerAccountId: receiverLedgerId,
      amount,
      currency,
      nature: LedgerEntryNature.CREDIT,
      transactionRef,
      referenceId,
      referenceType: this.transferType,
    });

    const txn = await builder.commit(session);

    /** -------------------------
     * BALANCE MUTATION
     * ------------------------- */

    const senderWalletUpdate = await deductWalletFunds(senderWallet._id, amount, session);

    const receiverWalletUpdate = await Wallet.findOneAndUpdate(
      { _id: receiverWallet._id },
      { $inc: { availableBalance: amount } },
      { session, new: true }
    );

    /** -------------------------
     * UNLOCK ACCOUNTS
     * ------------------------- */
    await Account.updateMany(
      { _id: { $in: [first._id, second._id] } },
      { $set: { locked: false, lockUntil: null } },
      { session }
    );

    /** -------------------------
     * IDEMPOTENCY FINALIZE
     * ------------------------- */
    await completedIdempotence(
      idempotencyKey,
      transactionRef,
      { transactionId: txn.transactionRef },
      session
    );

    /** -------------------------
         * OUTBOX NOTIFICATION
         * ------------------------- */
    await emitOutboxEvent(
      {
        topic: "transaction.events",
        eventId: txn.transactionRef,
        eventType: AuditAction.TRANSACTION_COMPLETED,
        action: AuditAction.TRANSACTION_COMPLETED,
        status: AuditStatus.PENDING,
        payload: {
          sender: {
            userId: senderWallet.userPublicId,
            name: senderWallet.userId.name,
            email: senderWallet.userId.email,
            accountType: senderAccount.type,
            accountNumber: senderAccount.accountNumber,
            previousBalance: prevSenderBalance,
            currentBalance: senderWalletUpdate?.availableBalance,
          },
          receiver: {
            userId: receiverWallet.userPublicId,
            name: receiverWallet.userId.name,
            email: receiverWallet.userId.email,
            accountType: receiverAccount.type,
            accountNumber: receiverAccount.accountNumber,
            previousBalance: prevReceiverBalance,
            currentBalance: receiverWalletUpdate?.availableBalance,
          },
          amount,
          currency,
          referenceId,
          transactionRef,
          transferType: this.transferType,
        },
        aggregateType: "TRANSFER",
        aggregateId: txn.transactionRef,
        version: 1,
        context,
      },
      { session }
    );



    return {
      transactionRef,
      amount,
    };
  }
}



export default TransferEngine;

