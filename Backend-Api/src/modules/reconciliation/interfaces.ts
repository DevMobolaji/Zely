import { PaymentDriftCategory } from "@/modules/reconciliation/reconciliation.model";

export interface WalletDrift {
  walletId: string;
  storedBalance: number;
  ledgerNet: number;
  drift: number;
  isBalanced: boolean;
}

export interface SystemInvariantResult {
  totalWalletBalance: number;
  totalLedgerNet: number;
  totalLedgerCredits: number;
  totalLedgerDebits: number;
  invariantDrift: number;
  isBalanced: boolean;
  checkedAt: Date;
  driftedWallets: WalletDrift[];
}

export interface PaystackTransactionResponse {
  status: boolean;
  message: string;
  data: PaystackTransaction[];
  meta?: {
    total: number;
    skipped: number;
    perPage: number;
    page: number;
    pageCount: number;
  };
}

export interface PaystackTransaction {
  id: number;
  reference: string;
  amount: number; // in kobo
  status: string; // "success", "failed", "abandoned"
  currency: string;
  channel: string;
  paid_at: string;
  created_at: string;
  customer: {
    email: string;
  };
}

export interface PaymentDriftRecord {
  reference: string;
  providerReference: string;
  category: PaymentDriftCategory;
  ourAmount?: number;
  providerAmount?: number;
  ourStatus?: string;
  providerStatus?: string;
  detectedAt: Date;
  requiresManualReview: boolean;
}
