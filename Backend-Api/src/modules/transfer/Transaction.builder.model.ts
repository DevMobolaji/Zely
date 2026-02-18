import { Schema, model, Document } from 'mongoose'

export interface ILedgerTransactionDocument extends Document {
  transactionRef: string;
  type: 'INTERNAL_TRANSFER' | 'FEE' | 'REVERSAL';
  status: 'INITIATED' | 'POSTED';
  currency: string;
  amount: number;
  createdAt: Date;
}


const LedgerTransactionSchema = new Schema(
  {
    transactionRef: {
      type: String,
      required: true,
      unique: true,
      immutable: true,
      index: true,
    },
    type: {
      type: String,
      enum: ["INTERNAL_TRANSFER", "FEE", "REVERSAL", "P2P_TRANSFER"],
      required: true,
    },
    status: {
      type: String,
      enum: ["INITIATED", "POSTED"],
      required: true,
      index: true,
      default: "INITIATED",
    },
    currency: { type: String, required: true },
    amount: { type: Number, required: true, min: 1 },
    createdAt: { type: Date, default: Date.now, immutable: true },
  },
  { strict: true }
);

// Prevent updates
LedgerTransactionSchema.pre(["updateOne", "findOneAndUpdate"], function () {
  throw new Error("Ledger transactions are immutable");
});

// Idempotency index
LedgerTransactionSchema.index({ createdAt: 1, idempotencyKey: 1 }, { unique: true });

export const LedgerTransactionModel = model<ILedgerTransactionDocument>(
  "LedgerTransaction",
  LedgerTransactionSchema
);

