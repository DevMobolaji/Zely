import { Schema, model } from "mongoose";

const OutboxSchema = new Schema(
  {
    topic: { type: String, required: true, index: true }, // Kafka topic
    eventType: { type: String, required: true, index: true }, // Kafka topic
    eventId: { type: String, required: true, unique: true }, // Idempotency key

    aggregateType: { type: String, required: true },
    aggregateId: { type: String, required: true }, // Kafka key
    action: { type: String, required: true },
    status: {
      type: String,
      enum: ["PENDING", "PROCESSING", "PROCESSED", "FAILED", "SUCCESS"],
      default: "PENDING",
      index: true,
      required: true,
    },

    lockedAt: { type: Date, default: null },   // 👈 REQUIRED
    sentAt: { type: Date, default: null },

    // payload: { type: Object, required: true },
    payload: { type: String, required: true },

    retryCount: { type: Number, default: 0 },

    context: {
      ip: String,
      userAgent: String,
      deviceId: String,
      requestId: String,
    },
    version: { type: Number, required: true, default: 1 },

    timestamp: { type: Date, default: Date.now },

  },
  {
    timestamps: true,
    // ⚠️ Tell Mongoose NOT to use _id as the primary key for CDC
    // Debezium uses the document _id from MongoDB oplog
  }
);

// Required indexes
OutboxSchema.index({ status: 1, lockedAt: 1, createdAt: 1 });
OutboxSchema.index({ aggregateId: 1, occurredAt: 1 });

export const OutboxEvent = model("OutboxEvent", OutboxSchema);

