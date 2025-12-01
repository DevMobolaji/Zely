import { Schema, model, Document } from 'mongoose';
import { AuditSeverity, IAudit } from './audit.interface';

const AuditSchema = new Schema<IAudit>(
  {
    trackedEmail: { type: String, required: true, index: true },
    action: { type: String, required: true },
    status: { type: String, required: true},
    initialStatus: { type: String },
    attemptCount: { type: Number, default: 1 },
    requestId: { type: String, required: true, index: true },
    userId: { type: String, default: null },
    ip: { type: String, default: "UNKNOWN_AGENT" },
    userAgent: { type: String, default: "UNKNOWN_AGENT"},
    severity: { type: String, enum: ['INFO', 'WARN', 'CRITICAL'] as AuditSeverity[], default: 'INFO' },
    metadata: { type: Schema.Types.Mixed },
    createdAt: { type: Date, default: Date.now },
    lastAttempt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

AuditSchema.index(
    { trackedEmail: 1, action: 1 },
    { unique: true, partialFilterExpression: { trackedEmail: { $exists: true } } }
)

export const AuditModel = model<IAudit>('Audit', AuditSchema);
