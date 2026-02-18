import { generateLedgerId } from "@/shared/utils/id.generator";
import mongoose, { Schema, Document, Types } from "mongoose";

// Accounting perspective
export enum LedgerEntryNature {
  DEBIT = "DEBIT",
  CREDIT = "CREDIT",
}

// Business type
export enum LedgerEntryType {
  INTERNAL_TRANSFER = "INTERNAL_TRANSFER",
  P2P_TRANSFER = "P2P_TRANSFER",
  DEPOSIT = "DEPOSIT",
  ADJUSTMENT = "ADJUSTMENT",
  DEBIT = "DEBIT",
}

export interface LedgerEntryDocument extends Document {
  transactionId: Types.ObjectId;
  transactionRef: string;
  ledgerAccountId: Types.ObjectId;
  type: LedgerEntryType;
  amount: number;
  referenceId: string;
  referenceType: LedgerEntryType;
  currency: string;
  createdAt: Date;
}


export const LedgerEntrySchema = new Schema(
  {
    transactionId: { type: Types.ObjectId, ref: "LedgerTransaction", required: true, index: true },

    transactionRef: {
      type: String,
      required: true,
      immutable: true,
      index: true,
    },

    ledgerAccountId: {
      type: Types.ObjectId,
      ref: "LedgerAccount",
      required: true,
      immutable: true
    },

    type: {
      type: String,
      enum: Object.values(LedgerEntryNature),
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
      immutable: true
    },

    currency: {
      type: String,
      required: true,
      uppercase: true,
      immutable: true
    },
    referenceId: {
      type: String,
      required: true,
      index: true,
      immutable: true
    },
    referenceType: {
      type: String,
      enum: Object.values(LedgerEntryType),
      required: true,
      immutable: true
    },
  }, 
  { timestamps: { createdAt: true, updatedAt: false, immutable: true } }
);

LedgerEntrySchema.index({ transactionRef: 1, ledgerAccountId: 1 }, { unique: true })
export const LedgerEntry = mongoose.model<LedgerEntryDocument>(
  "LedgerEntry",
  LedgerEntrySchema
);
