// src/modules/payments/payment.initialization.model.ts
import mongoose, { Schema, Document, Types } from "mongoose";
import { generateEventId } from "@/shared/utils/id.generator";
import { LedgerAccountType } from "../ledger/ledger.account.model";

export enum PaymentInitializationStatus {
  PENDING = "PENDING",
  SUCCESS = "SUCCESS",        // webhook confirmed payment
  FAILED = "FAILED",          // provider reported failure
  ABANDONED = "ABANDONED",    // user never completed (timeout)
  DISPUTED = "DISPUTED",      // chargeback (future use)
}

export enum PaymentPurpose {
  USER_WALLET_FUNDING = "USER_WALLET_FUNDING",
  ADMIN_TREASURY_TOPUP = "ADMIN_TREASURY_TOPUP",
}

export interface PaymentInitializationDocument extends Document {
  reference: string;                  // OUR unique reference (we generate this)
  purpose: PaymentPurpose;

  // Who initiated
  initiatedByUserId: Types.ObjectId;
  initiatedByUserPublicId: string;

  // What's being funded
  targetWalletId: string;             // Zely wallet to credit
  targetWalletType: LedgerAccountType;

  // Money details
  amount: number;                     // minor units (kobo)
  currency: string;

  // Provider tracking
  providerName: string;               // PAYSTACK, FLUTTERWAVE, MOCK
  providerReference?: string;         // their reference (returned at initialization)
  providerAuthorizationUrl?: string;  // URL we redirect user to

  // Status
  status: PaymentInitializationStatus;

  // Lifecycle timestamps
  initiatedAt: Date;
  completedAt?: Date;
  expiredAt?: Date;

  // Webhook payload archive (for audit/debugging)
  providerInitResponse?: any;
  providerWebhookPayload?: any;
  failureReason?: string;

  // Idempotency
  clientIdempotencyKey: string;       // user-provided, ensures duplicate clicks don't double-init

  createdAt: Date;
  updatedAt: Date;
}

const PaymentInitializationSchema = new Schema<PaymentInitializationDocument>(
  {
    reference: {
      type: String,
      required: true,
      unique: true,
      immutable: true,
      index: true,
      default: () => `PAY_${generateEventId()}`,
    },
    purpose: {
      type: String,
      enum: Object.values(PaymentPurpose),
      required: true,
      immutable: true,
    },
    initiatedByUserId: {
      type: Schema.Types.ObjectId as any,
      ref: "User",
      required: true,
      immutable: true,
      index: true,
    },
    initiatedByUserPublicId: {
      type: String,
      required: true,
      immutable: true,
      index: true,
    },
    targetWalletId: {
      type: String,
      required: true,
      immutable: true,
      index: true,
    },
    targetWalletType: {
      type: String,
      enum: Object.values(LedgerAccountType),
      required: true,
      immutable: true,
    },
    amount: {
      type: Number,
      required: true,
      immutable: true,
      min: 100, // ₦1 minimum
    },
    currency: {
      type: String,
      required: true,
      uppercase: true,
      immutable: true,
      default: "NGN",
    },
    providerName: {
      type: String,
      required: true,
      immutable: true,
      uppercase: true,
    },
    providerReference: {
      type: String,
      index: true,
      sparse: true, // not all initializations have a provider ref yet
    },
    providerAuthorizationUrl: { type: String },
    status: {
      type: String,
      enum: Object.values(PaymentInitializationStatus),
      default: PaymentInitializationStatus.PENDING,
      index: true,
    },
    initiatedAt: { type: Date, default: Date.now, immutable: true },
    completedAt: { type: Date },
    expiredAt: { type: Date },
    providerInitResponse: { type: Schema.Types.Mixed },
    providerWebhookPayload: { type: Schema.Types.Mixed },
    failureReason: { type: String },
    clientIdempotencyKey: {
      type: String,
      required: true,
      immutable: true,
    },
  },
  { timestamps: true }
);

// Critical indexes ────────────────────────────────────────────────────────

// Idempotency: same user + same client key = same initialization
// Prevents double-clicks from creating two payment attempts
PaymentInitializationSchema.index(
  { initiatedByUserId: 1, clientIdempotencyKey: 1 },
  { unique: true }
);

// Lookup by provider reference when webhook arrives
PaymentInitializationSchema.index(
  { providerName: 1, providerReference: 1 },
  { unique: true, sparse: true }
);

// Find stuck initializations (for the reaper job)
PaymentInitializationSchema.index({ status: 1, initiatedAt: 1 });

export const PaymentInitialization = mongoose.model<PaymentInitializationDocument>(
  "PaymentInitialization",
  PaymentInitializationSchema
);