import { generateWalletId } from "@/shared/utils/id.generator";
import mongoose, { Schema, Document, Types } from "mongoose";

export enum WalletStatus {
  ACTIVE = "ACTIVE",
  FROZEN = "FROZEN",
  CLOSED = "CLOSED",
  RECONCILING = "RECONCILING"
}

export enum FreezeReason {
  FRAUD = "FRAUD",
  SUSPICIOUS = "SUSPICIOUS",
  FROZEN = "FROZEN",
}

export enum WalletType {
  MAIN_CHECKINGS = 'MAIN_CHECKINGS',
  SAVINGS = 'SAVINGS',
  ESCROW = 'ESCROW',
  SYSTEM_FEE = 'SYSTEM_FEE',
  SETTLEMENT = 'SETTLEMENT'
}

export interface IUser {
  _id: Types.ObjectId;
  email: string;
  name: string;
}


export interface WalletDocument extends Document {
  userId: IUser; //Types.ObjectId;
  userPublicId: string;
  type: WalletType;
  currency: string;
  walletId: string;
  availableBalance: number; // cached from ledger
  lockedBalance: number;
  status: WalletStatus;
  freezeReason: string | null;
  freezeUntil: Date | null;
  version: number;
  locked: boolean;
  lockUntil?: Date;
  createdAt: Date;
}

const WalletSchema = new Schema(
  {
    userId: {
      type: Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    userPublicId: { type: String, required: true },

    type: {
      type: String,
      enum: Object.values(WalletType),
      required: true,
      index: true,
      default: WalletType.MAIN_CHECKINGS
    },

    currency: {
      type: String,
      required: true,
      uppercase: true,
      default: "NGN", // adjust later
    },
    availableBalance: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },

    walletId: {
      type: String,
      required: true,
      unique: true,
      immutable: true,
      index: true,
      default: generateWalletId,
    },

    lockedBalance: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },

    status: {
      type: String,
      enum: Object.values(WalletStatus),
      default: WalletStatus.ACTIVE,
      index: true,
    },

    freezeReason: { type: String, enum: Object.values(FreezeReason), default: null },

    freezeUntil: { type: Date, default: null },

    version: {
      type: Number,
      default: 0,
    },
    locked: {
      type: Boolean,
      default: false,
    },
    lockUntil: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    optimisticConcurrency: true,
    versionKey: "version",
  }
);

// Enforce 1 wallet per user per currency
WalletSchema.index({ userPublicId: 1, currency: 1, type: 1 }, { unique: true });

export const Wallet = mongoose.model<WalletDocument>("Wallet", WalletSchema);
