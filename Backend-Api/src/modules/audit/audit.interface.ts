import { Document } from 'mongoose';

export type AuditSeverity = 'INFO' | 'WARN' | 'CRITICAL';


export interface IAudit extends Document {
  trackedEmail: string;
  action: string;
  status: string;
  initialStatus?: string;
  attemptCount: number;
  requestId: string;
  userId?: string | null;
  ip: string;
  userAgent: string;
  severity: AuditSeverity;
  metadata?: Record<string, any>;
  createdAt: Date;
  lastAttempt: Date;
  updatedAt?: Date;
}



export enum AuditAction {
  // User Registration
  USER_REGISTER_ATTEMPT = 'USER_REGISTER_ATTEMPT',
  USER_REGISTER_SUCCESS = 'USER_REGISTER_SUCCESS',
  USER_REGISTER_FAILED = 'USER_REGISTER_FAILED',

  // User Login
  USER_LOGIN_ATTEMPT = 'USER_LOGIN_ATTEMPT',
  USER_LOGIN_SUCCESS = 'USER_LOGIN_SUCCESS',
  USER_LOGIN_FAILED = 'USER_LOGIN_FAILED',

  // Password Management
  PASSWORD_RESET_ATTEMPT = 'PASSWORD_RESET_ATTEMPT',
  PASSWORD_RESET_SUCCESS = 'PASSWORD_RESET_SUCCESS',
  PASSWORD_RESET_FAILED = 'PASSWORD_RESET_FAILED',
  PASSWORD_CHANGE_SUCCESS = 'PASSWORD_CHANGE_SUCCESS',
  PASSWORD_CHANGE_FAILED = 'PASSWORD_CHANGE_FAILED',

  // Session Management
  USER_LOGOUT = 'USER_LOGOUT',
  USER_LOGOUT_ALL = 'USER_LOGOUT_ALL',
  REFRESH_TOKEN_ATTEMPT = 'REFRESH_TOKEN_ATTEMPT',
  REFRESH_TOKEN_SUCCESS = 'REFRESH_TOKEN_SUCCESS',
  REFRESH_TOKEN_FAILURE = 'REFRESH_TOKEN_FAILURE',

  // Account Management
  ACCOUNT_CREATED = 'ACCOUNT_CREATED',
  ACCOUNT_UPDATED = 'ACCOUNT_UPDATED',
  ACCOUNT_FROZEN = 'ACCOUNT_FROZEN',
  ACCOUNT_UNFROZEN = 'ACCOUNT_UNFROZEN',
  ACCOUNT_CLOSED = 'ACCOUNT_CLOSED',

  // Transactions
  TRANSACTION_INITIATED = 'TRANSACTION_INITIATED',
  TRANSACTION_PROCESSING = 'TRANSACTION_PROCESSING',
  TRANSACTION_COMPLETED = 'TRANSACTION_COMPLETED',
  TRANSACTION_FAILED = 'TRANSACTION_FAILED',
  TRANSACTION_REVERSED = 'TRANSACTION_REVERSED',

  // Payments
  PAYMENT_INITIATED = 'PAYMENT_INITIATED',
  PAYMENT_RECEIVED = 'PAYMENT_RECEIVED',
  PAYMENT_SENT = 'PAYMENT_SENT',
  PAYMENT_FAILED = 'PAYMENT_FAILED',
  PAYMENT_REFUNDED = 'PAYMENT_REFUNDED',

  // Security Events
  SUSPICIOUS_ACTIVITY = 'SUSPICIOUS_ACTIVITY',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  UNAUTHORIZED_ACCESS = 'UNAUTHORIZED_ACCESS',
  NEW_DEVICE_LOGIN = 'NEW_DEVICE_LOGIN',
  NEW_LOCATION_LOGIN = 'NEW_LOCATION_LOGIN',

  // KYC/Compliance
  KYC_SUBMITTED = 'KYC_SUBMITTED',
  KYC_APPROVED = 'KYC_APPROVED',
  KYC_REJECTED = 'KYC_REJECTED',
  KYC_DOCUMENT_UPLOADED = 'KYC_DOCUMENT_UPLOADED',

  // Device Management
  DEVICE_REGISTERED = 'DEVICE_REGISTERED',
  DEVICE_TRUSTED = 'DEVICE_TRUSTED',
  DEVICE_BLOCKED = 'DEVICE_BLOCKED',
}

/**
 * Audit Status Types (for consistency)
 */
export enum AuditStatus {
  PENDING = 'PENDING',
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  BLOCKED = 'BLOCKED',
  ERROR = 'ERROR',
}

/**
 * Audit Event Type (for your logEvent method)
 */
export type AuditEvent = {
  userId?: string | null;
  action: string | AuditAction; // Can be string or enum
  status?: string | AuditStatus;
  requestId?: string;
  ip?: string;
  userAgent?: string;
  metadata?: Record<string, any>;
  severity?: AuditSeverity;
  trackedEmail?: string; // Added for your schema
};