import { generateWalletId } from "@/shared/utils/id.generator";
import mongoose, { Schema, Document, Types } from "mongoose";
import { LedgerAccountType } from "../ledger/ledger.account.model";

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

export interface IUser {
  _id: Types.ObjectId;
  email: string;
  name: string;
}


export interface WalletDocument extends Document {
  userId: IUser; //Types.ObjectId;
  userPublicId: string;
  ledgerAccountId: Types.ObjectId; // Ledger source of truth
  type: LedgerAccountType;
  currency: string;
  walletId: string;
  availableBalance: number; // cachedWalLedgerAccountTypeletType from ledger
  lockedBalance: number;
  status: WalletStatus;
  freezeReason: string | null;
  freezeUntil: Date | null;
  version: number;
  locked: boolean;
  lockUntil?: Date;
  createdAt: Date;

  // Audit trail for the current unfreeze (latest only)
  unfrozenBy?: Types.ObjectId;
  unfrozenAt?: Date;
  unfreezeReason?: string;

  // Full history of freeze/unfreeze cycles
  freezeHistory: Array<{
    frozenAt: Date;
    freezeReason: string;
    frozenBy?: Types.ObjectId | null;  // null = system-initiated (e.g., reconciliation)
    unfrozenAt?: Date;
    unfrozenBy?: Types.ObjectId;
    unfreezeReason?: string;
  }>;
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

    ledgerAccountId: {
      type: Types.ObjectId,
      ref: "LedgerAccount",
      required: true,
      unique: true, // one wallet per ledger account
    },

    type: {
      type: String,
      enum: Object.values(LedgerAccountType),
      required: true,
      index: true,
      default: LedgerAccountType.MAIN_CHECKINGS
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

    unfrozenBy: {
      type: Types.ObjectId,
      ref: "User",
      default: null
    },
    unfrozenAt: { type: Date, default: null },
    unfreezeReason: { type: String, default: null },

    freezeHistory: {
      type: [
        {
          frozenAt: { type: Date, required: true },
          freezeReason: { type: String, required: true },
          frozenBy: { type: Types.ObjectId, ref: "User", default: null },
          unfrozenAt: { type: Date, default: null },
          unfrozenBy: { type: Types.ObjectId, ref: "User", default: null },
          unfreezeReason: { type: String, default: null },
        }
      ],
      default: [],
    },

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

// At the bottom of the file, for any code still importing WalletType
export { LedgerAccountType as WalletType } from "../ledger/ledger.account.model";

// Enforce 1 wallet per user per currency
WalletSchema.index({ userPublicId: 1, currency: 1, type: 1 }, { unique: true });

export const Wallet = mongoose.model<WalletDocument>("Wallet", WalletSchema);
