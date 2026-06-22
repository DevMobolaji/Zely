import { axiosPrivate } from "../api/client";

export interface Vault {
  vaultId: string;
  title: string;
  vaultType: "TARGET" | "LOCKED" | "FLEXIBLE";
  currency: string;
  targetAmountMinor: number;
  currentBalanceMinor: number;
  lock: {
    state: "LOCKED" | "UNLOCKED" | "MATURED";
    lockedAt?: string;
    lockedUntil?: string;
    penaltyBasisPoints?: number;
  };
  status: "ACTIVE" | "CANCELLED" | "COMPLETED";
  locked: boolean;
  lockedUntil?: string;
  autoSave: { enabled: boolean };
  createdAt: string;
  updatedAt: string;
}

const generateIdempotencyKey = (): string => {
  const timestamp = Date.now();
  const random = Array.from(
    { length: 16 },
    () => Math.random().toString(36)[2] || "0",
  ).join("");
  return `IDP_${timestamp}_${random}`;
};

export const vaultService = {
  // ─── Get all vaults ───────────────────────────────────────────────────
  getAll: async (): Promise<Vault[]> => {
    const response = await axiosPrivate.get("/vault");
    return response.data.data ?? response.data;
  },

  // ─── Get one vault ────────────────────────────────────────────────────
  getOne: async (vaultId: string): Promise<Vault> => {
    const response = await axiosPrivate.get(`/vault/${vaultId}`);
    return response.data.data ?? response.data;
  },

  // ─── Create vault ─────────────────────────────────────────────────────
  create: async (data: {
    title: string;
    vaultType: "TARGET" | "LOCKED" | "FLEXIBLE";
    targetAmountMinor?: number;
    penaltyBasisPoints?: number;
    lockedUntil?: string;
  }): Promise<Vault> => {
    const response = await axiosPrivate.post("/vault/create", data, {
      headers: { "X-Idempotency-Key": generateIdempotencyKey() },
    });
    return response.data.data ?? response.data;
  },

  // ─── Deposit to vault ─────────────────────────────────────────────────
  deposit: async (
    vaultId: string,
    data: {
      amount: number;
      currency: string;
      fromType: "MAIN_CHECKINGS" | "SAVINGS";
    },
  ): Promise<any> => {
    const response = await axiosPrivate.post(
      `/transfer/${vaultId}/deposit`,
      data,
      {
        headers: { "X-Idempotency-Key": generateIdempotencyKey() },
      },
    );
    return response.data;
  },

  // ─── Withdraw from vault ──────────────────────────────────────────────
  withdraw: async (
    vaultId: string,
    data: {
      amount: number;
      currency: string;
    },
  ): Promise<any> => {
    const response = await axiosPrivate.post(
      `/vault/${vaultId}/withdraw`,
      data,
      {
        headers: { "X-Idempotency-Key": generateIdempotencyKey() },
      },
    );
    return response.data;
  },

  // ─── Cancel vault ─────────────────────────────────────────────────────
  cancel: async (vaultId: string): Promise<any> => {
    const response = await axiosPrivate.delete(`/vault/${vaultId}`, {
      headers: { "X-Idempotency-Key": generateIdempotencyKey() },
    });
    return response.data;
  },
};
