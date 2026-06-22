import { useDashboardData } from "@/context/DashboardDataContext";
import { Vault, vaultService } from "@/services/vault.service";
import { queryKeys } from "@/utils/queryKey";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import confetti from "canvas-confetti";
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowRight,
  CalendarClock,
  Check,
  CheckCircle2,
  ChevronDown,
  Loader2,
  Lock,
  PartyPopper,
  Pencil,
  PiggyBank,
  Plus,
  Target,
  Trash2,
  Unlock,
  Wallet,
  X,
} from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import CustomDatePicker from "../../components/common/CustomDatePicker";
import { useToast } from "../../context/ToastContext";
import { Account } from "../../utils/types";
import axiosPrivate from "@/api/client";

// Helper to format currency with commas
const formatCurrency = (value: string | number) => {
  if (!value) return "";
  const cleanVal = String(value).replace(/[^0-9.]/g, "");
  if (!cleanVal) return "";
  const parts = cleanVal.split(".");
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return parts.join(".");
};

const parseCurrency = (value: string) => {
  return value.replace(/,/g, "");
};

interface AccountSelectProps {
  label: string;
  accounts: Account[];
  selectedId: string;
  onChange: (id: string) => void;
  disabled?: boolean;
}

const AccountSelect: React.FC<AccountSelectProps> = ({
  label,
  accounts,
  selectedId,
  onChange,
  disabled,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const selectedAccount = accounts.find((a) => a.id === selectedId);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="space-y-2 relative" ref={dropdownRef}>
      <label className="text-xs font-bold text-slate-500 uppercase ml-1">
        {label}
      </label>
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`w-full bg-slate-50 dark:bg-slate-800 border ${isOpen ? "border-primary ring-2 ring-primary/20" : "border-slate-200 dark:border-slate-700"} rounded-xl p-4 flex items-center justify-between transition-all outline-none text-left disabled:opacity-60 disabled:cursor-not-allowed`}
      >
        {selectedAccount ? (
          <div>
            <p className="font-bold text-slate-900 dark:text-white text-sm">
              {selectedAccount.name}
            </p>
            <p className="text-xs font-medium text-slate-500">
              {selectedAccount.currency}
              {selectedAccount.balance.toLocaleString("en-NG", {
                minimumFractionDigits: 2,
              })}
            </p>
          </div>
        ) : (
          <span className="text-slate-400 font-medium">Select an account</span>
        )}
        <ChevronDown
          className={`w-5 h-5 text-slate-400 transition-transform duration-300 ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 max-h-60 overflow-y-auto">
          {accounts.length > 0 ? (
            accounts.map((acc) => (
              <button
                key={acc.id}
                type="button"
                onClick={() => {
                  onChange(acc.id);
                  setIsOpen(false);
                }}
                className="w-full p-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors border-b border-slate-50 dark:border-slate-800 last:border-0 text-left group"
              >
                <div>
                  <p
                    className={`font-bold text-sm ${acc.id === selectedId ? "text-primary" : "text-slate-900 dark:text-white"}`}
                  >
                    {acc.name}
                  </p>
                  <p className="text-xs font-medium text-slate-500">
                    {acc.currency}
                    {acc.balance.toLocaleString("en-NG")}
                  </p>
                </div>
                {acc.id === selectedId && (
                  <Check className="w-4 h-4 text-primary" />
                )}
              </button>
            ))
          ) : (
            <div className="p-4 text-center text-sm text-slate-500">
              No accounts available
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const SavingsScreen: React.FC = () => {
  const { showToast } = useToast();

  const queryClient = useQueryClient();
  const { wallets } = useDashboardData();

  // Modals State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [activeTopUpvault, setActiveTopUpvault] = useState<Vault | null>(null);
  const [completedvault, setCompletedvault] = useState<Vault | null>(null);
  const [vaultToDelete, setvaultToDelete] = useState<Vault | null>(null);
  const [deletePreviewData, setDeletePreviewData] = useState<any>(null);
  const [isFetchingDeletePreview, setIsFetchingDeletePreview] = useState(false);
  // Edit Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  // const [editingvault, setEditingvault] = useState<Vault | null>(null);
  // const [editTitle, setEditTitle] = useState("");
  // const [editTarget, setEditTarget] = useState("");
  // const [editDeadline, setEditDeadline] = useState("");
  // const [editAutoSave, setEditAutoSave] = useState(false);
  // const [editType, setEditType] = useState<"flexible" | "target" | "locked">(
  //   "flexible",
  // );
  // const [isUpdating, setIsUpdating] = useState(false);

  // Create vault Form State
  const [newvaultTitle, setNewvaultTitle] = useState<string>("");
  const [newvaultTarget, setNewvaultTarget] = useState<string>("");
  const [newvaultDeadline, setNewvaultDeadline] = useState<string>("");
  const [newvaultAutoSave, setNewvaultAutoSave] = useState<boolean>(false);
  const [newvaultType, setNewvaultType] = useState<
    "FLEXIBLE" | "TARGET" | "LOCKED"
  >("FLEXIBLE");
  const [newvaultPenalty, setNewvaultPenalty] = useState<string>("0");
  const [isCreating, setIsCreating] = useState(false);

  // Top Up Form State
  const [topUpAmount, setTopUpAmount] = useState("");
  const [sourceAccountId, setSourceAccountId] = useState("");
  const [isProcessingTopUp, setIsProcessingTopUp] = useState(false);

  // Withdraw Form State
  const [activeWithdrawvault, setActiveWithdrawvault] = useState<Vault | null>(
    null,
  );
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [targetAccountId, setTargetAccountId] = useState("");
  const [isProcessingWithdraw, setIsProcessingWithdraw] = useState(false);

  const { data: vaults, isLoading: loadingVaults } = useQuery({
    queryKey: queryKeys.vaults,
    queryFn: () => vaultService.getAll(),
    staleTime: 30 * 1000,
  });

  const activeVaults =
    vaults?.filter((vault) => vault.status === "ACTIVE") ?? [];

  const sourceAccounts = (wallets ?? []).map((w) => ({
    id: w.walletId,
    name: w.walletType === "MAIN_CHECKINGS" ? "Main Checking" : "Savings",
    type:
      w.walletType === "MAIN_CHECKINGS"
        ? ("current" as const)
        : ("savings" as const),
    balance: w.balance,
    currency: "₦",
    number: w.accountNumber ?? "",
    trend: "",
    trendUp: true,
    limit: 0,
  }));

  const accounts = sourceAccounts;

  useEffect(() => {
    if (wallets && wallets.length > 0 && !sourceAccountId) {
      const checking = wallets.find((w) => w.walletType === "MAIN_CHECKINGS");
      if (checking) setSourceAccountId(checking.walletId);
    }
  }, [wallets]);

  const [withdrawalPreviewData, setWithdrawalPreviewData] = useState<{
    amount: number;
    penalty: number;
    netAmount: number;
    vaultId: string;
  } | null>(null);
  const [isFetchingPreview, setIsFetchingPreview] = useState(false);

  useEffect(() => {
    if (!activeWithdrawvault || !withdrawAmount) {
      setWithdrawalPreviewData(null);
      return;
    }

    const amountVal = Number(parseCurrency(withdrawAmount));
    if (amountVal <= 0) {
      setWithdrawalPreviewData(null);
      return;
    }

    const vaultId = activeWithdrawvault.vaultId;
    let isMounted = true;
    setIsFetchingPreview(true);

    const fetchPreview = async () => {
      try {
        const response = await axiosPrivate.get(
          `/vault/${vaultId}/withdrawal-preview`,
          {
            params: { amount: amountVal },
          },
        );
        if (isMounted) {
          setWithdrawalPreviewData(response.data.data);
        }
      } catch (err) {
        console.error("Error fetching withdrawal preview:", err);
        // Graceful fallback to client-side calculation if endpoint fails or doesn't exist
        if (isMounted) {
          // Use actual penalty rate from vault — not hardcoded
          const penaltyBasisPoints =
            activeWithdrawvault.lock?.penaltyBasisPoints ?? 0;
          const penalty = Math.floor((amountVal * penaltyBasisPoints) / 10000);
          const netAmount = amountVal - penalty;

          setWithdrawalPreviewData({
            amount: amountVal,
            penalty,
            netAmount,
            vaultId,
          });
        }
      } finally {
        if (isMounted) {
          setIsFetchingPreview(false);
        }
      }
    };

    const timeoutId = setTimeout(fetchPreview, 400); // debounce API call slightly for smooth input typing

    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
    };
  }, [activeWithdrawvault?.vaultId, withdrawAmount]);

  // --- Handlers --

  useEffect(() => {
    if (!vaultToDelete || vaultToDelete.currentBalanceMinor <= 0) {
      setDeletePreviewData(null);
      return;
    }

    let isMounted = true;
    setIsFetchingDeletePreview(true);

    const fetchDeletePreview = async () => {
      try {
        const response = await axiosPrivate.get(
          `/vault/${vaultToDelete.vaultId}/withdrawal-preview`,
          {
            params: { amount: vaultToDelete.currentBalanceMinor },
          },
        );
        if (isMounted) {
          setDeletePreviewData(response.data.data);
        }
      } catch (err) {
        // Fallback to client-side calculation
        if (isMounted) {
          const penaltyBasisPoints =
            vaultToDelete.lock?.penaltyBasisPoints ?? 0;
          const penalty = Math.floor(
            (vaultToDelete.currentBalanceMinor * penaltyBasisPoints) / 10000,
          );
          setDeletePreviewData({
            amount: vaultToDelete.currentBalanceMinor,
            penalty,
            netAmount: vaultToDelete.currentBalanceMinor - penalty,
            vaultId: vaultToDelete.vaultId,
          });
        }
      } finally {
        if (isMounted) setIsFetchingDeletePreview(false);
      }
    };

    fetchDeletePreview();

    return () => {
      isMounted = false;
    };
  }, [vaultToDelete?.vaultId]);

  const executeDeletevault = async () => {
    if (!vaultToDelete) return;

    const refundedAmount =
      deletePreviewData?.netAmount ?? vaultToDelete.currentBalanceMinor;

    try {
      await vaultService.cancel(vaultToDelete.vaultId);
      await queryClient.invalidateQueries({ queryKey: queryKeys.vaults });
      await queryClient.invalidateQueries({ queryKey: ["wallets"] });
      showToast(
        "success",
        vaultToDelete.currentBalanceMinor > 0
          ? `Vault deleted. ₦${refundedAmount.toLocaleString("en-NG")} returned to wallet.`
          : "Savings vault deleted.",
      );
      setvaultToDelete(null);
    } catch (err: any) {
      showToast(
        "error",
        err.response?.data?.message || "Failed to delete vault",
      );
    }
  };

  const handleRedeemvault = (vaultId: string) => {
    const vault = activeVaults.find((v) => v.vaultId === vaultId);
    console.log(vault);
    if (vault) setCompletedvault(vault);

    showToast(
      "success",
      `Congratulations! ₦${vault?.currentBalanceMinor.toLocaleString("en-NG")} successfully redeemed to Main Checking.`,
    );
  };

  const confirmvaultCompletion = async () => {
    if (!completedvault) return;
    try {
      await vaultService.withdraw(completedvault.vaultId, {
        amount: completedvault.currentBalanceMinor,
        currency: "NGN",
      });

      // Invalidate both queries so UI updates
      await queryClient.invalidateQueries({ queryKey: queryKeys.vaults });
      await queryClient.invalidateQueries({ queryKey: ["wallets"] });

      showToast(
        "success",
        `₦${completedvault.currentBalanceMinor.toLocaleString()} transferred to Main Checking.`,
      );
    } catch (err: any) {
      showToast("error", err.response?.data?.message || "Transfer failed");
    } finally {
      setCompletedvault(null);
    }
  };

  const handleCreatevault = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newvaultTitle) {
      showToast("error", "Please enter a vault title");
      return;
    }
    if (newvaultType === "TARGET" && !newvaultTarget) {
      showToast("error", "Please enter a target amount");
      return;
    }
    if (newvaultType === "LOCKED" && !newvaultDeadline) {
      showToast("error", "Please enter a lock date");
      return;
    }

    // if (
    //   (newvaultType === "TARGET" || newvaultType === "LOCKED") &&
    //   !newvaultTarget
    // ) {
    //   showToast("error", "Please enter a target amount");
    //   return;
    // }

    setIsCreating(true);
    try {
      await vaultService.create({
        title: newvaultTitle,
        vaultType: newvaultType,
        targetAmountMinor: Number(parseCurrency(newvaultTarget)),
        lockedUntil:
          newvaultType === "LOCKED"
            ? new Date(newvaultDeadline).toISOString()
            : undefined,
        // ← penaltyBasisPoints removed entirely
      });

      await queryClient.invalidateQueries({ queryKey: queryKeys.vaults });
      setIsCreateModalOpen(false);
      setNewvaultTitle("");
      setNewvaultTarget("");
      setNewvaultDeadline("");
      setNewvaultType("FLEXIBLE");
      setNewvaultAutoSave(false);
      showToast("success", "Savings vault created!");
    } catch (err: any) {
      showToast(
        "error",
        err.response?.data?.message || "Failed to create vault",
      );
    } finally {
      setIsCreating(false);
    }
  };

  //   const handleEditClick = (vault: Vault) => {
  //     setEditingvault(vault);
  //     setEditTitle(vault.title);
  //     setEditTarget(formatCurrency(vault.targetAmount));
  //     setEditDeadline(vault.deadline);
  //     setEditAutoSave(vault.autoSave);
  //     setEditType(vault.type);
  //     setIsEditModalOpen(true);
  //   };

  //   const handleUpdatevault = (e: React.FormEvent) => {
  //     e.preventDefault();
  //     if (!editingvault) return;

  //     setIsUpdating(true);
  //     setTimeout(() => {
  //       setvaults((prev) =>
  //         prev.map((g) => {
  //           if (g.id === editingvault.id) {
  //             return {
  //               ...g,
  //               title: editTitle,
  //               targetAmount: Number(parseCurrency(editTarget)),
  //               type: editType,
  //               deadline: editType === "flexible" ? "" : editDeadline,
  //               autoSave: editAutoSave,
  //             };
  //           }
  //           return g;
  //         }),
  //       );
  //       setIsUpdating(false);
  //       setIsEditModalOpen(false);
  //       setEditingvault(null);
  //       showToast("success", "vault updated successfully");
  //     }, 1000);
  //   };

  const handleTopUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTopUpvault) return;

    const amount = Number(parseCurrency(topUpAmount));
    if (!amount || amount <= 0) {
      showToast("error", "Please enter a valid amount");
      return;
    }

    const sourceWallet = wallets?.find((w) => w.walletId === sourceAccountId);
    if (!sourceWallet) {
      showToast("error", "No source account selected");
      return;
    }
    if (sourceWallet.balance < amount) {
      showToast("error", "Insufficient funds");
      return;
    }

    setIsProcessingTopUp(true);
    try {
      await vaultService.deposit(activeTopUpvault.vaultId, {
        amount,
        currency: "NGN",
        fromType: sourceWallet.walletType as "MAIN_CHECKINGS" | "SAVINGS",
      });

      await queryClient.invalidateQueries({ queryKey: queryKeys.vaults });
      await queryClient.invalidateQueries({ queryKey: ["wallets"] });

      const newBalance = activeTopUpvault.currentBalanceMinor + amount;

      if (
        activeTopUpvault.vaultType === "TARGET" &&
        activeTopUpvault.targetAmountMinor > 0 &&
        newBalance >= activeTopUpvault.targetAmountMinor
      ) {
        // Use calculated newBalance instead of stale object
        setCompletedvault({
          ...activeTopUpvault,
          currentBalanceMinor: newBalance, // ← use fresh balance
          status: "COMPLETED",
        });
        confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
      } else {
        showToast(
          "success",
          `Added ₦${amount.toLocaleString()} to ${activeTopUpvault.title}`,
        );
      }

      setActiveTopUpvault(null);
      setTopUpAmount("");
    } catch (err: any) {
      showToast("error", err.response?.data?.message || "Top up failed");
    } finally {
      setIsProcessingTopUp(false);
    }
  };

  const handleWithdraw = async (vault: Vault) => {
    if (vault.currentBalanceMinor <= 0) {
      showToast("error", "No funds to withdraw");
      return;
    }
    try {
      await vaultService.withdraw(vault.vaultId, {
        amount: Number(parseCurrency(withdrawAmount)),
        currency: "NGN",
      });
      await queryClient.invalidateQueries({ queryKey: queryKeys.vaults });
      await queryClient.invalidateQueries({ queryKey: ["wallets"] });
      showToast(
        "success",
        `₦${(vault.currentBalanceMinor / 100).toLocaleString()} withdrawn to Main Checking`,
      );
    } catch (err: any) {
      showToast("error", err.response?.data?.message || "Withdrawal failed");
    }
  };

  return (
    <div className="w-full max-w-[1920px] mx-auto space-y-8 animate-in fade-in slide-in-from-right-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Savings vaults</h2>
        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="bg-primary hover:bg-primary-light text-white px-4 py-2 rounded-xl font-bold text-sm flex items-center gap-2 transition-colors shadow-lg shadow-primary/25"
        >
          <Plus className="w-4 h-4" /> New vault
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {activeVaults?.map((vault) => {
          const progress =
            vault.targetAmountMinor > 0
              ? Math.min(
                  (vault.currentBalanceMinor / vault.targetAmountMinor) * 100,
                  100,
                )
              : 0;

          const isCompleted =
            vault.currentBalanceMinor >= vault.targetAmountMinor &&
            vault.targetAmountMinor > 0;

          return (
            <div
              key={vault.vaultId}
              className={`bg-white dark:bg-slate-900 rounded-[2rem] p-6 border transition-all duration-300 relative overflow-hidden group hover:shadow-lg ${isCompleted ? "border-green-500/50 shadow-green-500/10" : "border-slate-100 dark:border-slate-800 shadow-sm"}`}
            >
              <div className="flex justify-between items-start mb-4">
                <div
                  className={`p-3 rounded-2xl ${
                    isCompleted
                      ? "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400"
                      : vault.vaultType === "LOCKED"
                        ? "bg-purple-100 text-purple-600 dark:bg-purple-900/30"
                        : vault.vaultType === "TARGET"
                          ? "bg-blue-100 text-blue-600 dark:bg-blue-900/30"
                          : "bg-green-50 text-green-500 dark:bg-green-900/20"
                  }`}
                >
                  {isCompleted ? (
                    <CheckCircle2 className="w-6 h-6" />
                  ) : vault.vaultType === "LOCKED" ? (
                    <Lock className="w-6 h-6" />
                  ) : vault.vaultType === "TARGET" ? (
                    <Target className="w-6 h-6" />
                  ) : (
                    <PiggyBank className="w-6 h-6" />
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    //onClick={() => handleEditClick(vault)}
                    className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-400 hover:text-primary"
                    title="Edit vault"
                  >
                    <Pencil className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => setvaultToDelete(vault)} // ← set the vault to delete
                    className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-500 rounded-full transition-colors text-slate-400"
                    title="Delete vault"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
                {vault.title}
              </h3>

              <div className="mb-4">
                {vault.vaultType === "FLEXIBLE" && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                    <Unlock className="w-3.5 h-3.5" /> Flexible (withdraw
                    anytime)
                  </span>
                )}
                {vault.vaultType === "TARGET" && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                    <Target className="w-3.5 h-3.5" /> Target (3% early penalty)
                  </span>
                )}
                {vault.vaultType === "LOCKED" && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
                    <Lock className="w-3.5 h-3.5" /> Locked Plan (5% break fee)
                  </span>
                )}
              </div>

              <p className="text-xs text-slate-500 font-bold mb-4">
                {vault.vaultType === "LOCKED"
                  ? `Unlocks: ${vault.lockedUntil ? new Date(vault.lockedUntil).toLocaleDateString() : "N/A"}`
                  : vault.vaultType === "TARGET"
                    ? `Target: ₦${vault.targetAmountMinor.toLocaleString("en-NG")}`
                    : "No target set"}
              </p>

              <div className="flex items-end gap-1 mb-2">
                <span
                  className={`text-3xl font-black ${isCompleted ? "text-green-600 dark:text-green-400" : "text-slate-900 dark:text-white"}`}
                >
                  ₦{vault.currentBalanceMinor.toLocaleString("en-NG")}
                </span>
                <span className="text-xs font-bold text-slate-400 mb-1.5">
                  saved
                </span>
              </div>

              <div className="w-full h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden mb-4">
                <div
                  className={`h-full rounded-full transition-all duration-1000 ease-out ${progress >= 100 ? "bg-green-500" : "bg-primary"}`}
                  style={{ width: `${progress}%` }}
                ></div>
              </div>

              <div className="flex items-center gap-4 text-xs font-bold text-slate-500">
                {vault.autoSave && !isCompleted && (
                  <div className="flex items-center gap-1 text-green-600 dark:text-green-400">
                    <CalendarClock className="w-3.5 h-3.5" /> Auto-save on
                  </div>
                )}
                {vault.vaultType !== "FLEXIBLE" && vault.lockedUntil ? (
                  <div className="flex items-center gap-1">
                    <CalendarClock className="w-3.5 h-3.5" />{" "}
                    {new Date(vault.lockedUntil).toLocaleDateString()}
                  </div>
                ) : (
                  <div className="flex items-center gap-1 text-slate-400">
                    <Unlock className="w-3.5 h-3.5" /> No deadline limit
                  </div>
                )}
              </div>

              <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 flex gap-2">
                {isCompleted ? (
                  <button
                    onClick={() => handleRedeemvault(vault.vaultId)}
                    className="w-full py-3 text-sm font-bold bg-green-500 text-white hover:bg-green-600 rounded-xl transition-colors shadow-lg shadow-green-500/25 flex items-center justify-center gap-2"
                  >
                    <ArrowDownLeft className="w-4 h-4" /> Redeem to Wallet
                  </button>
                ) : (
                  <>
                    <button
                      onClick={() => {
                        if (vault.currentBalanceMinor <= 0) {
                          showToast("info", "No funds available to withdraw");
                        } else {
                          setActiveWithdrawvault(vault);
                          setWithdrawAmount("");
                        }
                      }}
                      disabled={vault.currentBalanceMinor <= 0}
                      className="flex-1 py-2 text-xs font-bold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors text-slate-700 dark:text-slate-300"
                    >
                      Withdraw
                    </button>
                    <button
                      onClick={() => setActiveTopUpvault(vault)}
                      className="flex-1 py-2 text-xs font-bold bg-primary/10 text-primary hover:bg-primary/20 rounded-lg transition-colors"
                    >
                      Top Up
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* --- Delete Confirmation Modal --- */}
      {vaultToDelete && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-[2rem] p-8 shadow-2xl border border-slate-100 dark:border-slate-800 text-center relative overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="w-20 h-20 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-red-500/10">
              <AlertTriangle className="w-10 h-10 text-red-500" />
            </div>

            <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-2">
              Delete Vault?
            </h3>

            <p className="text-slate-500 dark:text-slate-400 mb-6 font-medium">
              Are you sure you want to delete{" "}
              <strong>{vaultToDelete.title}</strong>?
            </p>

            {vaultToDelete.currentBalanceMinor > 0 && (
              <div className="bg-yellow-50 dark:bg-yellow-950/20 p-4 rounded-xl mb-6 border border-yellow-200 dark:border-yellow-900/35 text-left">
                <p className="text-sm font-bold text-yellow-700 dark:text-yellow-550 flex items-center gap-2">
                  <Wallet className="w-4 h-4" />
                  Funds will be returned
                </p>

                {isFetchingDeletePreview ? (
                  <div className="flex justify-center py-3">
                    <Loader2 className="w-4 h-4 animate-spin text-yellow-500" />
                  </div>
                ) : (
                  <div className="text-xs text-yellow-600 dark:text-yellow-400 mt-2 space-y-1">
                    <p className="flex justify-between">
                      <span>Current Savings:</span>
                      <span className="font-bold">
                        ₦
                        {vaultToDelete.currentBalanceMinor.toLocaleString(
                          "en-NG",
                        )}
                      </span>
                    </p>

                    {(deletePreviewData?.penalty ?? 0) > 0 && (
                      <p className="flex justify-between text-red-500 dark:text-red-400 font-medium">
                        <span>
                          Early Closure Fee (
                          {vaultToDelete.lock?.penaltyBasisPoints
                            ? `${(vaultToDelete.lock.penaltyBasisPoints / 100).toLocaleString()}%`
                            : "0%"}
                          ):
                        </span>
                        <span>
                          -₦
                          {(deletePreviewData?.penalty ?? 0).toLocaleString(
                            "en-NG",
                          )}
                        </span>
                      </p>
                    )}

                    <p className="flex justify-between border-t border-yellow-200 dark:border-yellow-800/50 pt-1 font-black text-slate-900 dark:text-yellow-300">
                      <span>Net Refund:</span>
                      <span>
                        ₦
                        {(
                          deletePreviewData?.netAmount ??
                          vaultToDelete.currentBalanceMinor
                        ).toLocaleString("en-NG")}
                      </span>
                    </p>
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setvaultToDelete(null)}
                className="flex-1 py-3.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              >
                Cancel
              </button>

              <button
                onClick={executeDeletevault}
                className="flex-1 py-3.5 bg-red-500 text-white font-bold rounded-xl hover:bg-red-600 transition-all shadow-lg shadow-red-500/25"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- vault Completion Modal --- */}
      {completedvault && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-[2rem] p-8 shadow-2xl border border-slate-100 dark:border-slate-800 text-center relative overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-green-400 to-emerald-500"></div>
            <div className="w-20 h-20 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-green-500/10">
              <PartyPopper className="w-10 h-10 text-green-500 animate-bounce" />
            </div>
            <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-2">
              vault Reached!
            </h3>
            <p className="text-slate-500 dark:text-slate-400 mb-6 font-medium">
              You've hit your target for <strong>{completedvault.title}</strong>
              !
            </p>

            <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl mb-6 flex items-center justify-between border border-slate-100 dark:border-slate-800">
              <div className="text-left">
                <span className="text-xs text-slate-400 uppercase font-bold">
                  Total Saved
                </span>
                <p className="text-xl font-black text-slate-900 dark:text-white">
                  ₦{completedvault.currentBalanceMinor.toLocaleString()}
                </p>
              </div>
              <ArrowRight className="text-slate-300" />
              <div className="text-right">
                <span className="text-xs text-slate-400 uppercase font-bold">
                  Transfer To
                </span>
                <p className="text-sm font-bold text-slate-900 dark:text-white flex items-center justify-end gap-1">
                  <Wallet className="w-3 h-3" /> Main Checking
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-400 mb-6">
              Proceeding will move funds to your main wallet and remove this
              savings vault.
            </p>

            <button
              onClick={confirmvaultCompletion}
              className="w-full py-3.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold rounded-xl hover:opacity-90 transition-all shadow-lg hover:shadow-xl transform active:scale-[0.98]"
            >
              Confirm & Transfer Funds
            </button>
          </div>
        </div>
      )}

      {/* --- Create vault Modal --- */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl p-6 shadow-2xl border border-slate-100 dark:border-slate-800 animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold">Create New vault</h3>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreatevault} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">
                  vault Title
                </label>
                <input
                  type="text"
                  value={newvaultTitle}
                  onChange={(e) => setNewvaultTitle(e.target.value)}
                  placeholder="e.g., New Laptop"
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-primary font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">
                  Target Amount
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-slate-400">
                    ₦
                  </span>
                  <input
                    type="text"
                    value={newvaultTarget}
                    onChange={(e) =>
                      setNewvaultTarget(
                        formatCurrency(parseCurrency(e.target.value)),
                      )
                    }
                    placeholder="0.00"
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-10 pr-4 py-3 outline-none focus:ring-2 focus:ring-primary font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">
                  vault Plan Type
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(["FLEXIBLE", "TARGET", "LOCKED"] as const).map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setNewvaultType(type)}
                      className={`py-3 px-1 border rounded-xl flex flex-col items-center justify-center gap-1.5 transition-all outline-none ${
                        newvaultType === type
                          ? "border-primary bg-primary/5 text-primary font-black scale-102 shadow-sm"
                          : "border-slate-200 dark:border-slate-700 bg-transparent text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
                      }`}
                    >
                      {type === "FLEXIBLE" && <Unlock className="w-4 h-4" />}
                      {type === "TARGET" && <Target className="w-4 h-4" />}
                      {type === "LOCKED" && <Lock className="w-4 h-4" />}
                      <span className="text-[10px] font-black capitalize">
                        {type}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {newvaultType === "LOCKED" && (
                <div className="animate-in fade-in slide-in-from-top-2 duration-200">
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2">
                    Lock Until Date
                  </label>
                  <CustomDatePicker
                    value={newvaultDeadline}
                    onChange={(value) => setNewvaultDeadline(value)}
                  />
                </div>
              )}

              <div
                className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 cursor-pointer"
                onClick={() => setNewvaultAutoSave(!newvaultAutoSave)}
              >
                <div
                  className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${newvaultAutoSave ? "bg-primary border-primary" : "border-slate-400"}`}
                >
                  {newvaultAutoSave && (
                    <Check className="w-3.5 h-3.5 text-white" />
                  )}
                </div>
                <div className="text-left">
                  <p className="text-sm font-bold">Enable Auto-Save</p>
                  <p className="text-xs text-slate-500">
                    Automatically transfer monthly micro-deposits
                  </p>
                </div>
              </div>

              {newvaultTarget && (
                <div className="bg-slate-50 dark:bg-slate-800/10 p-4 rounded-xl border border-slate-200 dark:border-slate-700 mt-4 animate-in fade-in slide-in-from-top-1 text-left">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                    Plan Summary
                  </h4>
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed mb-3">
                    You are creating a{" "}
                    <span className="font-black text-slate-950 dark:text-white capitalize">
                      {newvaultType}
                    </span>{" "}
                    savings vaults of{" "}
                    <span className="font-black text-slate-900 dark:text-white">
                      ₦{newvaultTarget}
                    </span>
                    {newvaultType !== "FLEXIBLE" && newvaultDeadline && (
                      <>
                        {" "}
                        by{" "}
                        <span className="font-black text-slate-900 dark:text-white">
                          {new Date(newvaultDeadline).toLocaleDateString(
                            undefined,
                            { dateStyle: "medium" },
                          )}
                        </span>
                      </>
                    )}
                    .
                  </p>
                  {newvaultType === "FLEXIBLE" && (
                    <div className="flex items-start gap-2 text-[11px] text-green-700 dark:text-green-400 bg-green-500/10 p-2.5 rounded-lg border border-green-500/20">
                      <Unlock className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                      <span>
                        <strong>Flexible Savings:</strong> Deposit & withdraw
                        anytime. Zero constraints, early penalties, or lock
                        dates.
                      </span>
                    </div>
                  )}
                  {newvaultType === "TARGET" && (
                    <div className="flex items-start gap-2 text-[11px] text-blue-700 dark:text-blue-400 bg-blue-500/10 p-2.5 rounded-lg border border-blue-500/20">
                      <Target className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                      <span>
                        <strong>Target Savings:</strong> Dedicated endpoint
                        target. Early withdrawal or pre-deadline closure carries
                        a 2.5% service penalty.
                      </span>
                    </div>
                  )}
                  {newvaultType === "LOCKED" && (
                    <div className="flex items-start gap-2 text-[11px] text-purple-700 dark:text-purple-400 bg-purple-500/10 p-2.5 rounded-lg border border-purple-500/20">
                      <Lock className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                      <span>
                        <strong>Locked Savings:</strong> Vaulted locks. Early
                        partial closure or full break lock carries a flat 5%
                        vault release fee.
                      </span>
                    </div>
                  )}
                </div>
              )}

              <button
                type="submit"
                disabled={isCreating}
                className="w-full py-3.5 bg-primary text-white font-bold rounded-xl hover:bg-primary-light transition-all flex items-center justify-center gap-2 mt-4"
              >
                {isCreating ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  "Create vault"
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* --- Edit vault Modal --- */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl p-6 shadow-2xl border border-slate-100 dark:border-slate-800 animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold">Edit Savings vault</h3>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* <form onSubmit={handleUpdatevault} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">
                  vault Title
                </label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-primary font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">
                  Target Amount
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-slate-400">
                    ₦
                  </span>
                  <input
                    type="text"
                    value={editTarget}
                    onChange={(e) =>
                      setEditTarget(
                        formatCurrency(parseCurrency(e.target.value)),
                      )
                    }
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-10 pr-4 py-3 outline-none focus:ring-2 focus:ring-primary font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">
                  vault Plan Type
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(["flexible", "target", "locked"] as const).map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setEditType(type)}
                      className={`py-3 px-1 border rounded-xl flex flex-col items-center justify-center gap-1.5 transition-all outline-none ${
                        editType === type
                          ? "border-primary bg-primary/5 text-primary font-black scale-102 shadow-sm"
                          : "border-slate-200 dark:border-slate-700 bg-transparent text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
                      }`}
                    >
                      {type === "flexible" && <Unlock className="w-4 h-4" />}
                      {type === "target" && <Target className="w-4 h-4" />}
                      {type === "locked" && <Lock className="w-4 h-4" />}
                      <span className="text-[10px] font-black capitalize">
                        {type}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {editType !== "flexible" && (
                <div className="animate-in fade-in slide-in-from-top-2 duration-200">
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2">
                    Target Deadline
                  </label>
                  <CustomDatePicker
                    value={editDeadline}
                    onChange={(value) => setEditDeadline(value)}
                  />
                </div>
              )}

              <div
                className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 cursor-pointer"
                onClick={() => setEditAutoSave(!editAutoSave)}
              >
                <div
                  className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${editAutoSave ? "bg-primary border-primary" : "border-slate-400"}`}
                >
                  {editAutoSave && <Check className="w-3.5 h-3.5 text-white" />}
                </div>
                <div className="text-left">
                  <p className="text-sm font-bold">Enable Auto-Save</p>
                  <p className="text-xs text-slate-500">
                    Automatically transfer monthly micro-deposits
                  </p>
                </div>
              </div>

              <button
                type="submit"
                disabled={isUpdating}
                className="w-full py-3.5 bg-primary text-white font-bold rounded-xl hover:bg-primary-light transition-all flex items-center justify-center gap-2 mt-4"
              >
                {isUpdating ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  "Save Changes"
                )}
              </button>
            </form> */}
          </div>
        </div>
      )}

      {/* --- Top Up Modal --- */}
      {activeTopUpvault && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl p-6 shadow-2xl border border-slate-100 dark:border-slate-800 animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-xl font-bold">Top Up vault</h3>
                <p className="text-xs text-slate-500 font-medium">
                  Adding funds to:{" "}
                  <span className="text-primary">{activeTopUpvault.title}</span>
                </p>
              </div>
              <button
                onClick={() => setActiveTopUpvault(null)}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleTopUp} className="space-y-4">
              <div>
                <AccountSelect
                  label="From Account"
                  accounts={sourceAccounts.filter((a) => a.type === "current")}
                  selectedId={sourceAccountId}
                  onChange={setSourceAccountId}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">
                  Amount to Add
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-slate-400">
                    ₦
                  </span>
                  <input
                    type="text"
                    value={topUpAmount}
                    onChange={(e) =>
                      setTopUpAmount(
                        formatCurrency(parseCurrency(e.target.value)),
                      )
                    }
                    placeholder="0.00"
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-10 pr-4 py-3 outline-none focus:ring-2 focus:ring-primary font-bold text-lg"
                    autoFocus
                  />
                </div>
                <div className="mt-2 flex justify-between text-xs font-bold text-slate-400">
                  <span>Remaining to target:</span>
                  <span>
                    ₦
                    {Math.max(
                      0,
                      activeTopUpvault.targetAmountMinor -
                        activeTopUpvault.currentBalanceMinor,
                    ).toLocaleString()}
                  </span>
                </div>
              </div>

              <button
                type="submit"
                disabled={isProcessingTopUp || !topUpAmount}
                className="w-full py-3.5 bg-primary text-white font-bold rounded-xl hover:bg-primary-light transition-all flex items-center justify-center gap-2 mt-4 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isProcessingTopUp ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  "Confirm Top Up"
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* --- Withdraw Modal --- */}
      {activeWithdrawvault &&
        (() => {
          const amountNum = Number(parseCurrency(withdrawAmount)) || 0;
          let previewPenalty = 0;

          if (
            withdrawalPreviewData &&
            withdrawalPreviewData.vaultId === activeWithdrawvault.vaultId
          ) {
            // Use backend preview — always preferred
            previewPenalty = withdrawalPreviewData.penalty;
          } else {
            // Fallback — use actual rate from vault object
            const penaltyBasisPoints =
              activeWithdrawvault.lock?.penaltyBasisPoints ?? 0;
            previewPenalty = Math.floor(
              (amountNum * penaltyBasisPoints) / 10000,
            );
          }

          const previewNet = Math.max(0, amountNum - previewPenalty);

          return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
              <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl p-6 shadow-2xl border border-slate-100 dark:border-slate-800 animate-in zoom-in-95 duration-200">
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <h3 className="text-xl font-bold">Withdraw Funds</h3>
                    <p className="text-xs text-slate-500 font-medium block">
                      Withdrawing from savings vault:{" "}
                      <span className="text-primary">
                        {activeWithdrawvault.title}
                      </span>
                    </p>
                  </div>
                  <button
                    onClick={() => setActiveWithdrawvault(null)}
                    className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (!activeWithdrawvault) return;
                    setIsProcessingWithdraw(true);
                    try {
                      await vaultService.withdraw(activeWithdrawvault.vaultId, {
                        amount: Number(parseCurrency(withdrawAmount)),
                        currency: "NGN",
                      });
                      await queryClient.invalidateQueries({
                        queryKey: queryKeys.vaults,
                      });
                      await queryClient.invalidateQueries({
                        queryKey: ["wallets"],
                      });
                      showToast(
                        "success",
                        `₦${Number(parseCurrency(withdrawAmount)).toLocaleString()} withdrawn successfully`,
                      );
                      setActiveWithdrawvault(null);
                      setWithdrawAmount("");
                    } catch (err: any) {
                      showToast(
                        "error",
                        err.response?.data?.message || "Withdrawal failed",
                      );
                    } finally {
                      setIsProcessingWithdraw(false);
                    }
                  }}
                  className="space-y-4"
                >
                  <div>
                    <AccountSelect
                      label="Transfer Destination"
                      accounts={accounts}
                      selectedId={targetAccountId}
                      onChange={setTargetAccountId}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">
                      Amount to Withdraw
                    </label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-slate-400">
                        ₦
                      </span>
                      <input
                        type="text"
                        value={withdrawAmount}
                        onChange={(e) =>
                          setWithdrawAmount(
                            formatCurrency(parseCurrency(e.target.value)),
                          )
                        }
                        placeholder="0.00"
                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-10 pr-4 py-3 outline-none focus:ring-2 focus:ring-primary font-bold text-lg"
                        autoFocus
                      />
                    </div>
                    <div className="mt-2 flex justify-between text-xs font-bold text-slate-400">
                      <span>Total Saved Balance:</span>
                      <span className="text-slate-800 dark:text-slate-200">
                        ₦
                        {activeWithdrawvault.currentBalanceMinor.toLocaleString(
                          "en-NG",
                        )}
                      </span>
                    </div>
                  </div>

                  {amountNum > 0 && (
                    <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2 text-xs">
                      <p className="flex justify-between font-medium">
                        <span>Requested amount:</span>
                        <span className="font-bold text-slate-800 dark:text-slate-200">
                          ₦{amountNum.toLocaleString("en-NG")}
                        </span>
                      </p>
                      {previewPenalty > 0 && (
                        <p className="flex justify-between font-bold text-red-500">
                          <span>
                            Break Fee (
                            {(
                              (activeWithdrawvault.lock?.penaltyBasisPoints ??
                                0) / 100
                            ).toFixed(1)}
                            % ):
                          </span>
                          <span>
                            -₦{previewPenalty.toLocaleString("en-NG")}
                          </span>
                        </p>
                      )}
                      <p className="flex justify-between border-t border-slate-200 dark:border-slate-700 pt-2 font-black text-slate-900 dark:text-white text-sm">
                        <span>Net Credit to Destination:</span>
                        <span className="text-emerald-500">
                          ₦{previewNet.toLocaleString("en-NG")}
                        </span>
                      </p>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={
                      isProcessingWithdraw ||
                      amountNum <= 0 ||
                      amountNum > activeWithdrawvault.currentBalanceMinor
                    }
                    className="w-full py-3.5 bg-primary text-white font-bold rounded-xl hover:bg-primary-light transition-all flex items-center justify-center gap-2 mt-4 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isProcessingWithdraw ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      "Confirm Withdrawal"
                    )}
                  </button>
                </form>
              </div>
            </div>
          );
        })()}
    </div>
  );
};

export default SavingsScreen;
