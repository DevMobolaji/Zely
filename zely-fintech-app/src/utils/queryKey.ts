// export const queryKeys = {
//   wallets: ["wallets"] as const,
//   transactions: (params?: any) =>
//     params ? (["transactions", params] as const) : (["transactions"] as const),
//   dashboardSummary: ["dashboard-summary"] as const,
//   notifications: (page?: number) => ["notifications", page] as const,
//   user: ["user"] as const,
//};

export const queryKeys = {
  wallets: ["wallets"] as const,
  transactions: (params?: any) =>
    params ? (["transactions", params] as const) : (["transactions"] as const),
  dashboardSummary: ["dashboard-summary"] as const,
  notifications: (page?: number) => ["notifications", page] as const,
  user: ["user"] as const,
  vaults: ["vaults"] as const, // ← add
  vault: (vaultId: string) => ["vault", vaultId] as const, // ← add
};
