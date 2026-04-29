// src/modules/reconciliation/reconciliation.model.ts
import mongoose, { Schema, Document, Types } from "mongoose";
import { generateEventId, generateReconcile } from "@/shared/utils/id.generator";
import { LedgerOwnerType } from "../ledger/ledger.account.model";


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

// A single drift finding (one ledger account checked) 
export interface IDriftRecord {
  ledgerAccountId: Types.ObjectId;
  ledgerAccountPublicId: string;
  ownerId: Types.ObjectId;
  ownerType: LedgerOwnerType;
  ownerPublicId: string;
  currency: string;
  cachedBalance: number;     // from wallet.availableBalance / vault.currentBalanceMinor
  trueBalance: number;       // from sum(credits) − sum(debits)
  drift: number;             // cached − true
  severity: DriftSeverity;
  action: DriftAction;
  detectedAt: Date;
  notes?: string;
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
    ledgerAccountId: { type: Schema.Types.ObjectId as any, ref: "LedgerAccount", required: true },
    ledgerAccountPublicId: { type: String, required: true },
    ownerId: { type: Schema.Types.ObjectId as any, required: true },
    ownerType: { type: String, enum: Object.values(LedgerOwnerType), required: true },
    ownerPublicId: { type: String, required: true },
    currency: { type: String, required: true, uppercase: true },
    cachedBalance: { type: Number, required: true },
    trueBalance: { type: Number, required: true },
    drift: { type: Number, required: true },
    severity: { type: String, enum: Object.values(DriftSeverity), required: true },
    action: { type: String, enum: Object.values(DriftAction), required: true },
    detectedAt: { type: Date, default: Date.now },
    notes: { type: String },
  },
  { _id: false }
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
  { timestamps: true }
);

// Index for "show me runs in the last X days where drift was found"
ReconciliationReportSchema.index({ createdAt: -1, driftsFound: 1 });

export const ReconciliationReport = mongoose.model<ReconciliationReportDocument>(
  "ReconciliationReport",
  ReconciliationReportSchema
);