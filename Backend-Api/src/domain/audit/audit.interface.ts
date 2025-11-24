import mongoose, { Document, Schema } from 'mongoose';

export interface IAudit extends Document {
  userId?: string;
  action: string;
  status?: string;
  ip?: string;
  userAgent?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
}