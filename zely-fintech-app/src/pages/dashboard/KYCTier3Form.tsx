import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ShieldCheck,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Info,
  AlertTriangle,
} from "lucide-react";
import { kycService } from "../../services/kycService";
import { Tier3Payload, KYCStatusResponse } from "../../types";
import { useToast } from "../../context/ToastContext";
import { useAsync } from "../../hooks/useAsync";
import StateRenderer from "../../components/common/StateRenderer";
import { DocumentUpload } from "@/components/dashboard/documentUpload";

const KYCTier3Form: React.FC = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const {
    data: status,
    loading: statusLoading,
    error: statusError,
    execute: fetchStatus,
  } = useAsync<KYCStatusResponse>(kycService.getMyStatus);

  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<Tier3Payload>({
    selfieUrl: "",
    livenessVideoUrl: "",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchStatus().catch(() => {});
  }, [fetchStatus]);

  if (statusLoading)
    return (
      <div className="p-8 flex justify-center text-slate-400">
        <Loader2 className="animate-spin w-8 h-8" />
      </div>
    );
  if (statusError)
    return (
      <div className="p-8 text-center text-red-500">
        <AlertCircle className="mx-auto w-8 h-8 mb-2" />
        <p>
          {typeof statusError === "string"
            ? statusError
            : (statusError as any).message}
        </p>
      </div>
    );

  if (status?.currentTier === "TIER_3") {
    return (
      <div className="max-w-3xl mx-auto p-6 flex flex-col items-center text-center">
        <CheckCircle2 className="w-16 h-16 text-green-500 mb-4" />
        <h1 className="text-2xl font-bold mb-2">Already Upgraded</h1>
        <p className="text-slate-500">Your account is already at Tier 3.</p>
        <button
          onClick={() => navigate("/kyc")}
          className="mt-6 px-6 py-2 bg-slate-100 font-bold rounded-xl text-slate-700"
        >
          Back to KYC
        </button>
      </div>
    );
  }

  // Backend rejects if not Tier 2. Show UI check here.
  if (status?.currentTier !== "TIER_2") {
    return (
      <div className="max-w-3xl mx-auto p-6 flex flex-col items-center text-center">
        <AlertTriangle className="w-16 h-16 text-red-500 mb-4" />
        <h1 className="text-2xl font-bold mb-2">Not Eligible</h1>
        <p className="text-slate-500">
          You must be at Tier 2 before upgrading to Tier 3.
        </p>
        <button
          onClick={() => navigate("/kyc")}
          className="mt-6 px-6 py-2 bg-slate-100 font-bold rounded-xl text-slate-700"
        >
          Back to KYC
        </button>
      </div>
    );
  }

  if (status?.pendingSubmission?.targetTier === "TIER_3") {
    return (
      <div className="max-w-3xl mx-auto p-6 flex flex-col items-center text-center">
        <ShieldCheck className="w-16 h-16 text-blue-500 mb-4" />
        <h1 className="text-2xl font-bold mb-2">Submission Under Review</h1>
        <p className="text-slate-500">
          Your Tier 3 application is currently being reviewed by our team.
        </p>
        <button
          onClick={() => navigate("/kyc")}
          className="mt-6 px-6 py-2 bg-slate-100 font-bold rounded-xl text-slate-700"
        >
          Back to KYC
        </button>
      </div>
    );
  }

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.selfieUrl) newErrors.selfieUrl = "Selfie photo is required";
    if (!formData.livenessVideoUrl)
      newErrors.livenessVideoUrl = "Liveness video is required";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const isSubmitDisabled =
    !formData.selfieUrl || !formData.livenessVideoUrl || loading;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    try {
      await kycService.upgradeToTier3(formData);
      showToast("success", "Tier 3 application submitted successfully");
      await fetchStatus();
      navigate("/kyc");
    } catch (err: any) {
      showToast(
        "error",
        err.response?.data?.message || err.message || "Submission failed",
      );
      const msg = (
        err.response?.data?.message ||
        err.message ||
        ""
      ).toUpperCase();
      if (msg.includes("ALREADY_EXISTS")) {
        await fetchStatus();
      } else if (
        msg.includes("INVALID_DOCUMENT_SOURCE") ||
        msg.includes("DOCUMENT_NOT_IN_EXPECTED_LOCATION") ||
        msg.includes("DOCUMENT_VALIDATION_ERROR") ||
        msg.includes("COULD_NOT_VERIFY_UPLOADED")
      ) {
        // Force re-upload
        setFormData((prev) => ({
          ...prev,
          selfieUrl: "",
          livenessVideoUrl: "",
        }));
        showToast(
          "error",
          "A document validation error occurred. Please re-upload your media and try again.",
        );
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto p-4 md:p-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <button
          onClick={() => navigate("/kyc")}
          className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">
            Upgrade to Tier 3
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Unlimited access & maximum security
          </p>
        </div>
      </div>

      {status?.lastRejection?.targetTier === "TIER_3" && (
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30 rounded-2xl flex items-start gap-3 text-red-700 dark:text-red-400">
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <h4 className="font-bold mb-1">Previous Submission Rejected</h4>
            <p className="text-sm">{status.lastRejection.reason}</p>
            <p className="text-xs mt-2 opacity-80">
              Please correct the issues and submit again.
            </p>
          </div>
        </div>
      )}

      <div className="bg-primary/5 dark:bg-primary/10 rounded-2xl p-4 border border-primary/20 flex items-start gap-3 mb-8">
        <Info size={18} className="text-primary mt-0.5" />
        <p className="text-xs text-primary/80 font-medium leading-relaxed">
          Tier 3 verification requires biometric data to confirm your physical
          presence. Please ensure you are in a well-lit environment and your
          face is fully visible.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Selfie Upload */}
        <div className="space-y-3">
          <DocumentUpload
            documentType="SELFIE"
            label="Take a Selfie"
            description="Make sure your face is centered. PNG or JPG up to 5MB."
            currentUrl={formData.selfieUrl}
            onUploadSuccess={(url) => {
              setFormData((prev) => ({ ...prev, selfieUrl: url }));
              setErrors((prev) => ({ ...prev, selfieUrl: "" }));
            }}
          />
          {errors.selfieUrl && (
            <p className="text-xs text-red-500 flex items-center gap-1">
              <AlertCircle size={12} /> {errors.selfieUrl}
            </p>
          )}
        </div>

        {/* Liveness Video Upload */}
        <div className="space-y-3">
          <DocumentUpload
            documentType="LIVENESS_VIDEO"
            label="Record 5s Liveness Video"
            description="Blink and turn your head slowly. MP4, MOV up to 25MB."
            currentUrl={formData.livenessVideoUrl}
            onUploadSuccess={(url) => {
              setFormData((prev) => ({ ...prev, livenessVideoUrl: url }));
              setErrors((prev) => ({ ...prev, livenessVideoUrl: "" }));
            }}
          />
          {errors.livenessVideoUrl && (
            <p className="text-xs text-red-500 flex items-center gap-1">
              <AlertCircle size={12} /> {errors.livenessVideoUrl}
            </p>
          )}
        </div>

        <div className="pt-6">
          <button
            type="submit"
            disabled={isSubmitDisabled}
            className="w-full py-4 bg-primary hover:bg-primary-dark disabled:bg-slate-300 dark:disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-2xl font-bold text-lg shadow-lg hover:shadow-xl disabled:shadow-none transition-all flex items-center justify-center gap-2 active:scale-[0.98]"
          >
            {loading ? (
              <>
                <Loader2 size={24} className="animate-spin" /> Verifying...
              </>
            ) : (
              <>
                <ShieldCheck size={24} /> Submit Final Upgrade
              </>
            )}
          </button>
          <p className="text-[10px] text-slate-400 text-center mt-4 uppercase tracking-widest font-semibold">
            Encrypted biometric transmission secured by Zely
          </p>
        </div>
      </form>
    </div>
  );
};

export default KYCTier3Form;
