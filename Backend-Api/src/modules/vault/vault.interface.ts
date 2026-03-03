import { Types } from "mongoose";

export type LockState = "UNLOCKED" | "LOCKED" | "MATURED";

export interface IVault {
  // Identity
  userId: Types.ObjectId;
  userPublicId: string;
  vaultId: string;
  ledgerAccountId: Types.ObjectId;

  // Goal metadata
  title: string;
  currency: string;
  targetAmountMinor?: number;
  targetDeadline?: Date;

  // Balance (read optimization only — ledger is source of truth)
  currentBalanceMinor: number;

  // Lock state machine
  lock: {
    state: LockState;
    lockedAt?: Date;
    lockedUntil?: Date;
    penaltyBasisPoints?: number; // 100 = 1%
  };

  // Auto-save configuration
  autoSave: {
    enabled: boolean;
    amountMinor?: number;
    frequency?: "DAILY" | "WEEKLY" | "MONTHLY";
    nextRunAt?: Date;
    lastRunAt?: Date;
  };

  // Lifecycle
  status: "ACTIVE" | "COMPLETED" | "CANCELLED";
}
