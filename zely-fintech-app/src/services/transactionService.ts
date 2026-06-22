import { axiosPrivate } from "../api/client";

export const generateIdempotencyKey = (): string => {
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

  // ─── Notifications ───────────────────────────────────────────────────────────
  getNotifications: async (page: number = 1, limit: number = 20) => {
    const response = await axiosPrivate.get("/notification", {
      params: { page, limit },
    });
    return response.data;
  },

  markAllNotificationsRead: async () => {
    const response = await axiosPrivate.patch("/notification/read");
    return response.data;
  },

  markOneNotificationRead: async (id: string) => {
    const response = await axiosPrivate.patch(`/notification/${id}/read`);
    return response.data;
  },

  deleteNotification: async (id: string) => {
    const response = await axiosPrivate.delete(`/notification/${id}`);
    return response.data;
  },

  clearAllNotifications: async () => {
    const response = await axiosPrivate.delete("/notification");
    return response.data;
  },
};
