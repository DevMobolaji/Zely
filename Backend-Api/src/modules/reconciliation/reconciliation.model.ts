// src/modules/reconciliation/reconciliation.model.ts
import mongoose, { Schema, Document, Types } from "mongoose";
import {
  generateEventId,
  generateReconcile,
} from "@/shared/utils/id.generator";
import { LedgerOwnerType } from "../ledger/ledger.account.model";

export enum DriftCategory {
  MISSING_CREDIT = "MISSING_CREDIT",
  MISSING_DEBIT = "MISSING_DEBIT",
  DUPLICATE_ENTRY = "DUPLICATE_ENTRY",
  AMOUNT_MISMATCH = "AMOUNT_MISMATCH",
  PROVIDER_MISMATCH = "PROVIDER_MISMATCH",
  ROUNDING_ERROR = "ROUNDING_ERROR",
  NORMAL = "NORMAL",
}

export enum DriftResolutionType {
  CORRECTED = "CORRECTED",
  FALSE_POSITIVE = "FALSE_POSITIVE",
  ESCALATED = "ESCALATED",
}

export enum ReconciliationStatus {
  RUNNING = "RUNNING",
  COMPLETED = "COMPLETED",
  FAILED = "FAILED",
}

export enum DriftSeverity {
  IN_SYNC = "IN_SYNC",
  UNDERSTATED = "UNDERSTATED",
  OVERSTATED = "OVERSTATED",
}

export enum DriftAction {
  NONE = "NONE",
  ALERT_ONLY = "ALERT_ONLY",
  ALERT_AND_FREEZE = "ALERT_AND_FREEZE",
}

export enum PaymentDriftCategory {
  MISSING_IN_OUR_SYSTEM = "MISSING_IN_OUR_SYSTEM",
  MISSING_IN_PAYSTACK = "MISSING_IN_PAYSTACK",
  AMOUNT_MISMATCH = "AMOUNT_MISMATCH",
  STATUS_MISMATCH = "STATUS_MISMATCH",
  IN_SYNC = "IN_SYNC",
}

export enum CorrectionMethod {
  LEDGER_ENTRY = "LEDGER_ENTRY",
  DIRECT_CACHE_SYNC = "DIRECT_CACHE_SYNC",
}

export interface IDriftRecord {
  ledgerAccountId: Types.ObjectId;
  ledgerAccountPublicId: string;
  ownerId: Types.ObjectId;
  ownerType: LedgerOwnerType;
  ownerPublicId: string;
  currency: string;
  cachedBalance: number;
  trueBalance: number;
  drift: number;
  severity: DriftSeverity;
  action: DriftAction;
  category: DriftCategory; // ← new
  detectedAt: Date;
  notes?: string;
  resolvedAt?: Date;
  resolvedBy?: string;
  resolutionType?: DriftResolutionType;
  correctionMethod?: CorrectionMethod;
  resolutionNotes?: string;
  compensatingEntryRef?: string;
}

// ─── A whole reconciliation run (one job execution) ──────────────────────
export interface ReconciliationReportDocument extends Document {
  runId: string;
  status: ReconciliationStatus;
  startedAt: Date;
  finishedAt?: Date;
  durationMs?: number;
  accountsChecked: number;
  driftsFound: number;
  drifts: IDriftRecord[];
  triggeredBy: "SCHEDULED" | "MANUAL";
  triggeredByUserId?: Types.ObjectId;
  errorMessage?: string;
  createdAt: Date;
  updatedAt: Date;
}
const DriftRecordSchema = new Schema<IDriftRecord>(
  {
    ledgerAccountId: {
      type: Schema.Types.ObjectId as any,
      ref: "LedgerAccount",
      required: true,
    },
    ledgerAccountPublicId: { type: String, required: true },
    ownerId: { type: Schema.Types.ObjectId as any, required: true },
    ownerType: {
      type: String,
      enum: Object.values(LedgerOwnerType),
      required: true,
    },
    ownerPublicId: { type: String, required: true },
    currency: { type: String, required: true, uppercase: true },
    cachedBalance: { type: Number, required: true },
    trueBalance: { type: Number, required: true },
    drift: { type: Number, required: true },
    severity: {
      type: String,
      enum: Object.values(DriftSeverity),
      required: true,
    },
    action: { type: String, enum: Object.values(DriftAction), required: true },
    category: {
      type: String,
      enum: Object.values(DriftCategory),
      default: DriftCategory.NORMAL,
    },
    detectedAt: { type: Date, default: Date.now },
    notes: { type: String },
    resolvedAt: { type: Date },
    resolvedBy: { type: String },
    resolutionType: {
      type: String,
      enum: Object.values(DriftResolutionType),
    },
    correctionMethod: {
      type: String,
      enum: ["LEDGER_ENTRY", "DIRECT_CACHE_SYNC"],
      required: false,
    },
    resolutionNotes: { type: String },
    compensatingEntryRef: { type: String },
  },
  { _id: false },
);

const ReconciliationReportSchema = new Schema<ReconciliationReportDocument>(
  {
    runId: {
      type: String,
      required: true,
      unique: true,
      immutable: true,
      index: true,
      default: () => generateReconcile(),
    },
    status: {
      type: String,
      enum: Object.values(ReconciliationStatus),
      default: ReconciliationStatus.RUNNING,
      index: true,
    },
    startedAt: { type: Date, required: true, default: Date.now },
    finishedAt: { type: Date },
    durationMs: { type: Number },
    accountsChecked: { type: Number, default: 0 },
    driftsFound: { type: Number, default: 0, index: true },
    drifts: { type: [DriftRecordSchema], default: [] },
    triggeredBy: {
      type: String,
      enum: ["SCHEDULED", "MANUAL"],
      required: true,
      index: true,
    },
    triggeredByUserId: { type: Schema.Types.ObjectId as any, ref: "User" },
    errorMessage: { type: String },
  },
  { timestamps: true },
);

// Index for "show me runs in the last X days where drift was found"
// Add a unique compound index that makes a true double-write impossible at the DB level
ReconciliationReportSchema.index(
  { runId: 1, "drifts.ledgerAccountPublicId": 1, "drifts.resolvedAt": 1 },
  { partialFilterExpression: { "drifts.resolvedAt": { $exists: true } } },
);
export const ReconciliationReport =
  mongoose.model<ReconciliationReportDocument>(
    "ReconciliationReport",
    ReconciliationReportSchema,
  );
