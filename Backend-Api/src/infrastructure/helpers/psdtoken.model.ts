// password-reset-token.model.ts
import { Schema, model, Document } from "mongoose";

export interface IPasswordResetToken extends Document {
  jti: string;                     // matches the JWT's jti claim
  identifier: string;              // normalized email
  issuedAt: Date;
  expiresAt: Date;
  consumedAt: Date | null;
  ipAddress?: string;
  userAgent?: string;
  ipAtConsume?: string;
  userAgentAtConsume?: string;
}

const passwordResetTokenSchema = new Schema<IPasswordResetToken>({
  jti: { type: String, required: true, unique: true },
  identifier: { type: String, required: true, lowercase: true, trim: true },
  issuedAt: { type: Date, required: true, default: Date.now },
  expiresAt: { type: Date, required: true },
  consumedAt: { type: Date, default: null },
  ipAddress: { type: String },
  userAgent: { type: String },
  ipAtConsume: { type: String },
  userAgentAtConsume: { type: String },
});

// Atomic consumption check (find + mark used)
passwordResetTokenSchema.index({ jti: 1, consumedAt: 1 });

// Find active tokens for an email (for revocation, debugging)
passwordResetTokenSchema.index({ identifier: 1, consumedAt: 1, expiresAt: 1 });

// Auto-cleanup after expiry — Mongo deletes docs ~60s after expiresAt
passwordResetTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const PasswordResetTokenModel = model<IPasswordResetToken>(
  "PasswordResetToken",
  passwordResetTokenSchema,
);