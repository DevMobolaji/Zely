import { Schema, model, Types, Document } from "mongoose";

const LockSchema = new Schema(
  {
    state: {
      type: String,
      enum: ["LOCKED", "UNLOCKED", "MATURED"],
      required: true,
    },
    lockedAt: {
      type: Date,
    },
    lockedUntil: {
      type: Date,
    },
    penaltyBasisPoints: {
      type: Number,
      min: 0,
      max: 10000, // 100%
    },
  },
  { _id: false },
);

const AutoSaveSchema = new Schema(
  {
    enabled: { type: Boolean, default: false },
    amountMinor: { type: Number, min: 0 },
    frequency: { type: String, enum: ["DAILY", "WEEKLY", "MONTHLY"] },
    nextRunAt: Date,
    lastRunAt: Date,
  },
  { _id: false },
);

export interface IUser {
  _id: Types.ObjectId;
  email: string;
  name: string;
}

export interface ILock {
  state: "LOCKED" | "UNLOCKED" | "MATURED";
  lockedAt?: Date;
  lockedUntil?: Date;
  penaltyBasisPoints?: number;
}

export interface VaultDocument extends Document {
  userId: Types.ObjectId;
  userPublicId: string;
  ledgerAccountId: Types.ObjectId;
  vaultId: string;
  title: string;
  targetAmountMinor: number;
  targetDeadline: Date;
  currentBalanceMinor: number;
  lock: ILock;
  autoSave: { type: typeof AutoSaveSchema; default: () => { enabled: false } };
  currency: string;
  availableBalance: number;
  lockedBalance: number;
  status: string;
  freezeReason: string | null;
  freezeUntil: Date | null;
  version: number;
  vaultType: "FLEXIBLE" | "LOCKED" | "TARGET";
  locked: boolean;
  lockUntil?: Date;
}

const VaultSchema = new Schema(
  {
    // Identity
    userId: {
      type: Types.ObjectId,
      required: true,
      index: true,
    },

    userPublicId: {
      type: String,
      required: true,
      index: true,
    },

    vaultId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    ledgerAccountId: {
      type: Types.ObjectId,
      ref: "LedgerAccount",
      required: true,
      unique: true,
    },

    vaultType: {
      type: String,
      enum: ["FLEXIBLE", "LOCKED", "TARGET"],
      required: true,
      index: true,
    },

    // Goal metadata
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },

    currency: {
      type: String,
      required: true,
    },

    targetAmountMinor: {
      type: Number,
      min: 0,
    },

    targetDeadline: {
      type: Date,
    },

    currentBalanceMinor: {
      type: Number,
      default: 0,
    },

    lock: { type: LockSchema, default: () => ({ state: "UNLOCKED" }) },

    autoSave: { type: AutoSaveSchema, default: () => ({ enabled: false }) },

    version: {
      type: Number,
      default: 0,
    },

    // Lifecycle
    status: {
      type: String,
      enum: ["ACTIVE", "COMPLETED", "CANCELLED"],
      default: "ACTIVE",
      index: true,
    },

    locked: {
      type: Boolean,
      default: false,
    },
    lockedUntil: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

VaultSchema.pre("validate", async function () {
  const { vaultType, lock, targetAmountMinor } = this as any;

  if (vaultType === "FLEXIBLE") {
    // Flexible has no lock constraints
    if (lock?.state === "LOCKED") {
      throw new Error("FLEXIBLE vault cannot be locked");
    }
    return;
  }

  if (vaultType === "LOCKED") {
    if (!lock?.lockedUntil) {
      throw new Error("LOCKED vault must have lockedUntil date");
    }
    if (lock.lockedUntil <= new Date()) {
      throw new Error("lockedUntil must be in the future");
    }
    return;
  }

  if (vaultType === "TARGET") {
    if (!targetAmountMinor || targetAmountMinor <= 0) {
      throw new Error("TARGET vault must have a positive targetAmountMinor");
    }
    return;
  }
});

VaultSchema.index({ userId: 1, status: 1 });
VaultSchema.index({ "autoSave.enabled": 1, "autoSave.nextRunAt": 1 });
VaultSchema.index({ "lock.state": 1, "lock.lockedUntil": 1 });

export default model<VaultDocument>("Vault", VaultSchema);
