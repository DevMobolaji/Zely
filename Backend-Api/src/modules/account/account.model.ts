import mongoose, { Schema, Types } from "mongoose";
import { AccountDocument } from "./account.interface";

export enum AccountStatus {
  ACTIVE = "ACTIVE",
  FROZEN = "FROZEN",
  CLOSED = "CLOSED",
}

export enum AccountType {
  SAVINGS = "SAVINGS",
  MAIN_CHECKINGS = "MAIN_CHECKINGS",
}

const AccountSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    userPublicId: { type: String, required: true },
    accountNumber: { type: String, required: true, unique: true, index: true },
    currency: { type: String, required: true, uppercase: true },
    status: { type: String, enum: Object.values(AccountStatus), default: AccountStatus.ACTIVE },
    type: { type: String, enum: Object.values(AccountType), default: AccountType.MAIN_CHECKINGS },
    walletId: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: "Wallet"
    },
    isPublic: {
      type: Boolean,
      default: true
    },
    ledgerAccountId: {
      type: Types.ObjectId,
      required: true,
      ref: "LedgerAccount"
    },
    locked: {
      type: Boolean,
      default: false
    },

    lockUntil: {
      type: Date,
      default: null
    },
    version: { type: Number, default: 0 },
  },
  { timestamps: true, optimisticConcurrency: true, versionKey: "version" }
);

AccountSchema.index({ userId: 1, accountNumber: 1, type: 1 }, { unique: true });

export const Account = mongoose.model<AccountDocument>("Account", AccountSchema);