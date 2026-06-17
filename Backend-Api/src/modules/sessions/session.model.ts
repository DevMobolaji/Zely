import mongoose, { Document, Schema } from "mongoose";

export interface SessionDocument extends Document {
  sessionId: string;
  userId: string;
  userPublicId: string;
  deviceId: string;
  deviceName: string;
  userAgent: string;
  ipAddress: string;

  // Token tracking
  refreshTokenJti: string;
  accessTokenJti: string;
  refreshTokenHash: string;
  accessTokenExpiresAt: Date;

  // Validity
  isActive: boolean;
  passwordVersion: number;

  // Timestamps
  lastUsedAt: Date;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const SessionSchema = new Schema<SessionDocument>(
  {
    sessionId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    userId: { type: String, required: true, index: true },
    userPublicId: { type: String, required: true, index: true },
    deviceId: { type: String, required: true },
    deviceName: { type: String, default: "Unknown Device" },
    userAgent: { type: String },
    ipAddress: { type: String },
    refreshTokenJti: { type: String, required: true },
    refreshTokenHash: {
      type: String,
      required: true,
      index: true,
    },
    accessTokenJti: { type: String, index: true },
    accessTokenExpiresAt: { type: Date },
    isActive: { type: Boolean, default: true, index: true },
    passwordVersion: { type: Number, default: 0 },
    lastUsedAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true },
);

// // Compound index for session lookup
// SessionSchema.index({
//   refreshTokenHash: 1,
// });
SessionSchema.index({ userId: 1, deviceId: 1, isActive: 1, expiresAt: 1 });

// Auto-delete expired sessions
SessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const SessionModel = mongoose.model<SessionDocument>(
  "Session",
  SessionSchema,
);
