import { createContext, useContext, ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { transactionService } from "../services/transactionService";
import { queryKeys } from "@/utils/queryKey";
import { ApiWallet, ApiTransaction } from "../utils/types";

interface DashboardDataContextType {
  wallets: ApiWallet[] | undefined;
  loadingWallets: boolean;
  transactions: ApiTransaction[];
  loadingTransactions: boolean;
  errorTransactions: string | null;
  refreshWallets: () => void;
  refreshTransactions: () => void;
}

const DashboardDataContext = createContext<
  DashboardDataContextType | undefined
>(undefined);

export const DashboardDataProvider = ({
  children,
}: {
  children: ReactNode;
}) => {
  const queryClient = useQueryClient();

  // ─── Wallets query ─────────────────────────────────────────────────────
  const { data: wallets, isLoading: loadingWallets } = useQuery({
    queryKey: queryKeys.wallets,
    queryFn: () => transactionService.getWallets(),
    staleTime: 30 * 1000,
  });

  // ─── Transactions query ────────────────────────────────────────────────
  const {
    data: transactionsResponse,
    isLoading: loadingTransactions,
    error: transactionsError,
  } = useQuery({
    queryKey: queryKeys.transactions({ limit: 20, page: 1 }),
    queryFn: () => transactionService.getAll({ limit: 20, page: 1 }),
    staleTime: 30 * 1000,
  });

  // ─── Deduplicate transactions ──────────────────────────────────────────
  const rawTransactions = transactionsResponse?.transactions ?? [];
  const seen = new Set();
  const transactions = rawTransactions.filter((tx: ApiTransaction) => {
    if (seen.has(tx.transactionId)) return false;
    seen.add(tx.transactionId);
    return true;
  });

  // ─── Refresh helpers — invalidate React Query cache ───────────────────
  const refreshWallets = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.wallets });
  };

  const refreshTransactions = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.transactions() });
  };

  return (
    <DashboardDataContext.Provider
      value={{
        wallets,
        loadingWallets,
        transactions,
        loadingTransactions,
        errorTransactions: transactionsError ? String(transactionsError) : null,
        refreshWallets,
        refreshTransactions,
      }}
    >
      {children}
    </DashboardDataContext.Provider>
  );
};

export const useDashboardData = () => {
  const context = useContext(DashboardDataContext);
  if (!context) {
    throw new Error(
      "useDashboardData must be used within a DashboardDataProvider",
    );
  }
  return context;
};
