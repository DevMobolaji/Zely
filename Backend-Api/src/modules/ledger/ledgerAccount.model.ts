import { generateLedgerAccountId } from "@/shared/utils/id.generator";
import mongoose, { Schema, Document, Types } from "mongoose";

export enum LedgerAccountType {
  USER_AVAILABLE = "USER_AVAILABLE",
  USER_LOCKED = "USER_LOCKED",
}

export interface LedgerAccountDocument extends Document {
  userId: Types.ObjectId;
  walletId: Types.ObjectId;
  type: LedgerAccountType;
  currency: string;
  createdAt: Date;
}

const LedgerAccountSchema = new Schema(
  {
    userId: {
      type: String,
      ref: 'User',
      required: true,
      index: true,
    },

    walletId: {
      type: Schema.Types.ObjectId,
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
  { walletId: 1, type: 1 },
  { unique: true }
);

export const LedgerAccount = mongoose.model<LedgerAccountDocument>(
  "LedgerAccount",
  LedgerAccountSchema
);
