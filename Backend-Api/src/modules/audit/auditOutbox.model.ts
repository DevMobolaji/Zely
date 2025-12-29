import { Schema, model } from "mongoose";

const AuditOutboxSchema = new Schema(
  {
    eventType: { type: String, required: true, index: true },
    action: { type: String, required: true },
    status: { type: String, enum: ["SUCCESS", "FAILED"], required: true },
    reason: { type: String, default: null },
    userId: { type: String, default: null, index: true },

    context: {
      ip: String,
      userAgent: String,
      deviceId: String,
      requestId: String
    },

    occurredAt: { type: Date, required: true },

    processed: { type: Boolean, default: false, index: true },
    processedAt: { type: Date, default: null },

    retryCount: { type: Number, default: 0 },
    lastError: { type: String, default: null }
  },
  { timestamps: true }
);

AuditOutboxSchema.index({ processed: 1, occurredAt: 1 });

export const AuditOutboxModel = model("AuditOutbox", AuditOutboxSchema);
