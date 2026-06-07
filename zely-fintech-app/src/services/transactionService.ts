import { axiosPrivate } from "../api/client";

const generateIdempotencyKey = (): string => {
  const timestamp = Date.now();
  const random = Array.from(
    { length: 16 },
    () => Math.random().toString(36)[2] || "0",
  ).join("");
  return `IDP_${timestamp}_${random}`;
};

export const transactionService = {
  // ─── Get all transactions with pagination ────────────────────────────────
  getAll: async (params?: {
    page?: number;
    limit?: number;
    direction?: "debit" | "credit";
    walletType?: string;
    status?: string;
  }) => {
    const response = await axiosPrivate.get("/users/transactions", { params });
    return response.data;
  },

  // ─── Get recent transactions ─────────────────────────────────────────────
  getRecent: async (limit: number = 5) => {
    const response = await axiosPrivate.get("/users/transactions", {
      params: { limit, page: 1 },
    });
    return response.data.transactions;
  },

  // ─── Get dashboard summary ───────────────────────────────────────────────
  getDashboardSummary: async () => {
    const response = await axiosPrivate.get("/users/dashboard-summary");
    return response.data.data;
  },

  // ─── Get wallets ─────────────────────────────────────────────────────────
  getWallets: async () => {
    const response = await axiosPrivate.get("/users/wallets");
    return response.data.data;
  },

  // ─── Transfer (keep existing simulation for now) ─────────────────────────
  transfer: async (data: {
    amount: number;
    accountId: string;
    type: "internal" | "p2p";
    recipientAccountNumber?: string;
    recipientEmail?: string;
    destWalletId?: string;
  }) => {
    const response = await axiosPrivate.post(
      "/transfer/p2p",
      {
        amount: data.amount,
        to: data.recipientAccountNumber,
        currency: "NGN",
      },
      {
        headers: {
          "X-Idempotency-Key": generateIdempotencyKey(),
        },
      },
    );
    return response.data;
  },

  // ─── Fund wallet ──────────────────────────────────────────────────────────
  fundWallet: async (data: {
    amount: number;
    reference: string;
    method: string;
  }) => {
    const response = await axiosPrivate.post("/payments/initialize", data);
    return response.data;
  },
};
