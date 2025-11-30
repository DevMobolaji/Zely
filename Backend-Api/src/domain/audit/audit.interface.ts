import mongoose, { Document, Schema } from 'mongoose';

export type AuditSeverity = "INFO" | "WARN" | "CRITICAL";

export interface IAudit extends Document {
  trackedEmail: string;
  action: string;
  status: string;           // latest status
  initialStatus?: string;   // first status
  attemptCount?: number;    // number of attempts
  requestId: string;
  userId?: string | null;
  ip?: string;
  userAgent?: string;
  severity: 'INFO' | 'WARN' | 'CRITICAL';
  metadata?: Record<string, any>;
  createdAt: Date;
  lastAttempt: Date;
}