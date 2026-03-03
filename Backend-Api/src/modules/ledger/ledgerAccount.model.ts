// src/modules/ledger/ledgerAccount.model.ts
import { generateLedgerAccountId } from "@/shared/utils/id.generator";
import mongoose, { Schema, Document, Types } from "mongoose";

export enum LedgerAccountType {
  MAIN_CHECKINGS = "MAIN_CHECKINGS",
  SAVINGS = "SAVINGS",

  SYSTEM_TREASURY = "SYSTEM_TREASURY",
  SYSTEM_REVENUE = "SYSTEM_REVENUE",
  VAULT = "VAULT",
}

export enum LedgerOwnerType {
  WALLET = "WALLET",
  SYSTEM = "SYSTEM",
  USER = "USER",
  VAULT = "VAULT"
}

export interface LedgerAccountDocument extends Document {
  userId: Types.ObjectId;
  userPublicId: string;
  ownerId: Types.ObjectId;        // walletId or vaultId
  ownerType: LedgerOwnerType;     // WALLET | VAULT | SYSTEM
  ledgerAccountId: string;
  type: LedgerAccountType;
  currency: string;
  createdAt: Date;
}

const LedgerAccountSchema = new Schema(
  {
    userPublicId: {
      type: String,
      required: true,
      index: true,
    },
    ownerId: {
      type: Types.ObjectId,
      required: true,
      index: true
    },
    ownerPublicId: {
      type: String,
      index: true,
      require: true
    }, 

    ownerType: {
      type: String,
      enum: Object.values(LedgerOwnerType),
      required: true,
      index: true
    },
    ledgerAccountId: {
      type: String,
      required: true,
      unique: true,
      immutable: true,
      default: generateLedgerAccountId
    },
    type: {
      type: String,
      enum: Object.values(LedgerAccountType),
      required: true,
    },
    currency: {
      type: String,
      required: true,
      uppercase: true
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

LedgerAccountSchema.pre("validate", async function () {
  const allowedTypesByOwner: Record<LedgerOwnerType, LedgerAccountType[]> = {
    [LedgerOwnerType.WALLET]: [
      LedgerAccountType.MAIN_CHECKINGS,
      LedgerAccountType.SAVINGS,
    ],

    [LedgerOwnerType.VAULT]: [
      LedgerAccountType.VAULT,
    ],

    [LedgerOwnerType.SYSTEM]: [
      LedgerAccountType.SYSTEM_TREASURY,
      LedgerAccountType.SYSTEM_REVENUE,
    ],

    [LedgerOwnerType.USER]: [
      LedgerAccountType.MAIN_CHECKINGS,
      LedgerAccountType.SAVINGS,
    ]
  };

  const allowedTypes = allowedTypesByOwner[this.ownerType];

  if (!allowedTypes.includes(this.type)) {
    throw new Error(
      `Invalid ledger type ${this.type} for ownerType ${this.ownerType}`
    );
  }
});
// Prevent duplicate ledger accounts for same owner/type
LedgerAccountSchema.index(
  { ownerId: 1, ownerType: 1, type: 1, currency: 1 },
  { unique: true }
);

export const LedgerAccount = mongoose.model<LedgerAccountDocument>(
  "LedgerAccount",
  LedgerAccountSchema
);
