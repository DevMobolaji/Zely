import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Loader2,
  CreditCard,
  MapPin,
  User,
  AlertTriangle,
} from "lucide-react";
import { kycService } from "../../services/kycService";
import { Tier2Payload, KYCStatusResponse } from "../../types";
import { useToast } from "../../context/ToastContext";
import CustomDatePicker from "../../components/common/CustomDatePicker";
import CustomSelect from "../../components/common/CustomSelect";
import { useAsync } from "../../hooks/useAsync";
import StateRenderer from "../../components/common/StateRenderer";
import { DocumentUpload } from "@/components/dashboard/documentUpload";

const KYCTier2Form: React.FC = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const {
    data: status,
    loading: statusLoading,
    error: statusError,
    execute: fetchStatus,
  } = useAsync<KYCStatusResponse>(kycService.getMyStatus);

  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<Tier2Payload>({
    bvn: "",
    nin: "",
    dateOfBirth: "",
    governmentId: {
      type: "NATIONAL_ID_CARD",
      number: "",
      documentUrl: "",
    },
    address: {
      street: "",
      city: "",
      state: "",
      country: "NG",
      proofOfAddressUrl: "",
    },
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

  if (status?.currentTier === "TIER_2" || status?.currentTier === "TIER_3") {
    return (
      <div className="max-w-3xl mx-auto p-6 flex flex-col items-center text-center">
        <CheckCircle2 className="w-16 h-16 text-green-500 mb-4" />
        <h1 className="text-2xl font-bold mb-2">Already Upgraded</h1>
        <p className="text-slate-500">
          Your account is already at Tier 2 or higher.
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

  if (status?.pendingSubmission?.targetTier === "TIER_2") {
    return (
      <div className="max-w-3xl mx-auto p-6 flex flex-col items-center text-center">
        <ShieldCheck className="w-16 h-16 text-blue-500 mb-4" />
        <h1 className="text-2xl font-bold mb-2">Submission Under Review</h1>
        <p className="text-slate-500">
          Your Tier 2 application is currently being reviewed by our team.
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

    if (!/^\d{11}$/.test(formData.bvn))
      newErrors.bvn = "BVN must be exactly 11 digits";
    if (!/^\d{11}$/.test(formData.nin))
      newErrors.nin = "NIN must be exactly 11 digits";

    if (!formData.dateOfBirth) {
      newErrors.dateOfBirth = "Date of birth is required";
    } else {
      const dob = new Date(formData.dateOfBirth);
      if (dob >= new Date())
        newErrors.dateOfBirth = "Date of birth must be in the past";
    }

    if (
      formData.governmentId.number.length < 3 ||
      formData.governmentId.number.length > 50
    ) {
      newErrors.idNumber = "ID number must be between 3 and 50 characters";
    }

    if (
      formData.address.street.length < 3 ||
      formData.address.street.length > 200
    ) {
      newErrors.street = "Street must be between 3 and 200 characters";
    }

    if (
      formData.address.city.length < 2 ||
      formData.address.city.length > 100
    ) {
      newErrors.city = "City must be between 2 and 100 characters";
    }

    if (
      formData.address.state.length < 2 ||
      formData.address.state.length > 100
    ) {
      newErrors.state = "State must be between 2 and 100 characters";
    }

    if (!formData.governmentId.documentUrl)
      newErrors.documentUrl = "ID document upload is required";
    if (!formData.address.proofOfAddressUrl)
      newErrors.proofOfAddressUrl = "Proof of address upload is required";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const isSubmitDisabled =
    !formData.governmentId.documentUrl ||
    !formData.address.proofOfAddressUrl ||
    loading;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) {
      showToast("error", "Please correct the errors in the form");
      return;
    }

    setLoading(true);
    try {
      await kycService.upgradeToTier2(formData);
      showToast("success", "Tier 2 application submitted successfully");
      await fetchStatus(); // Refresh status to transition UI immediately
      navigate("/kyc");
    } catch (err: any) {
      const msg = (
        err.response?.data?.message ||
        err.message ||
        ""
      ).toUpperCase();

      if (msg.includes("BVN_ALREADY_LINKED")) {
        showToast(
          "error",
          "This BVN is already associated with another Zely account. Please contact support.",
        );
        setErrors((prev) => ({
          ...prev,
          bvn: "BVN already linked to another account",
        }));
      } else {
        showToast(
          "error",
          err.response?.data?.message || err.message || "Submission failed",
        );
      }

      if (msg.includes("ALREADY_EXISTS")) {
        await fetchStatus();
      } else if (
        msg.includes("INVALID_DOCUMENT_SOURCE") ||
        msg.includes("DOCUMENT_NOT_IN_EXPECTED_LOCATION") ||
        msg.includes("DOCUMENT_VALIDATION_ERROR") ||
        msg.includes("COULD_NOT_VERIFY_UPLOADED")
      ) {
        // If the error implies the document was rejected by the backend, force re-upload.
        // Resetting both if we don't know which one specifically, otherwise we can assume the user will reupload.
        setFormData((prev) => ({
          ...prev,
          governmentId: { ...prev.governmentId, documentUrl: "" },
          address: { ...prev.address, proofOfAddressUrl: "" },
        }));
        showToast(
          "error",
          "A document validation error occurred. Please re-upload your documents and try again.",
        );
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-4 md:p-6 pb-20 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <button
          onClick={() => navigate("/kyc")}
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">
            Upgrade to Tier 2
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Higher limits, more freedom
          </p>
        </div>
      </div>

      {status?.lastRejection?.targetTier === "TIER_2" && (
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

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Section 1: Identity Numbers */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 border border-gray-200 dark:border-gray-800 shadow-sm space-y-6">
          <div className="flex items-center gap-2 text-blue-600 mb-2">
            <User size={18} />
            <h2 className="font-bold">Identity Details</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                Bank Verification Number (BVN)
              </label>
              <input
                type="text"
                maxLength={11}
                value={formData.bvn}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    bvn: e.target.value.replace(/\D/g, ""),
                  })
                }
                placeholder="12345678901"
                className={`w-full px-4 py-3 bg-gray-50 dark:bg-gray-800/50 border ${errors.bvn ? "border-red-500" : "border-gray-100 dark:border-gray-700"} rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all`}
              />
              {errors.bvn && (
                <p className="text-xs text-red-500 flex items-center gap-1">
                  <AlertCircle size={12} /> {errors.bvn}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                National ID Number (NIN)
              </label>
              <input
                type="text"
                maxLength={11}
                value={formData.nin}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    nin: e.target.value.replace(/\D/g, ""),
                  })
                }
                placeholder="98765432109"
                className={`w-full px-4 py-3 bg-gray-50 dark:bg-gray-800/50 border ${errors.nin ? "border-red-500" : "border-gray-100 dark:border-gray-700"} rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all`}
              />
              {errors.nin && (
                <p className="text-xs text-red-500 flex items-center gap-1">
                  <AlertCircle size={12} /> {errors.nin}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                Date of Birth
              </label>
              <CustomDatePicker
                value={formData.dateOfBirth}
                onChange={(value) =>
                  setFormData({ ...formData, dateOfBirth: value })
                }
                className={
                  errors.dateOfBirth ? "ring-2 ring-red-500/50 rounded-xl" : ""
                }
              />
              {errors.dateOfBirth && (
                <p className="text-xs text-red-500 flex items-center gap-1">
                  <AlertCircle size={12} /> {errors.dateOfBirth}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Section 2: Government ID */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 border border-gray-200 dark:border-gray-800 shadow-sm space-y-6">
          <div className="flex items-center gap-2 text-blue-600 mb-2">
            <CreditCard size={18} />
            <h2 className="font-bold">Government-issued ID</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                ID Type
              </label>
              <CustomSelect
                value={formData.governmentId.type}
                onChange={(value) =>
                  setFormData({
                    ...formData,
                    governmentId: {
                      ...formData.governmentId,
                      type: value as any,
                    },
                  })
                }
                options={[
                  { value: "NATIONAL_ID_CARD", label: "National ID Card" },
                  { value: "DRIVERS_LICENSE", label: "Driver's License" },
                  {
                    value: "INTERNATIONAL_PASSPORT",
                    label: "International Passport",
                  },
                  { value: "VOTERS_CARD", label: "Voter's Card" },
                ]}
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                ID Number
              </label>
              <input
                type="text"
                value={formData.governmentId.number}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    governmentId: {
                      ...formData.governmentId,
                      number: e.target.value,
                    },
                  })
                }
                placeholder="ABC1234567"
                className={`w-full px-4 py-3 bg-gray-50 dark:bg-gray-800/50 border ${errors.idNumber ? "border-red-500" : "border-gray-100 dark:border-gray-700"} rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all`}
              />
              {errors.idNumber && (
                <p className="text-xs text-red-500 flex items-center gap-1">
                  <AlertCircle size={12} /> {errors.idNumber}
                </p>
              )}
            </div>

            <div className="md:col-span-2">
              <DocumentUpload
                documentType="GOVERNMENT_ID"
                label="Upload ID Document (Front)"
                description="PNG, JPG or PDF up to 5MB"
                currentUrl={formData.governmentId.documentUrl}
                onUploadSuccess={(url) => {
                  setFormData((prev) => ({
                    ...prev,
                    governmentId: { ...prev.governmentId, documentUrl: url },
                  }));
                  setErrors((prev) => ({ ...prev, documentUrl: "" }));
                }}
              />
              {errors.documentUrl && (
                <p className="text-xs text-red-500 mt-2 flex items-center gap-1">
                  <AlertCircle size={12} /> {errors.documentUrl}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Section 3: Address */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 border border-gray-200 dark:border-gray-800 shadow-sm space-y-6">
          <div className="flex items-center gap-2 text-blue-600 mb-2">
            <MapPin size={18} />
            <h2 className="font-bold">Residential Address</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                Street Address
              </label>
              <input
                type="text"
                value={formData.address.street}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    address: { ...formData.address, street: e.target.value },
                  })
                }
                placeholder="12 Lekki Phase 1"
                className={`w-full px-4 py-3 bg-gray-50 dark:bg-gray-800/50 border ${errors.street ? "border-red-500" : "border-gray-100 dark:border-gray-700"} rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all`}
              />
              {errors.street && (
                <p className="text-xs text-red-500 flex items-center gap-1">
                  <AlertCircle size={12} /> {errors.street}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                City
              </label>
              <input
                type="text"
                value={formData.address.city}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    address: { ...formData.address, city: e.target.value },
                  })
                }
                placeholder="Lagos"
                className={`w-full px-4 py-3 bg-gray-50 dark:bg-gray-800/50 border ${errors.city ? "border-red-500" : "border-gray-100 dark:border-gray-700"} rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all`}
              />
              {errors.city && (
                <p className="text-xs text-red-500 flex items-center gap-1">
                  <AlertCircle size={12} /> {errors.city}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                State
              </label>
              <input
                type="text"
                value={formData.address.state}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    address: { ...formData.address, state: e.target.value },
                  })
                }
                placeholder="Lagos"
                className={`w-full px-4 py-3 bg-gray-50 dark:bg-gray-800/50 border ${errors.state ? "border-red-500" : "border-gray-100 dark:border-gray-700"} rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all`}
              />
              {errors.state && (
                <p className="text-xs text-red-500 flex items-center gap-1">
                  <AlertCircle size={12} /> {errors.state}
                </p>
              )}
            </div>

            <div className="md:col-span-2">
              <DocumentUpload
                documentType="PROOF_OF_ADDRESS"
                label="Upload Proof of Address"
                description="Must be dated within last 3 months"
                currentUrl={formData.address.proofOfAddressUrl}
                onUploadSuccess={(url) => {
                  setFormData((prev) => ({
                    ...prev,
                    address: { ...prev.address, proofOfAddressUrl: url },
                  }));
                  setErrors((prev) => ({ ...prev, proofOfAddressUrl: "" }));
                }}
              />
              {errors.proofOfAddressUrl && (
                <p className="text-xs text-red-500 mt-2 flex items-center gap-1">
                  <AlertCircle size={12} /> {errors.proofOfAddressUrl}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isSubmitDisabled}
          className="w-full py-4 bg-primary hover:bg-primary-dark disabled:bg-slate-300 dark:disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-2xl font-bold text-lg shadow-lg hover:shadow-xl disabled:shadow-none transition-all flex items-center justify-center gap-2 active:scale-[0.98]"
        >
          {loading ? (
            <>
              <Loader2 size={24} className="animate-spin" /> Submitting
              Application...
            </>
          ) : (
            <>
              <ShieldCheck size={24} /> Submit Application
            </>
          )}
        </button>
      </form>
    </div>
  );
};

export default KYCTier2Form;
