import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ShieldCheck,
  ShieldAlert,
  Clock,
  ChevronRight,
  Info,
  AlertCircle,
  CheckCircle2,
  TrendingUp,
  ArrowUpCircle,
  Loader2,
} from "lucide-react";
import { kycService } from "../../services/kycService";
import { KYCStatusResponse } from "../../types";
import StateRenderer from "../../components/common/StateRenderer";
import { useAsync } from "../../hooks/useAsync";

const TierLimitsTable = () => {
  const limits = [
    {
      tier: "Tier 1",
      perTx: "₦50,000",
      perDay: "₦200,000",
      cap: "₦500,000",
      velocity: "5/hr",
      benefits: "Basic transfers, Bill payments",
    },
    {
      tier: "Tier 2",
      perTx: "₦200,000",
      perDay: "₦500,000",
      cap: "₦1,000,000",
      velocity: "20/hr",
      benefits: "Increased limits, Virtual Card access, P2P Lending",
    },
    {
      tier: "Tier 3",
      perTx: "₦5,000,000",
      perDay: "Unlimited",
      cap: "Unlimited",
      velocity: "Unlimited",
      benefits:
        "Unlimited limits, Priority support, International transfers, Investment access",
    },
  ];

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-100 dark:border-gray-800">
      <table className="w-full text-left text-sm">
        <thead className="bg-gray-50 dark:bg-gray-900/50 text-gray-500 uppercase text-xs font-semibold">
          <tr>
            <th className="px-4 py-3 min-w-[100px]">Tier</th>
            <th className="px-4 py-3 min-w-[200px]">Benefits Included</th>
            <th className="px-4 py-3 min-w-[100px]">Per Tx Limit</th>
            <th className="px-4 py-3 min-w-[100px]">Daily Limit</th>
            <th className="px-4 py-3 min-w-[100px]">Wallet Cap</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
          {limits.map((limit, idx) => (
            <tr
              key={idx}
              className="hover:bg-gray-50/50 dark:hover:bg-gray-900/20 transition-colors"
            >
              <td className="px-4 py-4 font-bold text-gray-900 dark:text-white capitalize whitespace-nowrap">
                {limit.tier}
              </td>
              <td className="px-4 py-4 text-gray-600 dark:text-gray-400 text-xs">
                {limit.benefits}
              </td>
              <td className="px-4 py-4 text-gray-900 dark:text-gray-300 font-medium whitespace-nowrap">
                {limit.perTx}
              </td>
              <td className="px-4 py-4 text-gray-900 dark:text-gray-300 font-medium whitespace-nowrap">
                {limit.perDay}
              </td>
              <td className="px-4 py-4 text-gray-900 dark:text-gray-300 font-medium whitespace-nowrap">
                {limit.cap}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const KYCStatusScreen: React.FC = () => {
  const navigate = useNavigate();
  const {
    data: status,
    loading,
    error,
    execute: fetchStatus,
  } = useAsync<KYCStatusResponse>(kycService.getMyStatus);

  useEffect(() => {
    fetchStatus().catch(() => {});
  }, [fetchStatus]);

  const getTierBadge = (tier: string) => {
    switch (tier) {
      case "TIER_3":
        return (
          <span className="px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs font-bold rounded-full border border-green-200 dark:border-green-800 flex items-center gap-1.5">
            <ShieldCheck size={14} /> Tier 3
          </span>
        );
      case "TIER_2":
        return (
          <span className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-xs font-bold rounded-full border border-blue-200 dark:border-blue-800 flex items-center gap-1.5">
            <ShieldCheck size={14} /> Tier 2
          </span>
        );
      default:
        return (
          <span className="px-3 py-1 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 text-xs font-bold rounded-full border border-gray-200 dark:border-gray-700 flex items-center gap-1.5">
            <ShieldCheck size={14} /> Tier 1
          </span>
        );
    }
  };

  if (loading)
    return (
      <div className="p-8 flex justify-center text-slate-400">
        <Loader2 className="animate-spin w-8 h-8" />
      </div>
    );
  if (error)
    return (
      <div className="p-8 text-center text-red-500">
        <AlertCircle className="mx-auto w-8 h-8 mb-2" />
        <p>{typeof error === "string" ? error : (error as any).message}</p>
      </div>
    );
  if (!status) return null;

  const { currentTier, pendingSubmission, lastRejection } = status;

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            KYC Verification
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Manage your account limits and security level
          </p>
        </div>
        <div>{getTierBadge(currentTier)}</div>
      </div>

      {/* Current Status Card */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden shadow-sm">
        <div className="p-6">
          <div className="flex items-start gap-4">
            <div
              className={`p-3 rounded-xl ${
                currentTier === "TIER_3"
                  ? "bg-green-50 dark:bg-green-900/20 text-green-600"
                  : currentTier === "TIER_2"
                    ? "bg-blue-50 dark:bg-blue-900/20 text-blue-600"
                    : "bg-gray-50 dark:bg-gray-800 text-gray-600"
              }`}
            >
              <ShieldCheck size={24} />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                {currentTier === "TIER_3"
                  ? "Fully Verified"
                  : currentTier === "TIER_2"
                    ? "Tier 2 Verified"
                    : "Basic Verification"}
              </h3>
              <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
                {currentTier === "TIER_3"
                  ? "You have access to all features and unlimited transaction limits."
                  : currentTier === "TIER_2"
                    ? "You are verified at Tier 2. Upgrade to Tier 3 for unlimited limits."
                    : "Verify your identity to increase your transaction limits and unlock more features."}
              </p>
            </div>
          </div>
        </div>

        {/* Status-specific banners */}
        {pendingSubmission && (
          <div className="bg-amber-50 dark:bg-amber-900/20 px-6 py-4 border-t border-amber-100 dark:border-amber-900/30 flex items-center gap-3">
            <Clock
              size={18}
              className="text-amber-600 dark:text-amber-400 animate-pulse"
            />
            <div className="flex-1">
              <p className="text-amber-800 dark:text-amber-300 text-sm font-medium">
                Upgrade to {pendingSubmission.targetTier.replace("_", " ")}{" "}
                under review
              </p>
              <p className="text-amber-700/70 dark:text-amber-400/70 text-xs mt-0.5">
                Submitted on{" "}
                {new Date(pendingSubmission.submittedAt).toLocaleDateString()}{" "}
                at{" "}
                {new Date(pendingSubmission.submittedAt).toLocaleTimeString()}
              </p>
            </div>
            <span className="text-xs font-bold text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/40 px-2.5 py-1 rounded-full border border-amber-200 dark:border-amber-800">
              PENDING REVIEW
            </span>
          </div>
        )}

        {lastRejection && !pendingSubmission && (
          <div className="bg-red-50 dark:bg-red-900/20 px-6 py-4 border-t border-red-100 dark:border-red-900/30 flex items-start gap-3">
            <AlertCircle
              size={18}
              className="text-red-600 dark:text-red-400 mt-0.5"
            />
            <div className="flex-1">
              <p className="text-red-800 dark:text-red-300 text-sm font-medium">
                Your upgrade to {lastRejection.targetTier.replace("_", " ")} was
                rejected
              </p>
              <p className="text-red-700/80 dark:text-red-400/80 text-sm mt-1 bg-white/50 dark:bg-black/20 p-2 rounded-lg border border-red-100 dark:border-red-900/30">
                <span className="font-semibold">Reason:</span>{" "}
                {lastRejection.reason}
              </p>
            </div>
          </div>
        )}

        {/* Upgrade CTAs */}
        {!pendingSubmission && (
          <div className="px-6 py-4 bg-gray-50/50 dark:bg-gray-900/50 border-t border-gray-100 dark:border-gray-800 flex justify-end">
            {currentTier === "TIER_1" && (
              <button
                onClick={() => navigate("/kyc/upgrade/tier-2")}
                className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold transition-all hover:shadow-lg hover:shadow-blue-500/20 transform active:scale-[0.98]"
              >
                Upgrade to Tier 2 <ChevronRight size={18} />
              </button>
            )}
            {currentTier === "TIER_2" && (
              <button
                onClick={() => navigate("/kyc/upgrade/tier-3")}
                className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold transition-all hover:shadow-lg hover:shadow-blue-500/20 transform active:scale-[0.98]"
              >
                Upgrade to Tier 3 <ChevronRight size={18} />
              </button>
            )}
            {currentTier === "TIER_3" && (
              <div className="flex items-center gap-2 text-green-600 dark:text-green-400 font-semibold py-2">
                <CheckCircle2 size={18} /> You are at the highest verification
                level
              </div>
            )}
          </div>
        )}
      </div>

      {/* Tier Limits Table Section */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <TrendingUp size={20} className="text-blue-600" />
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">
            Transaction Limits
          </h2>
        </div>
        <TierLimitsTable />
        <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1.5 px-1 font-medium italic italic">
          <Info size={14} /> Limits are subject to change based on regulatory
          requirements and transaction history.
        </p>
      </div>

      {/* Simple Help Section */}
      <div className="bg-blue-50 dark:bg-blue-900/10 rounded-2xl p-6 border border-blue-100 dark:border-blue-900/30 flex items-start gap-4">
        <div className="p-2 bg-blue-100 dark:bg-blue-900/40 rounded-lg text-blue-600 dark:text-blue-400">
          <Info size={20} />
        </div>
        <div>
          <h4 className="font-bold text-blue-900 dark:text-blue-200">
            Why verify?
          </h4>
          <p className="text-blue-800/70 dark:text-blue-300/70 text-sm mt-1">
            Government regulations require us to collect specific information
            about our users to prevent financial crimes. Verifying your identity
            helps us keep your account safe and compliant.
          </p>
        </div>
      </div>
    </div>
  );
};

export default KYCStatusScreen;
