import mongoose, { Schema } from "mongoose";
import { IAudit } from "./audit.interface";


const AuditSchema = new Schema<IAudit>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: false, allowNull: true, },
  action: { type: String, required: true, index: true },
  status: String,
  ip: String,
  userAgent: String,
  metadata: { type: Schema.Types.Mixed },
}, { timestamps: { createdAt: true, updatedAt: false } });

export const AuditModel = mongoose.model<IAudit>('Audit', AuditSchema);