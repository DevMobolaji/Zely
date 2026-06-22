import axiosPrivate from "@/api/client";
import { useAuth } from "@/auth/AuthProvider";
import { useDashboardData } from "@/context/DashboardDataContext";
import {
  generateIdempotencyKey,
  transactionService,
} from "@/services/transactionService";
import {
  AlertCircle,
  ArrowLeftRight,
  Check,
  CheckCircle2,
  ChevronDown,
  CreditCard,
  Download,
  Landmark,
  Loader2,
  RefreshCw,
  Users,
  Wallet,
} from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { useToast } from "../../context/ToastContext";
import { Account } from "../../utils/types";

const MAX_TRANSFER_LIMIT = 1000000;
const SUGGESTED_AMOUNTS = [1000, 5000, 10000, 20000, 50000];

// Helper to format currency with commas for display
const formatCurrency = (value: string | number) => {
  if (value === undefined || value === null || value === "") return "";
  const cleanVal = String(value).replace(/[^0-9.]/g, "");
  if (!cleanVal) return "";

  const parts = cleanVal.split(".");
  // Add commas to the integer part
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");

  // Return formatted string, keeping the decimal if it exists
  return parts.join(".");
};

// Helper to get raw numeric string for internal storage/logic
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

const TransfersScreen: React.FC = () => {
  const location = useLocation();
  const { showToast } = useToast();
  const { auth } = useAuth();
  const isFunding = location.pathname.includes("fund-wallet");
  // Tab State for Transfers (Internal vs P2P)
  const [transferType, setTransferType] = useState<"internal" | "p2p">(
    "internal",
  );
  const [fee, setFee] = useState<number | null>(null);
  const [totalDeducted, setTotalDeducted] = useState<number | null>(null);
  const [recipientName, setRecipientName] = useState<string | null>(null);
  const [lookingUpRecipient, setLookingUpRecipient] = useState(false);
  const [amount, setAmount] = useState(""); // Stores raw numeric string (no commas)
  const [displayAmount, setDisplayAmount] = useState(""); // Stores formatted string with commas
  const [transferStatus, setTransferStatus] = useState<
    "idle" | "confirm" | "processing" | "success"
  >("idle");
  const [amountError, setAmountError] = useState<string | null>(null);
  const [lastTransaction, setLastTransaction] = useState<{
    amount: string;
    recipient: string;
  } | null>(null);
  const [p2pRecipient, setP2pRecipient] = useState("");

  // Funding State
  const [fundingMethod, setFundingMethod] = useState<"bank" | "card">("bank");
  const [fundStatus, setFundStatus] = useState<
    "idle" | "processing" | "success"
  >("idle");
  const [fundingAmount, setFundingAmount] = useState("");
  // Transfer State
  const [sourceId, setSourceId] = useState("");
  const [destId, setDestId] = useState("");
  const [lookupAttempted, setLookupAttempted] = useState(false);

  const { wallets, refreshWallets, refreshTransactions } = useDashboardData();

  useEffect(() => {
    if (!wallets) return;
    const checking = wallets.find(
      (w: { walletType: string }) => w.walletType === "MAIN_CHECKINGS",
    );

    const savings = wallets.find(
      (w: { walletType: string }) => w.walletType === "SAVINGS",
    );

    if (checking && !sourceId) setSourceId(checking.walletId);
    if (savings && !destId) setDestId(savings.walletId);
  }, [wallets]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const recipient = params.get("recipient");
    const type = params.get("type");
    const status = params.get("status");
    const trxref = params.get("trxref");

    if (trxref && isFunding) {
      setFundStatus("success");
      showToast(
        "success",
        "Payment received. Wallet will be credited shortly.",
      );
      refreshWallets();
      refreshTransactions();
    }

    if (type === "p2p") {
      setTransferType("p2p");
      if (recipient) setP2pRecipient(decodeURIComponent(recipient));
    }

    if (status === "success" && isFunding) {
      setFundStatus("success");
      showToast(
        "success",
        "Payment received. Wallet will be credited shortly.",
      );
      refreshWallets();
      refreshTransactions();
    }
  }, [location.search]);

  useEffect(() => {
    if (!amount || Number(amount) <= 0) {
      setFee(null);
      setTotalDeducted(null);
      return;
    }

    // No fee for internal transfers
    if (transferType === "internal") {
      setFee(0);
      setTotalDeducted(Number(amount));
      return;
    }

    const fetchFee = async () => {
      try {
        const response = await axiosPrivate.get("/transfer/fee", {
          params: { amount: Number(amount), currency: "NGN" },
        });
        setFee(response.data.data.fee);
        setTotalDeducted(response.data.data.totalDeducted);
      } catch {
        setFee(null);
        setTotalDeducted(null);
      }
    };

    const debounce = setTimeout(fetchFee, 500);
    return () => clearTimeout(debounce);
  }, [amount, transferType]);

  useEffect(() => {
    if (transferType !== "p2p" || !p2pRecipient || p2pRecipient.length < 10) {
      setRecipientName(null);
      setLookingUpRecipient(false);
      setLookupAttempted(false);
      return;
    }

    setLookingUpRecipient(true);
    setRecipientName(null);
    setLookupAttempted(false);

    const lookup = async () => {
      try {
        const response = await axiosPrivate.get("/transfer/lookup", {
          params: { accountNumber: p2pRecipient },
        });
        setRecipientName(response.data.data.name);
      } catch {
        setRecipientName(null);
      } finally {
        setLookingUpRecipient(false);
        setLookupAttempted(true);
      }
    };

    const debounce = setTimeout(lookup, 500);
    return () => {
      clearTimeout(debounce);
      setLookingUpRecipient(false);
    };
  }, [p2pRecipient, transferType]);

  // Handle Query Params for Quick Transfer
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const recipient = params.get("recipient");
    const type = params.get("type");

    if (type === "p2p") {
      setTransferType("p2p");
      if (recipient) {
        setP2pRecipient(decodeURIComponent(recipient));
      }
    }
  }, [location.search]);

  // Handle auto directory lookup when P2P recipient changes

  const getSourceAccounts = (): Account[] =>
    (wallets ?? []).map(
      (w: {
        walletId: any;
        walletType: string;
        balance: any;
        accountNumber: any;
        limit?: any;
      }) => ({
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
        limit: w.limit,
      }),
    );

  const getDestAccounts = (): Account[] =>
    (wallets ?? [])
      .filter((w: { walletId: string }) => w.walletId !== sourceId) // exclude currently selected source
      .map(
        (w: {
          walletId: any;
          walletType: string;
          balance: any;
          accountNumber: any;
          limit: number;
        }) => ({
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
          limit: w.limit,
        }),
      );

  const handleTypeChange = (type: "internal" | "p2p") => {
    setTransferType(type);
    setTransferStatus("idle");
    setAmountError(null);

    const validSources = getSourceAccounts();
    setSourceId(validSources.length > 0 ? validSources[0].id : "");

    if (type === "internal") {
      const validDests = getDestAccounts();
      setDestId(validDests.length > 0 ? validDests[0].id : "");
    } else {
      setP2pRecipient("");
    }
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    const rawValue = parseCurrency(val);

    // Basic number validation
    if (rawValue && isNaN(Number(rawValue))) return;

    setAmount(rawValue);
    setDisplayAmount(formatCurrency(rawValue));

    if (Number(rawValue) > MAX_TRANSFER_LIMIT) {
      setAmountError(
        `Transfer limit exceeded (₦${MAX_TRANSFER_LIMIT.toLocaleString()})`,
      );
    } else {
      setAmountError(null);
    }
  };

  const setQuickAmount = (val: number) => {
    const rawValue = val.toString();
    setAmount(rawValue);
    setDisplayAmount(formatCurrency(rawValue));
    setAmountError(null);
  };

  const handleTransfer = () => {
    const numericAmount = Number(amount);
    if (!amount || numericAmount <= 0) {
      showToast("error", "Please enter a valid amount");
      return;
    }
    if (numericAmount > MAX_TRANSFER_LIMIT) {
      showToast(
        "error",
        `Amount cannot exceed ₦${MAX_TRANSFER_LIMIT.toLocaleString()}`,
      );
      return;
    }
    if (transferType === "internal" && !destId) {
      showToast("error", "Please select a destination savings account");
      return;
    }
    if (transferType === "internal" && sourceId === destId) {
      showToast("error", "Source and destination accounts cannot be the same");
      return;
    }
    if (transferType === "p2p" && !p2pRecipient) {
      showToast("error", "Recipient is required");
      return;
    }
    setTransferStatus("confirm");
  };

  const confirmTransfer = async () => {
    setTransferStatus("processing");

    try {
      if (transferType === "internal") {
        // Internal transfer — no fee, different endpoint
        const sourceWallet = wallets?.find(
          (w: { walletId: string }) => w.walletId === sourceId,
        );
        const destWallet = wallets?.find(
          (w: { walletId: string }) => w.walletId === destId,
        );

        if (!sourceWallet || !destWallet) {
          showToast("error", "Invalid wallet selection");
          setTransferStatus("idle");
          return;
        }

        await axiosPrivate.post(
          "/transfer/internal",
          {
            amount: Number(amount),
            currency: "NGN",
            fromType: sourceWallet.walletType,
            toType: destWallet.walletType,
          },
          {
            headers: {
              "X-Idempotency-Key": generateIdempotencyKey(),
            },
          },
        );
      } else {
        // P2P transfer
        await transactionService.transfer({
          amount: Number(amount),
          accountId: sourceId,
          type: "p2p",
          recipientAccountNumber: p2pRecipient,
        });
      }

      // Refresh wallets after either transfer type
      refreshWallets();
      refreshTransactions();

      const finalRecipient =
        transferType === "internal"
          ? getAccount(destId)?.name || "Savings"
          : (recipientName ?? p2pRecipient);

      setLastTransaction({ amount, recipient: finalRecipient });
      setTransferStatus("success");
      showToast("success", "Transfer completed successfully");
      setAmount("");
      setDisplayAmount("");
      setP2pRecipient("");
      setRecipientName(null);
      setFee(null);
      setTotalDeducted(null);
    } catch (error: any) {
      const msg =
        error.response?.data?.message || "Transfer failed. Please try again.";
      showToast("error", msg);
      setTransferStatus("idle");
    }
  };

  const handleFunding = async () => {
    if (!fundingAmount || Number(fundingAmount) <= 0) {
      showToast("error", "Please enter a valid amount to fund");
      return;
    }

    if (Number(fundingAmount) < 100) {
      showToast("error", "Minimum funding amount is ₦100");
      return;
    }

    // Get main checking wallet
    const mainWallet = wallets?.find(
      (w: { walletType: string }) => w.walletType === "MAIN_CHECKINGS",
    );

    if (!mainWallet) {
      showToast("error", "No wallet found");
      return;
    }

    setFundStatus("processing");

    try {
      const response = await axiosPrivate.post("payments/initialize", {
        amount: Number(fundingAmount),
        currency: "NGN",
        purpose: "USER_WALLET_FUNDING",
        targetWalletId: mainWallet.walletId,
        clientIdempotencyKey: `fund_${mainWallet.walletId}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      });

      const { reference, authorizationUrl, alreadyExists } = response.data.data;

      const key = `fund_${mainWallet.walletId}_${crypto.randomUUID()}`;
      const publicKey = import.meta.env.VITE_PAYSTACK_PUBLIC_KEY;

      if (alreadyExists) {
        // Transaction already initialized with Paystack — open existing checkout
        window.open(authorizationUrl, "_blank");
        setFundStatus("idle");
        return;
      }

      console.log("reference being sent to Paystack", reference);
      console.log("alreadyExists", alreadyExists);

      window.open(authorizationUrl, "_blank");

      setFundStatus("idle");
      showToast(
        "success",
        "Complete your payment in the new tab. Your wallet will be credited automatically.",
      );
      setFundingAmount("");
    } catch (error: any) {
      const msg =
        error.response?.data?.message ||
        "Unable to initialize payment. Please try again.";
      showToast("error", msg);
      setFundStatus("idle");
    }
  };

  const resetTransfer = () => {
    setTransferStatus("idle");
    setAmount("");
    setDisplayAmount("");
    setP2pRecipient("");
    setAmountError(null);
    setLastTransaction(null);
  };

  const getAccount = (id: string) =>
    [...getSourceAccounts(), ...getDestAccounts()].find((a) => a.id === id);

  if (isFunding) {
    return (
      <div className="w-full max-w-2xl mx-auto space-y-6 animate-in fade-in slide-in-from-right-4">
        <div className="bg-white dark:bg-slate-900 rounded-[2rem] p-8 border border-slate-200 dark:border-slate-800 shadow-xl">
          <div className="flex items-center gap-3 mb-8">
            <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-xl text-blue-600">
              <Download className="w-6 h-6" />
            </div>
            <h2 className="text-2xl font-black">Fund Wallet</h2>
          </div>

          {fundStatus === "success" ? (
            <div className="text-center py-10 animate-in zoom-in duration-300">
              <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto text-green-500 mb-6">
                MAX_TRMAX_TRANSFER_LIMITANSFER_LIMITMAX_TRANSFER_LIMIT
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <h3 className="text-2xl font-black mb-2">Funding Successful!</h3>
              <p className="text-slate-500 mb-8">
                Your wallet has been credited.
              </p>
              <button
                onClick={() => setFundStatus("idle")}
                className="px-8 py-3 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold rounded-xl"
              >
                Fund Again
              </button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4 mb-8">
                <button
                  onClick={() => setFundingMethod("bank")}
                  className={`p-4 rounded-xl border-2 flex flex-col items-center gap-3 transition-all ${fundingMethod === "bank" ? "border-primary bg-primary/5 text-primary" : "border-slate-100 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-600"}`}
                >
                  <Landmark className="w-6 h-6" />
                  <span className="font-bold text-sm">Bank Transfer</span>
                </button>
                <button
                  onClick={() => setFundingMethod("card")}
                  className={`p-4 rounded-xl border-2 flex flex-col items-center gap-3 transition-all ${fundingMethod === "card" ? "border-primary bg-primary/5 text-primary" : "border-slate-100 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-600"}`}
                >
                  <CreditCard className="w-6 h-6" />
                  <span className="font-bold text-sm">External Card</span>
                </button>
              </div>

              {fundingMethod === "bank" ? (
                <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-2xl border border-slate-100 dark:border-slate-800 text-center space-y-4">
                  <p className="text-sm font-medium text-slate-500">
                    Transfer to the following account to fund your wallet
                    instantly.
                  </p>
                  <div className="space-y-1">
                    <p className="text-xs font-bold uppercase text-slate-400">
                      Bank Name
                    </p>
                    <p className="font-bold text-lg">Zely Partner Bank</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] text-slate-400 ml-1">
                      Enter the full 10-digit account number to verify recipient
                    </p>
                    <p className="font-mono font-black text-2xl tracking-wider">
                      9900 2233 4455
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-bold uppercase text-slate-400">
                      Beneficiary
                    </p>
                    <p className="font-bold text-lg">Zely / John Doe</p>
                  </div>
                  <div className="pt-4 flex items-center justify-center gap-2 text-xs font-bold text-yellow-600 bg-yellow-50 dark:bg-yellow-900/10 py-2 rounded-lg">
                    <RefreshCw className="w-3 h-3 animate-spin" /> Waiting for
                    transfer...
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-bold text-slate-500 mb-2">
                      Amount
                    </label>
                    <div className="relative">
                      <span className="absolute left-5 top-1/2 -translate-y-1/2 font-bold text-slate-400">
                        ₦
                      </span>
                      <input
                        type="number"
                        value={fundingAmount}
                        onChange={(e) => setFundingAmount(e.target.value)}
                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-3 pl-12 pr-4 font-bold text-lg outline-none focus:ring-2 focus:ring-primary"
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                  <button
                    onClick={handleFunding}
                    disabled={fundStatus === "processing"}
                    className="w-full py-4 bg-primary text-white font-bold rounded-xl hover:bg-primary-light transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {fundStatus === "processing" ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      "Pay via Provider"
                    )}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-2xl mx-auto space-y-6 animate-in fade-in slide-in-from-right-4">
      <div className="bg-white dark:bg-slate-900 rounded-[2rem] p-8 border border-slate-200 dark:border-slate-800 shadow-xl min-h-[500px] flex flex-col">
        <div className="flex items-center gap-3 mb-8">
          <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-xl text-purple-600">
            <ArrowLeftRight className="w-6 h-6" />
          </div>
          <h2 className="text-2xl font-black">Transfer Money</h2>
        </div>

        {transferStatus !== "success" && transferStatus !== "confirm" && (
          <div className="relative flex p-1 bg-slate-100 dark:bg-slate-800 rounded-xl mb-8">
            <div
              className={`absolute inset-y-1 w-[calc(50%-4px)] bg-white dark:bg-slate-700 rounded-lg shadow-sm transition-all duration-300 ease-out ${
                transferType === "p2p"
                  ? "translate-x-[calc(100%+4px)]"
                  : "translate-x-1"
              }`}
            />
            <button
              onClick={() => handleTypeChange("internal")}
              className={`relative flex-1 flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-bold transition-colors z-10 ${transferType === "internal" ? "text-slate-900 dark:text-white" : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"}`}
            >
              <Wallet className="w-4 h-4" /> Internal
            </button>
            <button
              onClick={() => handleTypeChange("p2p")}
              className={`relative flex-1 flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-bold transition-colors z-10 ${transferType === "p2p" ? "text-slate-900 dark:text-white" : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"}`}
            >
              <Users className="w-4 h-4" /> P2P Transfer
            </button>
          </div>
        )}

        {transferStatus === "success" ? (
          <div className="text-center py-10 flex-1 flex flex-col items-center justify-center animate-in zoom-in duration-300">
            <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto text-green-500 mb-6">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <h3 className="text-2xl font-black mb-2">Transfer Complete!</h3>
            <p className="text-slate-500 mb-8 max-w-xs mx-auto">
              You successfully transferred{" "}
              <span className="font-bold text-slate-900 dark:text-white">
                ₦
                {lastTransaction
                  ? Number(lastTransaction.amount).toLocaleString()
                  : "0.00"}
              </span>{" "}
              to{" "}
              <span className="font-bold text-slate-900 dark:text-white">
                {lastTransaction?.recipient}
              </span>
              .
            </p>
            <button
              onClick={resetTransfer}
              className="px-8 py-3 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold rounded-xl w-full hover:scale-105 transition-transform"
            >
              Make Another Transfer
            </button>
          </div>
        ) : transferStatus === "confirm" ? (
          <div className="flex-1 flex flex-col animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="flex-1 space-y-6">
              <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 text-center">
                  Review Transaction
                </h3>

                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-500 font-medium">
                      Source Account
                    </span>
                    <div className="text-right">
                      <p className="text-sm font-bold text-slate-900 dark:text-white">
                        {getAccount(sourceId)?.name}
                      </p>
                      <p className="text-xs text-slate-400">
                        Balance: {getAccount(sourceId)?.currency}
                        {getAccount(sourceId)?.balance.toLocaleString()}
                      </p>
                    </div>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-500 font-medium">
                      Destination
                    </span>
                    <div className="text-right">
                      <p className="text-sm font-bold text-slate-900 dark:text-white">
                        {transferType === "internal"
                          ? getAccount(destId)?.name
                          : (recipientName ?? p2pRecipient)}
                      </p>
                      {transferType === "internal" && (
                        <p className="text-xs text-slate-400">Savings</p>
                      )}
                      {transferType === "p2p" && (
                        <p className="text-xs text-slate-400">Zely User</p>
                      )}
                    </div>
                  </div>

                  <div className="w-full h-px bg-slate-200 dark:bg-slate-700"></div>

                  <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-500 font-medium">
                      Amount
                    </span>
                    <span className="text-base font-bold text-slate-900 dark:text-white">
                      ₦
                      {Number(amount).toLocaleString("en-NG", {
                        minimumFractionDigits: 2,
                      })}
                    </span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-500 font-medium">
                      Transaction Fee
                    </span>
                    <span className="text-base font-bold text-green-500">
                      {fee !== null ? `₦${fee.toLocaleString("en-NG")}` : "—"}
                    </span>
                  </div>

                  <div className="w-full h-px bg-slate-200 dark:bg-slate-700"></div>

                  <div className="flex justify-between items-center pt-2">
                    <span className="text-base font-bold text-slate-900 dark:text-white">
                      Total Debit
                    </span>
                    <span className="text-2xl font-black text-slate-900 dark:text-white">
                      ₦
                      {(totalDeducted ?? Number(amount)).toLocaleString(
                        "en-NG",
                        { minimumFractionDigits: 2 },
                      )}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-4 mt-8">
              <button
                onClick={() => setTransferStatus("idle")}
                className="flex-1 py-4 border border-slate-200 dark:border-slate-700 rounded-xl font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >
                Edit
              </button>
              <button
                onClick={confirmTransfer}
                className="flex-[2] py-4 bg-primary text-white rounded-xl font-bold hover:bg-primary-light transition-colors shadow-lg shadow-primary/25 flex items-center justify-center gap-2"
              >
                <CheckCircle2 className="w-5 h-5" /> Confirm Transfer
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-6 flex-1">
            <AccountSelect
              label="From Account"
              accounts={getSourceAccounts()}
              selectedId={sourceId}
              onChange={(id) => {
                setSourceId(id);
                if (transferType === "internal" && id === destId) setDestId("");
              }}
            />

            <div className="space-y-2">
              {transferType === "internal" ? (
                <AccountSelect
                  label="To Account"
                  accounts={getDestAccounts()}
                  selectedId={destId}
                  onChange={setDestId}
                />
              ) : (
                <>
                  <label className="text-xs font-bold text-slate-500 uppercase ml-1">
                    To Recipient
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={p2pRecipient}
                      onChange={(e) => setP2pRecipient(e.target.value)}
                      placeholder="Enter 10-digit account number"
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all placeholder:font-normal placeholder:text-slate-400"
                    />
                  </div>

                  {/* Loading */}
                  {lookingUpRecipient && (
                    <p className="text-xs font-semibold text-slate-400 flex items-center gap-1.5 ml-1 animate-pulse">
                      <Loader2 className="w-3 h-3 animate-spin text-primary" />
                      Looking up account...
                    </p>
                  )}

                  {/* Verified */}
                  {!lookingUpRecipient && recipientName && (
                    <div className="flex items-center gap-2 mt-2 px-3.5 py-2.5 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/40 rounded-xl text-emerald-600 dark:text-emerald-450 animate-in fade-in slide-in-from-top-1 duration-200">
                      <Check className="w-4 h-4 text-emerald-500 stroke-[3px]" />
                      <div className="text-xs font-semibold">
                        Verified:{" "}
                        <span className="font-extrabold text-slate-900 dark:text-white">
                          {recipientName}
                        </span>
                        <span className="text-slate-400 dark:text-slate-500 ml-1.5 font-mono">
                          ({p2pRecipient})
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Not found */}
                  {p2pRecipient.length >= 10 &&
                    !recipientName &&
                    !lookingUpRecipient &&
                    lookupAttempted && (
                      <div className="flex items-center gap-2 mt-2 px-3.5 py-2.5 bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-100 dark:border-yellow-900/40 rounded-xl animate-in fade-in slide-in-from-top-1 duration-200">
                        <AlertCircle className="w-4 h-4 text-yellow-500" />
                        <p className="text-xs font-semibold text-yellow-600 dark:text-yellow-400">
                          Unverified account identifier. Please ensure the user
                          is registered.
                        </p>
                      </div>
                    )}

                  <p className="text-[10px] text-slate-400 ml-1">
                    Enter the full 10-digit account number to verify recipient
                  </p>
                </>
              )}
            </div>

            <div>
              <div className="flex justify-between mb-2">
                <label className="block text-sm font-bold text-slate-500">
                  Amount
                </label>
                <span className="text-xs font-bold text-slate-400">
                  Limit: {getAccount(sourceId)?.limit}
                </span>
              </div>
              <div className="relative">
                <span className="absolute left-5 top-1/2 -translate-y-1/2 font-bold text-slate-400">
                  ₦
                </span>
                <input
                  type="text"
                  value={displayAmount}
                  onChange={handleAmountChange}
                  className={`w-full bg-slate-50 dark:bg-slate-800 border ${amountError ? "border-red-500 ring-1 ring-red-500" : "border-slate-200 dark:border-slate-700"} rounded-xl py-3 pl-12 pr-4 font-bold text-lg outline-none focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-slate-300`}
                  placeholder="0.00"
                  disabled={transferStatus !== "idle"}
                />
              </div>
              {amountError && (
                <div className="flex items-center gap-1 mt-2 text-red-500 text-xs font-bold animate-pulse">
                  <AlertCircle className="w-3 h-3" />
                  {amountError}
                </div>
              )}

              {transferStatus === "idle" && (
                <div className="mt-4">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">
                    Suggested Amounts
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {SUGGESTED_AMOUNTS.map((val) => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => setQuickAmount(val)}
                        className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all ${
                          amount === val.toString()
                            ? "bg-primary border-primary text-white"
                            : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-primary/50 hover:text-primary"
                        }`}
                      >
                        ₦{val.toLocaleString()}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="pt-4">
              <button
                onClick={handleTransfer}
                disabled={
                  !amount ||
                  !!amountError ||
                  transferStatus === "processing" ||
                  (transferType === "internal" && !destId) ||
                  (transferType === "p2p" && !p2pRecipient)
                }
                className="w-full py-4 bg-primary text-white font-bold rounded-xl hover:bg-primary-light transition-all flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed shadow-lg shadow-primary/25 disabled:shadow-none"
              >
                {transferStatus === "processing" ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  "Review Transfer"
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TransfersScreen;
