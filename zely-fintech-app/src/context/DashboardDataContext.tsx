import { createContext, useContext, useCallback, ReactNode } from "react";
import { useAsync } from "../hooks/useAsync";
import { transactionService } from "../services/transactionService";

const DashboardDataContext = createContext<any>(null);

export const DashboardDataProvider = ({
  children,
}: {
  children: ReactNode;
}) => {
  const {
    data: wallets,
    loading: loadingWallets,
    execute: refreshWallets,
  } = useAsync(() => transactionService.getWallets());

  const {
    data: transactionsResponse,
    loading: loadingTransactions,
    execute: refreshTransactions,
  } = useAsync(() => transactionService.getAll({ limit: 10, page: 1 }));

  return (
    <DashboardDataContext.Provider
      value={{
        wallets,
        loadingWallets,
        refreshWallets,
        transactions: Array.isArray(transactionsResponse)
          ? transactionsResponse // Shape C
          : (transactionsResponse?.transactions ?? // Shape B
            transactionsResponse?.data?.transactions ?? // Shape A
            []),
        loadingTransactions,
        refreshTransactions,
      }}
    >
      {children}
    </DashboardDataContext.Provider>
  );
};

// DashboardDataContext.tsx
export const useDashboardData = () => {
  const context = useContext(DashboardDataContext);
  if (!context) {
    throw new Error(
      "useDashboardData must be used within a DashboardDataProvider",
    );
  }
  return context;
};
