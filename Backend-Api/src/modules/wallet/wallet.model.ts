import { generateWalletId } from "@/shared/utils/id.generator";
import mongoose, { Schema, Document, Types } from "mongoose";

export enum WalletStatus {
  ACTIVE = "ACTIVE",
  FROZEN = "FROZEN",
}

export interface WalletDocument extends Document {
  userId: Types.ObjectId;
  currency: string;
  walletId: string;
  availableBalance: number; // cached from ledger
  lockedBalance: number;
  status: WalletStatus;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

const WalletSchema = new Schema(
  {
    userId: {
      type: String,
      ref: "User",
      required: true,
      index: true,
    },

    currency: {
      type: String,
      required: true,
      uppercase: true,
      default: "USD", // adjust later
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

    version: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
    optimisticConcurrency: true,
    versionKey: "version",
  }
);

// Enforce 1 wallet per user per currency
WalletSchema.index({ userId: 1, currency: 1 }, { unique: true });

export const Wallet = mongoose.model<WalletDocument>("Wallet", WalletSchema);
