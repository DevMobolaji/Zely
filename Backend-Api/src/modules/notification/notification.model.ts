import mongoose, { Document, Schema } from "mongoose";

export enum NotificationType {
  CREDIT = "credit",
  DEBIT = "debit",
  SECURITY = "security",
  INFO = "info",
  WARNING = "warning",
}

export interface INotification extends Document {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  amount?: number;
  currency?: string;
  referenceId?: string;
  read: boolean;
  readAt?: Date;
  createdAt: Date;
}

const NotificationSchema = new Schema<INotification>(
  {
    userId: {
      type: String,
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: Object.values(NotificationType),
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    amount: { type: Number },
    currency: { type: String },
    referenceId: {
      type: String,
      sparse: true,
    },
    read: {
      type: Boolean,
      default: false,
      index: true,
    },
    readAt: { type: Date },
  },
  { timestamps: true },
);

// Primary query — fetch user's notifications newest first
NotificationSchema.index({ userId: 1, createdAt: -1 });

// Unread count query
NotificationSchema.index({ userId: 1, read: 1 });

// Idempotency — prevent duplicate notifications on Kafka retry
NotificationSchema.index(
  { userId: 1, referenceId: 1 },
  { unique: true, sparse: true, name: "idx_notification_idempotency" },
);

// TTL — auto-delete after 30 days
NotificationSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: 30 * 24 * 60 * 60, name: "idx_notification_ttl" },
);

export const Notification = mongoose.model<INotification>(
  "Notification",
  NotificationSchema,
);
