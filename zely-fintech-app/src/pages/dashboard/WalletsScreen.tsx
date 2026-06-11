import React, { useCallback, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Wallet,
  CreditCard,
  ArrowUpRight,
  ArrowDownLeft,
  Plus,
  ChevronRight,
  Copy,
  History as HistoryIcon,
  Loader2,
} from "lucide-react";

import { useToast } from "../../context/ToastContext";

import { ApiTransaction, ApiWallet } from "../../utils/types";
import { useDashboardData } from "@/context/DashboardDataContext";
import { transactionService } from "@/services/transactionService";
import { useAsync } from "@/hooks/useAsync";
import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/utils/queryKey";

const getWalletTypeFromId = (
  walletId: string,
  wallets?: ApiWallet[] | null,
): string | undefined => {
  return wallets?.find((w) => w.walletId === walletId)?.walletType;
};

const formatDate = (isoDate: string) => {
  const d = new Date(isoDate);
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
};

const getWalletMeta = (walletType: string) => {
  switch (walletType) {
    case "MAIN_CHECKINGS":
      return {
        name: "Main Checking",
        cardProvider: "VISA",
        color: "bg-slate-900 text-white",
      };
    case "SAVINGS":
      return {
        name: "Savings",
        cardProvider: "Mastercard",
        color: "bg-white dark:bg-slate-800 text-slate-900 dark:text-white",
      };
    case "VAULT":
      return {
        name: "Vault",
        cardProvider: "VISA",
        color: "bg-primary text-white",
      };
    default:
      return {
        name: walletType,
        cardProvider: "VISA",
        color: "bg-slate-900 text-white",
      };
  }
};

const WalletsScreen: React.FC = () => {
  const { walletId } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { wallets, loadingWallets } = useDashboardData();

  // Find wallet — may be undefined if walletId not set
  const wallet =
    wallets?.find((w: any) => w.walletId === walletId) ?? wallets?.[0];

  // ─── Always call hooks at top level ──────────────────────────────────
  const { data: walletTransactions, isLoading: loadingWalletTransactions } =
    useQuery({
      queryKey: queryKeys.transactions({ walletType: wallet?.walletType }),
      queryFn: () =>
        transactionService.getAll({
          limit: 20,
          page: 1,
          walletType: wallet?.walletType,
        }),
      enabled: !!walletId && !!wallet?.walletType,
      staleTime: 30 * 1000,
    });

  const walletTxList = walletTransactions?.transactions ?? [];

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    showToast("success", "Copied to clipboard");
  };

  // ─── Loading state ────────────────────────────────────────────────────
  if (loadingWallets)
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );

  // ─── Detail view ──────────────────────────────────────────────────────
  if (walletId) {
    if (!wallet)
      return (
        <div className="flex justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
        </div>
      );

    return (
      <div className="w-full max-w-4xl mx-auto space-y-6 animate-in fade-in slide-in-from-right-4">
        <button
          onClick={() => navigate("/wallets")}
          className="text-sm font-bold text-slate-500 hover:text-primary flex items-center gap-1"
        >
          ← Back to Wallets
        </button>

        <div className="bg-slate-900 text-white rounded-[2rem] p-8 relative overflow-hidden shadow-xl">
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
          <div className="relative z-10">
            <div className="flex justify-between items-start mb-6">
              <div className="p-3 bg-white/10 rounded-xl backdrop-blur-md">
                <div className="p-3 bg-white/10 rounded-xl backdrop-blur-md">
                  <CreditCard className="w-6 h-6 text-white" />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-3 py-1 bg-white/10 backdrop-blur-md rounded-full text-xs font-bold uppercase tracking-wider">
                  {getWalletMeta(wallet.walletType).name}
                </span>
              </div>
            </div>
            <h2 className="text-slate-300 font-bold mb-1">
              {getWalletMeta(wallet.walletType).name}
            </h2>

            <h1 className="text-4xl font-black mb-6">
              {wallet?.currency}
              {wallet?.balance?.toLocaleString("en-NG")}
            </h1>

            <div className="flex gap-3">
              <button
                onClick={() => navigate("/fund-wallet")}
                className="flex-1 py-3 bg-white text-slate-900 rounded-xl font-bold hover:bg-slate-100 transition-colors flex items-center justify-center gap-2 shadow-lg hover:shadow-xl hover:scale-[1.02] duration-200"
              >
                <ArrowDownLeft className="w-4 h-4" /> Fund
              </button>
              <button
                onClick={() => navigate("/transfers")}
                className="flex-1 py-3 bg-white/10 text-white backdrop-blur-md border border-white/10 rounded-xl font-bold hover:bg-white/20 transition-colors flex items-center justify-center gap-2 shadow-lg hover:shadow-xl hover:scale-[1.02] duration-200"
              >
                <ArrowUpRight className="w-4 h-4" /> Transfer
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-100 dark:border-slate-800 shadow-sm">
            <h3 className="font-bold mb-4">Account Details</h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                <div>
                  <p className="text-[10px] font-bold text-slate-500 uppercase">
                    Account Number
                  </p>
                  <p className="font-mono font-bold">
                    {wallet?.accountNumber ?? "—"}
                  </p>
                </div>
                <button
                  onClick={() => handleCopy(wallet?.accountNumber ?? "—")}
                  className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg"
                >
                  <Copy className="w-4 h-4 text-slate-400" />
                </button>
              </div>
              {/* {wallet.iban && (
                <div className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                  <div>
                    <p className="text-[10px] font-bold text-slate-500 uppercase">
                      IBAN
                    </p>
                    <p className="font-mono font-bold truncate max-w-[200px]">
                      {wallet.iban}
                    </p>
                  </div>
                  <button
                    onClick={() => handleCopy(wallet.iban!)}
                    className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg"
                  >
                    <Copy className="w-4 h-4 text-slate-400" />
                  </button>
                </div>
              )} */}
              {/* {wallet.cardExpiry && (
                <div className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                  <div>
                    <p className="text-[10px] font-bold text-slate-500 uppercase">
                      Card Expiry
                    </p>
                    <p className="font-mono font-bold">{wallet.cardExpiry}</p>
                  </div>
                </div>
              )} */}
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-100 dark:border-slate-800 shadow-sm">
            <h3 className="font-bold mb-4">Ledger Summary</h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-slate-500">Total In</span>
                <span className="text-sm font-bold text-green-500">
                  +₦
                  {wallet.totalCredit.toLocaleString("en-NG", {
                    minimumFractionDigits: 2,
                  })}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-slate-500">Total Out</span>
                <span className="text-sm font-bold text-slate-900 dark:text-white">
                  -₦
                  {wallet.totalDebit.toLocaleString("en-NG", {
                    minimumFractionDigits: 2,
                  })}
                </span>
              </div>
              <div className="w-full h-px bg-slate-100 dark:bg-slate-800"></div>
              <div className="flex justify-between">
                <span className="text-sm font-bold">Net Flow</span>
                <span className="text-sm font-bold text-blue-500">
                  ₦
                  {(wallet.totalCredit - wallet.totalDebit).toLocaleString(
                    "en-NG",
                    {
                      minimumFractionDigits: 2,
                    },
                  )}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <h3 className="font-bold flex items-center gap-2">
              <HistoryIcon className="w-5 h-5 text-slate-400" /> Recent
              Transactions
            </h3>
          </div>
          <div>
            {loadingWalletTransactions ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
              </div>
            ) : walletTxList.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-sm text-slate-400 font-medium">
                  No transactions yet
                </p>
              </div>
            ) : (
              walletTxList
                .slice(0, 5)
                .map((tx: ApiTransaction, index: number) => (
                  <div
                    key={tx.transactionId ?? `tx-${index}`}
                    className="p-4 border-b border-slate-50 dark:border-slate-800 last:border-0 flex justify-between items-center hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                  >
                    <div>
                      <p className="font-bold text-sm text-slate-900 dark:text-white">
                        {tx.category === "INTERNAL_TRANSFER"
                          ? tx.direction === "debit"
                            ? `Moved to ${tx.walletType === "MAIN_CHECKINGS" ? "Savings" : "Main Checking"}`
                            : `Moved from ${tx.walletType === "MAIN_CHECKINGS" ? "Savings" : "Main Checking"}`
                          : tx.direction === "debit"
                            ? `Sent to ${tx.counterpartyName ?? "Unknown"}`
                            : `Received from ${tx.counterpartyName ?? "Unknown"}`}
                      </p>
                      <p className="text-xs text-slate-500">
                        {new Date(tx.occurredAt).toLocaleDateString("en-NG", {
                          month: "short",
                          day: "numeric",
                        })}{" "}
                        at {new Date(tx.occurredAt).toLocaleTimeString()}
                      </p>
                    </div>
                    <span
                      className={`text-sm font-bold ${
                        tx.direction === "credit"
                          ? "text-green-500"
                          : "text-slate-900 dark:text-white"
                      }`}
                    >
                      {tx.direction === "credit" ? "+" : "-"}₦
                      {tx.amount.toLocaleString("en-NG", {
                        minimumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                ))
            )}
          </div>
        </div>
      </div>
    );
  }

  // List View
  return (
    <div className="w-full max-w-[1920px] mx-auto space-y-8 animate-in fade-in slide-in-from-right-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">My Wallets</h2>
        <button className="bg-primary hover:bg-primary-light text-white px-4 py-2 rounded-xl font-bold text-sm flex items-center gap-2 transition-colors">
          <Plus className="w-4 h-4" /> Create Wallet
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {(wallets ?? []).map((wallet: any, index: any) => {
          const meta = getWalletMeta(wallet.walletType);
          return (
            <div
              key={wallet.walletId ?? `wallet-${index}`}
              onClick={() => navigate(`/wallets/${wallet.walletId}`)}
              className="group relative bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-xl transition-all duration-300 cursor-pointer overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2 group-hover:bg-primary/10 transition-colors pointer-events-none"></div>
              <div className="relative z-10">
                <div className="flex justify-between items-start mb-8">
                  <div
                    className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                      wallet.walletType === "SAVINGS"
                        ? "bg-green-100 text-green-600 dark:bg-green-900/40 dark:text-green-400"
                        : "bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400"
                    }`}
                  >
                    <CreditCard className="w-6 h-6" />
                  </div>
                  <div className="text-right">
                    <span
                      className={`text-[10px] font-bold uppercase px-2 py-1 rounded-lg ${
                        wallet.walletType === "SAVINGS"
                          ? "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400"
                          : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                      }`}
                    >
                      {wallet.walletType.replace("_", " ")}
                    </span>
                  </div>
                </div>

                <h4 className="text-slate-500 dark:text-slate-400 font-bold text-xs uppercase tracking-wider mb-1">
                  {meta.name}
                </h4>
                <div className="flex items-center justify-between">
                  <h3 className="text-2xl font-black">
                    ₦
                    {wallet.balance.toLocaleString("en-NG", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </h3>
                </div>

                <div className="mt-6 flex items-center justify-between text-xs font-bold text-primary group-hover:underline">
                  <span>View Details</span>
                  <ChevronRight className="w-4 h-4" />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default WalletsScreen;
