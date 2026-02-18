import { generateLedgerAccountId } from "@/shared/utils/id.generator";
import mongoose, { Schema, Document, Types } from "mongoose";

export enum LedgerAccountType {
  MAIN_CHECKINGS = "MAIN_CHECKINGS",
  SAVINGS = "SAVINGS",
}

export interface LedgerAccountDocument extends Document {
  userId: Types.ObjectId;
  userPublicId: string;
  walletId: Types.ObjectId;
  type: LedgerAccountType;
  currency: string;
  createdAt: Date;
}

const LedgerAccountSchema = new Schema(
  {
    userId: {
      type: Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    userPublicId: {
      type: String,
      required: true,
      index: true,
    },
    walletId: {
      type: Types.ObjectId,
      ref: 'Wallet',
      required: true,
      index: true,
    },

    ledgerAccountId: {
      type: String,
      required: true,
      unique: true,
      immutable: true,
      index: true,
      default: generateLedgerAccountId,
    },

    type: {
      type: String,
      enum: Object.values(LedgerAccountType),
      required: true,
    },

    currency: {
      type: String,
      required: true,
      uppercase: true,
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);


// One account per type per wallet
LedgerAccountSchema.index(
  { walletId: 1, type: 1, userId: 1 },
  { unique: true }
);

export const LedgerAccount = mongoose.model<LedgerAccountDocument>(
  "LedgerAccount",
  LedgerAccountSchema
);
