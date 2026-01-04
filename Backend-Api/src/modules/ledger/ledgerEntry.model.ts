import { generateLedgerId } from "@/shared/utils/id.generator";
import mongoose, { Schema, Document, Types } from "mongoose";

export enum LedgerEntryType {
  DEBIT = "DEBIT",
  CREDIT = "CREDIT",
}

export interface LedgerEntryDocument extends Document {
  transactionId: string;
  accountId: Types.ObjectId;
  type: LedgerEntryType;
  amount: number;
  currency: string;
  createdAt: Date;
}

const LedgerEntrySchema = new Schema(
  {
    transactionId: {
      type: String,
      required: true,
      index: true,
    },

    accountId: {
      type: Types.ObjectId,
      ref: "LedgerAccount",
      required: true,
      index: true,
    },

    type: {
      type: String,
      enum: Object.values(LedgerEntryType),
      required: true,
    },

    ledgerId: {
          type: String,
          required: true,
          unique: true,
          immutable: true,
          index: true,
          default: generateLedgerId,
        },

    amount: {
      type: Number,
      required: true,
      min: 0.01,
    },

    currency: {
      type: String,
      required: true,
      uppercase: true,
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// Idempotency guard
LedgerEntrySchema.index(
  { transactionId: 1, accountId: 1 },
  { unique: true }
);

export const LedgerEntry = mongoose.model<LedgerEntryDocument>(
  "LedgerEntry",
  LedgerEntrySchema
);
