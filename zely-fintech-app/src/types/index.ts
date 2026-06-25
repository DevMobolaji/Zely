import React from "react";

// --- API Response Types ---
export interface ApiResponse<T> {
  data: T;
  message: string;
  status: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

// --- Domain Entities ---

export type TransactionStatus = "success" | "pending" | "failed";
export type TransactionType = "incoming" | "outgoing";

export interface Transaction {
  id: string;
  title: string;
  category: string;
  amount: number;
  date: string;
  status: TransactionStatus;
  type: TransactionType;
  recipientName?: string;
  notes?: string;
  fee?: number;
  merchantDetails?: {
    name: string;
    address: string;
    mapPlaceholderColor?: string;
  };
}

export interface Account {
  id: string;
  name: string;
  type: "current" | "savings" | "virtual" | "crypto";
  balance: number;
  currency: string;
  number: string;
  iban?: string;
  trend: string;
  trendUp: boolean;
  cardProvider?: "VISA" | "Mastercard";
  cardExpiry?: string;
  cardLast4?: string;
}

export interface Notification {
  id: string;
  type: "current" | "debit" | "security" | "info" | "credit";
  title: string;
  message: string;
  time: string;
  read: boolean;
}

export interface Session {
  id: string;
  device: string;
  browser: string;
  location: string;
  lastActive: string;
  isCurrent: boolean;
  icon: React.ElementType;
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: "user" | "admin";
  avatarUrl?: string;
}

/// --- KYC Types ---
export type KYCTier = "TIER_1" | "TIER_2" | "TIER_3";
export type KYCStatus = "PENDING_REVIEW" | "APPROVED" | "REJECTED";

export interface KYCSubmission {
  id: string;
  userId: string;
  userName?: string;
  userEmail?: string;
  tier: KYCTier;
  status: KYCStatus;
  submittedAt: string;
  rejectionReason?: string;
  data: Tier2Payload | Tier3Payload;
}

export interface CloudinarySignatureResponse {
  signature: string;
  timestamp: number;
  apiKey: string;
  cloudName: string;
  folder: string;
  allowedFormats: string[];
  maxBytes: number;
  resourceType: "image" | "video" | "auto";
}

export type KYCDocumentType =
  | "GOVERNMENT_ID"
  | "PROOF_OF_ADDRESS"
  | "SELFIE"
  | "LIVENESS_VIDEO";

export interface KYCStatusResponse {
  currentTier: KYCTier;
  pendingSubmission: {
    id: string;
    targetTier: KYCTier; // Updated based on requirements: targetTier
    status: KYCStatus;
    submittedAt: string;
  } | null;
  lastRejection: {
    id?: string;
    reason: string;
    targetTier: KYCTier; // Updated based on requirements: targetTier
    reviewedAt: string; // Updated based on requirements: reviewedAt
  } | null;
}

export interface Tier2Payload {
  bvn: string;
  nin: string;
  dateOfBirth: string;
  governmentId: {
    type:
      | "DRIVERS_LICENSE"
      | "INTERNATIONAL_PASSPORT"
      | "VOTERS_CARD"
      | "NATIONAL_ID_CARD";
    number: string;
    documentUrl: string;
  };
  address: {
    street: string;
    city: string;
    state: string;
    country: string;
    proofOfAddressUrl: string;
  };
}

export interface Tier3Payload {
  selfieUrl: string;
  livenessVideoUrl: string;
}

export interface UploadSignatureResponse {
  signature: string;
  timestamp: number;
  apiKey: string;
  cloudName: string;
  folder: string;
  allowedFormats: string[];
  maxBytes: number;
  resourceType: string; // "image" | "auto" | "video" etc.
  type: "authenticated";
}

export interface CloudinaryUploadResult {
  public_id: string;
  secure_url: string;
  format: string;
  bytes: number;
  [key: string]: any;
}

export interface GovernmentIdPayload {
  type: string; // e.g. "DRIVERS_LICENSE"
  number: string;
  documentUrl: string;
}

export interface AddressPayload {
  street: string;
  city: string;
  state: string;
  country: string;
  proofOfAddressUrl: string;
}

export interface SubmitTier2Payload {
  bvn: string;
  nin: string;
  dateOfBirth: string;
  governmentId: GovernmentIdPayload;
  address: AddressPayload;
}

export interface KycSubmissionResponse {
  submissionId: string;
  status: string;
  targetTier: string;
  submittedAt: string;
}
