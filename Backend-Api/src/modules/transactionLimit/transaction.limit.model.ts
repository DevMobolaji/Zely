import mongoose, { Schema, Document } from "mongoose";

export enum KycTier {
  TIER_1 = "TIER_1",
  TIER_2 = "TIER_2",
  TIER_3 = "TIER_3",
}

export interface ITransactionLimitConfig extends Document {
  tier: KycTier;
  currency: string;
  maxPerTransaction: number;   // max single transfer amount
  maxPerDay: number;           // max daily cumulative (0 = unlimited)
  maxWalletBalance: number;    // max wallet balance allowed (0 = unlimited)
  maxTransfersPerHour: number; // velocity limit (0 = unlimited)
  isActive: boolean;
}

const TransactionLimitConfigSchema = new Schema<ITransactionLimitConfig>(
  {
    tier: {
      type: String,
      enum: Object.values(KycTier),
      required: true,
      index: true,
    },
    currency: {
      type: String,
      required: true,
      uppercase: true,
      default: "NGN",
    },
    maxPerTransaction: { type: Number, required: true, min: 0 },
    maxPerDay: { type: Number, required: true, min: 0 },         // 0 = unlimited
    maxWalletBalance: { type: Number, required: true, min: 0 },  // 0 = unlimited
    maxTransfersPerHour: { type: Number, required: true, min: 0 }, // 0 = unlimited
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

TransactionLimitConfigSchema.index({ tier: 1, currency: 1 }, { unique: true });

export const TransactionLimitConfig = mongoose.model<ITransactionLimitConfig>(
  "TransactionLimitConfig",
  TransactionLimitConfigSchema
);