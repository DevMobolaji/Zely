import { Types } from "mongoose";

export interface AddCreditInput {
  ledgerAccountId: Types.ObjectId;
  amount: number;
  currency: string;
  transactionRef: string;
  referenceId?: string;
  referenceType?: string;
  nature: 'CREDIT'
};

export type AddDebitInput = {
  ledgerAccountId: Types.ObjectId;
  amount: number;
  currency: string;
  transactionRef: string;
  referenceId?: string;
  referenceType?: string;
  nature: 'DEBIT'
};

export type LedgerEntryInput = {
  transactionRef: string;
  referenceId: any;
  referenceType: any;
  ledgerAccountId: Types.ObjectId
  amount: number
  currency: string
  nature: 'DEBIT' | 'CREDIT'
}