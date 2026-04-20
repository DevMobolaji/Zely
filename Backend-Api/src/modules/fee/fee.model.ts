// src/modules/transfer/fee.config.model.ts
import mongoose, { Schema, Document } from 'mongoose';

export interface IFeeTier {
  min: number;
  max: number;
  fee: number;
}

export interface IFeeConfig extends Document {
  currency: string;
  transferType: string;
  tiers: IFeeTier[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const FeeTierSchema = new Schema<IFeeTier>({
  min: { type: Number, required: true, min: 0 },
  max: { type: Number, required: true, min: 0 },
  fee: { type: Number, required: true, min: 0 } },
  { _id: false });

const FeeConfigSchema = new Schema<IFeeConfig>(
  {
    currency: {
      type: String,
      required: true,
      uppercase: true,
    },
    transferType: {
      type: String,
      required: true,
      enum: ['P2P_TRANSFER', 'INTERNAL_TRANSFER', 'VAULT_TRANSFER'],
    },
    tiers: {
      type: [FeeTierSchema],
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

// One active config per currency + transferType
FeeConfigSchema.index(
  { currency: 1, transferType: 1 },
  { unique: true }
);

export const FeeConfig = mongoose.model<IFeeConfig>(
  'FeeConfig',
  FeeConfigSchema
);