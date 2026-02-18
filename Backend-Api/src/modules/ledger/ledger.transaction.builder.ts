import BadRequestError from "@/shared/errors/badRequest";
import { ClientSession, Types } from "mongoose";
import { LedgerTransactionModel } from "../transfer/Transaction.builder.model";
import { LedgerAccount } from "./ledgerAccount.model";
import { AddCreditInput, AddDebitInput, LedgerEntryInput } from "@/config/interfaces/ledgerEntry.interface";
import { LedgerEntry } from "./ledger.entry.model";
import { generateLedgerId } from "@/shared/utils/id.generator";

export type LedgerTransactionType = 'INTERNAL_TRANSFER' | 'FEE' | 'REVERSAL' | "P2P_TRANSFER"

class TransactionBuilder {
  private entries: LedgerEntryInput[] = []
  private type: LedgerTransactionType;
  private isCommitted = false;

  constructor(type: LedgerTransactionType) {
    this.type = type
  }

  private ensureNotCommitted() {
    if (this.isCommitted) {
      throw new BadRequestError("Transaction already committed")
    }
  }


  addCredit(input: AddCreditInput) {
    this.ensureNotCommitted()
    this.entries = [...this.entries, {
      transactionRef: input.transactionRef,
      ledgerAccountId: input.ledgerAccountId,
      amount: input.amount,
      currency: input.currency,
      nature: 'CREDIT',
      referenceId: input.referenceId,
      referenceType: input.referenceType
    }]
  }

  addDebit(input: AddDebitInput) {
    this.ensureNotCommitted()
    this.entries = [...this.entries, {
      transactionRef: input.transactionRef,
      ledgerAccountId: input.ledgerAccountId,
      amount: input.amount,
      currency: input.currency,
      nature: 'DEBIT',
      referenceId: input.referenceId,
      referenceType: input.referenceType
    }]
  }

  private validate() {
    if (this.entries.length < 2) {
      throw new BadRequestError("ledger entries must have 2 entries")
    }

    const currency = this.entries[0].currency
    let debit = 0
    let credit = 0

    for (const e of this.entries) {
      if (e.currency !== currency) {
        throw new BadRequestError("Mixed currency in ledger transactions")
      }

      if (e.amount < 0) {
        throw new BadRequestError("Amount must be greater than 0")
      }

      if (e.nature === "DEBIT") debit += e.amount
      if (e.nature === "CREDIT") credit += e.amount
    }

    if (debit !== credit) {
      throw new BadRequestError("Invalid Ledger Balance")
    }
  }

  async commit(session: ClientSession) {
    this.ensureNotCommitted()
    if (!session?.inTransaction()) {
      throw new BadRequestError('Ledger commit must be inside DB transaction');
    }

    this.validate();

    const ledgerAccounts = await LedgerAccount.find({
      _id: { $in: this.entries.map(e => e.ledgerAccountId) }
    })
      .session(session)
      .setOptions({ maxTimeMS: 5000 });

    if (ledgerAccounts.length !== new Set(this.entries.map(e => e.ledgerAccountId.toString())).size) {
      throw new BadRequestError("One or more ledger accounts do not exist");
    }


    for (const entry of this.entries) {
      if (entry.nature === "DEBIT") {
        const ledger = ledgerAccounts.find((l: { _id: { equals: (arg0: Types.ObjectId) => any; }; }) => l._id.equals(entry.ledgerAccountId));
        if (!ledger) throw new BadRequestError("Ledger account missing");
      }
    }

    //This is only meant for locking of the trasaction document so no read or write op at that moment 
    await LedgerAccount.updateMany(
      { _id: { $in: this.entries.map(e => e.ledgerAccountId) } },
      { $inc: { version: 0 } }, // no-op write
      { session }
    );

    const totalCreditAmount = this.entries
      .filter(e => e.nature === "CREDIT")
      .reduce((sum, e) => sum + e.amount, 0);


    // Step 1: create transaction
    const [txn] = await LedgerTransactionModel.create(
      [
        {
          transactionRef: this.entries[0].transactionRef,
          type: this.type,
          status: 'POSTED',
          currency: this.entries[0].currency,
          amount: totalCreditAmount,
          createdAt: new Date(),
        }
      ],
      { session }
    );

    // Step 2: create ledger entries
    const ledgerEntries = this.entries.map(e => ({
      transactionId: txn._id,
      transactionRef: txn.transactionRef,
      type: e.nature, // must be LedgerEntryNature
      amount: e.amount,
      currency: e.currency,
      referenceId: e.referenceId,
      referenceType: e.referenceType,
      ledgerAccountId: e.ledgerAccountId,
      ledgerId: generateLedgerId()
    }));

    await LedgerEntry.insertMany(ledgerEntries, { session });


    this.isCommitted = true
    return txn
  }
}

export default TransactionBuilder

