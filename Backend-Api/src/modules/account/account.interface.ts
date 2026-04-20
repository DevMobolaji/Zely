import { Types } from "mongoose";
import { Document } from "mongoose";

export interface AccountDocument extends Document {
  userId: Types.ObjectId;
  userPublicId: string;
  accountNumber: string;
  currency: string;
  status: string;
  type?: string;
  walletId: Types.ObjectId;
  ledgerAccountId: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
  version: number;
}