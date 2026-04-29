// src/modules/kyc/kyc.model.ts
import mongoose, { Schema, Document, Types } from "mongoose";
import { KycTier } from "../transactionLimit/transaction.limit.model";

export enum KycSubmissionStatus {
  PENDING_REVIEW = "PENDING_REVIEW",
  AUTO_APPROVED = "AUTO_APPROVED",
  AUTO_REJECTED = "AUTO_REJECTED",
  APPROVED = "APPROVED",       // admin approved (manual)
  REJECTED = "REJECTED",       // admin rejected (manual)
}

export enum GovernmentIdType {
  DRIVERS_LICENSE = "DRIVERS_LICENSE",
  INTERNATIONAL_PASSPORT = "INTERNATIONAL_PASSPORT",
  VOTERS_CARD = "VOTERS_CARD",
  NATIONAL_ID_CARD = "NATIONAL_ID_CARD",
}

export interface IGovernmentId {
  type: GovernmentIdType;
  number: string;
  documentUrl: string;
}

export interface IAddress {
  street: string;
  city: string;
  state: string;
  country: string;
  proofOfAddressUrl: string;
}

export interface KycSubmissionDocument extends Document {
  userId: Types.ObjectId;
  userPublicId: string;
  targetTier: KycTier;
  status: KycSubmissionStatus;

  // Tier 2 fields
  bvn?: string;
  nin?: string;
  dateOfBirth?: Date;
  governmentId?: IGovernmentId;
  address?: IAddress;

  // Tier 3 fields
  selfieUrl?: string;
  livenessVideoUrl?: string;

  // Verifier metadata
  providerName?: string;          // ADMIN, DOJAH, SMILE_IDENTITY
  providerReference?: string;     // reference returned by external provider
  providerRawResponse?: any;      // raw response for debugging

  // Review metadata
  reviewedBy?: Types.ObjectId;    // admin user (only for manual reviews)
  reviewedAt?: Date;
  rejectionReason?: string;

  submittedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const KycSubmissionSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    userPublicId: { type: String, required: true, index: true },
    targetTier: {
      type: String,
      enum: Object.values(KycTier),
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(KycSubmissionStatus),
      default: KycSubmissionStatus.PENDING_REVIEW,
      index: true,
    },

    bvn: { type: String, trim: true },
    nin: { type: String, trim: true },
    dateOfBirth: { type: Date },
    governmentId: {
      type: {
        type: String,
        enum: Object.values(GovernmentIdType),
      },
      number: { type: String, trim: true },
      documentUrl: { type: String },
    },
    address: {
      street: { type: String, trim: true },
      city: { type: String, trim: true },
      state: { type: String, trim: true },
      country: { type: String, trim: true, default: "NG" },
      proofOfAddressUrl: { type: String },
    },

    selfieUrl: { type: String },
    livenessVideoUrl: { type: String },

    providerName: { type: String },
    providerReference: { type: String, index: true },
    providerRawResponse: { type: Schema.Types.Mixed },

    reviewedBy: { type: Schema.Types.ObjectId, ref: "User" },
    reviewedAt: { type: Date },
    rejectionReason: { type: String },

    submittedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// Prevent two pending submissions for same user
KycSubmissionSchema.index(
  { userPublicId: 1, status: 1 },
  {
    unique: true,
    partialFilterExpression: { status: KycSubmissionStatus.PENDING_REVIEW },
  }
);

// BVN must be unique across approved submissions (one BVN = one identity)
KycSubmissionSchema.index(
  { bvn: 1 },
  {
    unique: true,
    partialFilterExpression: {
      status: { $in: [KycSubmissionStatus.APPROVED, KycSubmissionStatus.AUTO_APPROVED] },
      bvn: { $exists: true, $type: "string" },
    },
  }
);

export const KycSubmission = mongoose.model<KycSubmissionDocument>(
  "KycSubmission",
  KycSubmissionSchema
);