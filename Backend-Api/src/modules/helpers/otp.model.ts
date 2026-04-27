import { Schema, model, Document } from "mongoose";


export enum OTPPurpose {
  EMAIL_VERIFICATION = 'email_verification',
  PASSWORD_RESET = 'password_reset',
  TWO_FACTOR = 'two_factor',
  PHONE_VERIFICATION = 'phone_verification',
  TRANSACTION_CONFIRM = 'transaction_confirm'
}

export interface IOTP extends Document {
  identifier: string;
  purpose: OTPPurpose;
  codeHash: string;
  attempts: number;
  maxAttempts: number;
  expiresAt: Date;
  consumedAt: Date | null;
  metadata?: Record<string, any>;
  createdAt: Date;
}

const otpSchema = new Schema<IOTP>({
  identifier: { type: String, required: true, lowercase: true, trim: true },
  purpose: { type: String, required: true, enum: Object.values(OTPPurpose) },
  codeHash: { type: String, required: true },
  attempts: { type: Number, default: 0 },
  maxAttempts: { type: Number, required: true },
  expiresAt: { type: Date, required: true },
  consumedAt: { type: Date, default: null },
  metadata: { type: Schema.Types.Mixed },
  createdAt: { type: Date, default: Date.now },
});


// Fast lookup for the active OTP for a given (identifier, purpose) pair
otpSchema.index({ identifier: 1, purpose: 1, consumedAt: 1 });

// TTL — Mongo deletes docs ~60s after expiresAt. Acts as cleanup, not correctness check. 
otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// For rate-limit lookups: "how many OTPs has this identifier created recently?"
otpSchema.index({ identifier: 1, purpose: 1, createdAt: -1 });

export const OTPModel = model<IOTP>("OTP", otpSchema);