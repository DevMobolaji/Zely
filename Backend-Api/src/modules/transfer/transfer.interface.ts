// transfer.interface.ts
import { Types } from "mongoose";

export enum TransferStatus {
  PENDING = "PENDING",
  SUCCESS = "SUCCESS",
  FAILED = "FAILED",
}

export interface TransferRequestInput {
  senderId: string;
  toAccountNumber: string;
  amount: number;
  currency: string;
  idempotencyKey: string; // used for idempotency
}

export interface internalTransferRequest {
  senderId: string,
  amount: number,
  currency: string,
  fromType: string,
  toType: string,
  idempotencyKey: string

}

export type transferType = "INTERNAL_TRANSFER" | "P2P_TRANSFER";
