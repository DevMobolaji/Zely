import mongoose, { Schema, Document } from "mongoose";

export interface IEmailOutbox extends Document {
  jobName: string;
  payload: Record<string, any>;
  jobId: string;
  eventId: string;
  transactionRef?: string;
  aggregateType: string;
  status: "PENDING" | "PROCESSING" | "ENQUEUED" | "SENT" | "FAILED";
  attempts: number;
  claimedAt?: Date;
  sentAt?: Date;
  lastError?: string;
  envelope: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

const EmailOutboxSchema = new Schema<IEmailOutbox>(
  {
    /** -------------------------
     * JOB IDENTITY
     * ------------------------- */
    jobName: {
      type: String,
      required: true,
      // e.g. "transferCompleted", "transferFailed", "welcomeEmail"
    },

    payload: {
      type: Schema.Types.Mixed,
      required: true,
      // whatever the email template needs
    },

    jobId: {
      type: String,
      required: true,
      unique: true,
      // BullMQ dedup key — also prevents duplicate outbox records
      // e.g. "TXN_abc123:TRANSACTION_COMPLETED"
    },

    /** -------------------------
     * CORRELATION
     * Allows tracing back to the original Kafka event
     * if an email fails after all attempts
     * ------------------------- */
    eventId: {
      type: String,
      required: true,
      index: true,
    },

    transactionRef: {
      type: String,
      index: true,
      // optional — not all email types have a transactionRef
    },

    aggregateType: {
      type: String,
      required: true,
      // e.g. "TRANSFER", "USER"
    },

    /** -------------------------
     * LIFECYCLE
     * ------------------------- */
    status: {
      type: String,
      enum: ["PENDING", "PROCESSING", "ENQUEUED", "SENT", "FAILED"],
      default: "PENDING",
      index: true,
    },

    attempts: {
      type: Number,
      default: 0,
    },

    claimedAt: {
      type: Date,
      // set when poller atomically claims the job
      // used to detect stuck PROCESSING jobs
    },

    sentAt: {
      type: Date,
      // set when job is successfully dispatched to BullMQ
    },

    lastError: {
      type: String,
      // last error message from BullMQ dispatch attempt
    },

    /** -------------------------
     * FULL ENVELOPE
     * Stored for manual replay and DLQ correlation
     * ------------------------- */
    envelope: {
      type: Schema.Types.Mixed,
      required: true,
    },
  },
  {
    timestamps: true, // createdAt, updatedAt
    collection: "email_outbox",
  }
);

/** -------------------------
 * COMPOUND INDEXES
 * ------------------------- */

// Poller query — picks up PENDING and stuck PROCESSING jobs
EmailOutboxSchema.index({ status: 1, attempts: 1, claimedAt: 1 });

// Correlation queries — find outbox records by Kafka event
EmailOutboxSchema.index({ eventId: 1, status: 1 });

// Business queries — find outbox records by transaction
EmailOutboxSchema.index({ transactionRef: 1, status: 1 });

export const EmailOutboxModel = mongoose.model<IEmailOutbox>(
  "EmailOutbox",
  EmailOutboxSchema
);