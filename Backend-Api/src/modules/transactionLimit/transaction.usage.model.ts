// transaction.usage.model.ts
import mongoose, { Schema, Document } from "mongoose";

export interface ITransactionUsage extends Document {
  userPublicId: string;
  currency: string;
  date: string;           // "2025-04-20"
  dailyTotal: number;     // mirrors daily_tx Redis key
  hourlyCount: number;    // mirrors velocity Redis key
  hourWindowStart: Date;  // start of current 1hr window
}

const TransactionUsageSchema = new Schema<ITransactionUsage>(
  {
    userPublicId: { type: String, required: true, index: true },
    currency: { type: String, required: true, uppercase: true },
    date: { type: String, required: true },
    dailyTotal: { type: Number, default: 0 },
    hourlyCount: { type: Number, default: 0 },
    hourWindowStart: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// One record per user per currency per day
TransactionUsageSchema.index(
  { userPublicId: 1, currency: 1, date: 1 },
  { unique: true }
);

// Auto-delete after 2 days — mirrors Redis TTL behaviour
TransactionUsageSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: 172800 }
);

export const TransactionUsage = mongoose.model<ITransactionUsage>(
  "TransactionUsage",
  TransactionUsageSchema
);