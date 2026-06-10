import mongoose, { Schema, Document } from "mongoose";

/* ============================================================
   1️⃣ USER PROFILE PROJECTION
============================================================ */

export interface IUserProfile extends Document {
  userId: string;
  email: string;
  fullName: string;
  kycStatus: string;
  accountStatus: string;
  createdAt: Date;
  updatedAt: Date;
  limit: number;
  lastLoginAt?: Date;
}

const UserProfileSchema = new Schema(
  {
    userId: {
      type: String,
      required: true,
      immutable: true,
      unique: true,
      index: true,
    },

    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },

    fullName: {
      type: String,
      required: true,
      trim: true,
    },

    kycStatus: {
      type: String,
      enum: ["pending", "verified", "rejected"],
      default: "pending",
      index: true,
    },

    accountStatus: {
      type: String,
      enum: ["active", "suspended", "closed"],
      default: "active",
      index: true,
    },
  },
  {
    timestamps: true,
    strict: "throw",
    versionKey: false,
  },
);

/* ============================================================
   2️⃣ USER WALLET PROJECTION
============================================================ */

export interface IUserWallet extends Document {
  userId: string;
  walletId: string;
  walletType: string;
  currency: string;
  balance: number;
  status: string;
  version: number;
  updatedAt: Date;
}

const UserWalletSchema = new Schema(
  {
    walletId: {
      type: String,
      required: true,
      immutable: true,
      unique: true,
      index: true,
    },
    userId: {
      type: String,
      required: true,
      index: true,
    },
    walletType: {
      type: String,
      enum: ["MAIN_CHECKINGS", "SAVINGS", "VAULT"],
      required: true,
      index: true,
    },
    currency: {
      type: String,
      required: true,
      uppercase: true,
    },
    balance: {
      type: Number,
      required: true,
      min: 0,
    },
    status: {
      type: String,
      enum: ["active", "frozen", "closed"],
      default: "active",
      index: true,
    },
    limit: { type: Number, required: true },
    version: {
      // ← add this
      type: Number,
      default: 0,
    },
  },
  { imestamps: true, strict: "throw" },
);

UserWalletSchema.index({ userId: 1, walletType: 1, walletId: 1 });

/* ============================================================
   3️⃣ USER BALANCE SUMMARY (DASHBOARD OPTIMIZED)
============================================================ */

export interface IUserBalanceSummary extends Document {
  userId: string;
  totalBalance: number;
  mainBalance: number;
  savingsBalance: number;
  vaultBalance: number;
  currency: string;
  updatedAt: Date;
}
const UserBalanceSummarySchema = new Schema(
  {
    userId: { type: String, required: true, unique: true, index: true },
    currency: { type: String, required: true },
    mainBalance: { type: Number, default: 0 },
    savingsBalance: { type: Number, default: 0 },
    vaultBalance: { type: Number, default: 0 },
    totalBalance: { type: Number, default: 0 },
    totalDebit: { type: Number, default: 0 }, // cumulative debits
    totalCredit: { type: Number, default: 0 }, // cumulative credits
  },
  { timestamps: true },
);

/* ============================================================
   4️⃣ USER TRANSACTION HISTORY (HEAVY READ MODEL)
============================================================ */

export interface IUserTransaction extends Document {
  userId: string;
  name: string;
  transactionRef: string;
  eventId: string;
  referenceId: string;
  direction: "debit" | "credit";
  amount: number;
  currency: string;
  walletType: string;
  counterpartyUserId?: string;
  counterpartyName?: string;
  counterpartyWalletType: string;
  status: string;
  action: string;
  fee: number;
  category: string;
  occurredAt: Date;
}

const UserTransactionSchema = new Schema<IUserTransaction>(
  {
    userId: { type: String, required: true, index: true },
    name: { type: String, required: true, index: true },
    transactionRef: { type: String, required: true, index: true },
    referenceId: { type: String, required: true, index: true },
    direction: { type: String, enum: ["debit", "credit"], required: true },
    amount: { type: Number, required: true },
    currency: { type: String, required: true },
    walletType: { type: String, required: true },
    counterpartyUserId: { type: String },
    counterpartyName: { type: String },
    counterpartyWalletType: { type: String },
    eventId: { type: String, required: true, index: true },
    fee: { type: Number, required: true, index: true },
    status: { type: String, required: true, index: true },
    action: { type: String, required: true, index: true },
    category: { type: String, required: true, index: true },
    occurredAt: { type: Date, required: true, index: true },
  },
  { timestamps: true },
);

// Optimized pagination index
UserTransactionSchema.index(
  { eventId: 1, userId: 1, walletType: 1, occurredAt: -1 },
  { unique: true },
);

/* ============================================================
   EXPORT MODELS
============================================================ */

export const UserProfileModel = mongoose.model(
  "UserProfile",
  UserProfileSchema,
);

export const UserWalletModel = mongoose.model("UserWallet", UserWalletSchema);

export const UserBalanceSummaryModel = mongoose.model(
  "UserBalanceSummary",
  UserBalanceSummarySchema,
);

export const UserTransactionModel = mongoose.model(
  "UserTransaction",
  UserTransactionSchema,
);
