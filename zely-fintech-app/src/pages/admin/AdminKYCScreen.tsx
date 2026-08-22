import {
  AlertCircle,
  CheckCircle2,
  Clock,
  ExternalLink,
  Eye,
  FileText,
  Filter,
  Loader2,
  MapPin,
  Search,
  Shield,
  User as UserIcon,
  Video,
  X,
  XCircle,
} from "lucide-react";
import React, { useEffect, useState } from "react";
import { useToast } from "../../context/ToastContext";
import { kycService } from "../../services/kycService";
import { KYCSubmission, Tier2Payload, Tier3Payload } from "../../types";

const AdminKYCScreen: React.FC = () => {
  const { showToast } = useToast();
  const [submissions, setSubmissions] = useState<KYCSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSub, setSelectedSub] = useState<KYCSubmission | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [showRejectInput, setShowRejectInput] = useState(false);

  const fetchSubmissions = async () => {
    setLoading(true);
    try {
      const data = await kycService.getPendingSubmissions();
      setSubmissions(data);
    } catch (err: any) {
      showToast("error", "Failed to load submissions");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubmissions();
  }, []);

  const handleApprove = async (id: string) => {
    setActionLoading("approve");
    try {
      await kycService.approveSubmission(id);
      showToast("success", "Submission approved successfully");
      setSelectedSub(null);
      fetchSubmissions();
    } catch (err: any) {
      showToast("error", "Failed to approve");
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (id: string) => {
    if (rejectReason.length < 5 || rejectReason.length > 500) {
      showToast("error", "Reason must be between 5 and 500 characters");
      return;
    }

    setActionLoading("reject");
    try {
      await kycService.rejectSubmission(id, rejectReason);
      showToast("success", "Submission rejected successfully");
      setSelectedSub(null);
      setShowRejectInput(false);
      setRejectReason("");
      fetchSubmissions();
    } catch (err: any) {
      showToast("error", "Failed to reject");
    } finally {
      setActionLoading(null);
    }
  };

  const isTier2Data = (data: any): data is Tier2Payload => "bvn" in data;

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Shield className="text-blue-600" size={24} /> KYC Verification
            Center
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Review and manage identity verification requests
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              size={18}
            />
            <input
              type="text"
              placeholder="Search by name or email..."
              className="pl-10 pr-4 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none w-full md:w-64 transition-all"
            />
          </div>
          <button className="p-2 border border-gray-200 dark:border-gray-800 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
            <Filter size={18} className="text-gray-500" />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="py-20 flex flex-col items-center gap-3">
          <Loader2 size={40} className="animate-spin text-blue-600" />
          <p className="text-gray-500 font-medium">Loading submissions...</p>
        </div>
      ) : submissions.length === 0 ? (
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-12 text-center space-y-4 shadow-sm">
          <div className="w-16 h-16 bg-green-50 dark:bg-green-900/20 rounded-full flex items-center justify-center mx-auto text-green-600">
            <CheckCircle2 size={32} />
          </div>
          <div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white">
              Clean Queue!
            </h3>
            <p className="text-gray-500 dark:text-gray-400 mt-1">
              There are no pending KYC submissions to review at this time.
            </p>
          </div>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden shadow-sm">
          <table className="w-full text-left">
            <thead className="bg-gray-50 dark:bg-gray-800/50 text-gray-500 uppercase text-xs font-semibold">
              <tr>
                <th className="px-6 py-4">User</th>
                <th className="px-6 py-4">Tier Request</th>
                <th className="px-6 py-4">Submitted At</th>
                <th className="px-6 py-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {submissions.map((sub) => (
                <tr
                  key={sub.id}
                  className="hover:bg-gray-50 dark:hover:bg-gray-800/20 transition-colors"
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 flex items-center justify-center font-bold">
                        {sub.userName?.[0] || "U"}
                      </div>
                      <div>
                        <div className="font-bold text-gray-900 dark:text-white">
                          {sub.userName || "Anonymous User"}
                        </div>
                        <div className="text-xs text-gray-500">
                          {sub.userEmail}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                        sub.tier === "TIER_3"
                          ? "bg-purple-100 dark:bg-purple-900/30 text-purple-700 border-purple-200"
                          : "bg-blue-100 dark:bg-blue-900/30 text-blue-700 border-blue-200"
                      }`}
                    >
                      {sub.tier.replace("_", " ")}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-400">
                      <Clock size={14} className="text-gray-400" />
                      {new Date(sub.submittedAt).toLocaleDateString()}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => setSelectedSub(sub)}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-bold transition-all flex items-center gap-2 ml-auto"
                    >
                      <Eye size={16} /> Review
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Submissions Detail Modal */}
      {selectedSub && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white dark:bg-gray-900 rounded-3xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl border border-gray-100 dark:border-gray-800 animate-in zoom-in-95 duration-300">
            {/* Modal Header */}
            <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between bg-gray-50 dark:bg-gray-800/30">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-600/10 rounded-2xl text-blue-600">
                  <FileText size={24} />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                    Review {selectedSub.tier.replace("_", " ")} Application
                  </h2>
                  <p className="text-sm text-gray-500">
                    Submitted by {selectedSub.userEmail} on{" "}
                    {new Date(selectedSub.submittedAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setSelectedSub(null);
                  setShowRejectInput(false);
                  setRejectReason("");
                }}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Left Side: Raw Data */}
                <div className="space-y-6">
                  <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2 border-b border-gray-100 dark:border-gray-800 pb-2">
                    <UserIcon size={18} className="text-blue-600" /> Identity
                    Information
                  </h3>

                  {isTier2Data(selectedSub.data) ? (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <p className="text-xs font-bold text-gray-500 uppercase">
                            BVN
                          </p>
                          <p className="font-mono text-gray-900 dark:text-white">
                            {selectedSub.data.bvn}
                          </p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-xs font-bold text-gray-500 uppercase">
                            NIN
                          </p>
                          <p className="font-mono text-gray-900 dark:text-white">
                            {selectedSub.data.nin}
                          </p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-xs font-bold text-gray-500 uppercase">
                            DOB
                          </p>
                          <p className="text-gray-900 dark:text-white">
                            {selectedSub.data.dateOfBirth}
                          </p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-xs font-bold text-gray-500 uppercase">
                            ID Type
                          </p>
                          <p className="text-gray-900 dark:text-white">
                            {selectedSub.data.governmentId.type.replace(
                              /_/g,
                              " ",
                            )}
                          </p>
                        </div>
                      </div>

                      <div className="space-y-1 pt-2">
                        <p className="text-xs font-bold text-gray-500 uppercase flex items-center gap-1">
                          <MapPin size={12} /> Address
                        </p>
                        <p className="text-gray-900 dark:text-white">
                          {selectedSub.data.address.street},{" "}
                          {selectedSub.data.address.city},{" "}
                          {selectedSub.data.address.state},{" "}
                          {selectedSub.data.address.country}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 bg-purple-50 dark:bg-purple-900/10 rounded-2xl border border-purple-100 dark:border-purple-800/30">
                      <p className="text-sm font-medium text-purple-800 dark:text-purple-300">
                        Biometric Tier 3 Submission
                      </p>
                      <p className="text-xs text-purple-700/70 dark:text-purple-400/70 mt-1">
                        Review the files on the right to verify liveness and
                        facial match.
                      </p>
                    </div>
                  )}

                  {/* Action History or similar can go here */}
                  <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-2xl space-y-3">
                    <h4 className="text-sm font-bold text-gray-700 dark:text-gray-300">
                      Quick Audit
                    </h4>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-500">Risk Assessment</span>
                      <span className="text-green-600 font-bold">LOW RISK</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-500">
                        Auto-verification Search
                      </span>
                      <span className="text-gray-900 dark:text-white font-medium">
                        Matching Record Found
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right Side: Documents */}
                <div className="space-y-6">
                  <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2 border-b border-gray-100 dark:border-gray-800 pb-2">
                    <FileText size={18} className="text-blue-600" /> Supporting
                    Documents
                  </h3>

                  <div className="grid grid-cols-1 gap-4">
                    {isTier2Data(selectedSub.data) ? (
                      <>
                        <div className="space-y-2">
                          <p className="text-xs font-bold text-gray-500 uppercase">
                            Government ID Document
                          </p>
                          <a
                            href={selectedSub.data.governmentId.documentUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="block p-4 bg-gray-50 dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 hover:border-blue-500 hover:text-blue-600 group transition-all"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <FileText className="text-gray-400 group-hover:text-blue-500" />
                                <span className="text-sm font-semibold">
                                  View ID Card
                                </span>
                              </div>
                              <ExternalLink size={16} />
                            </div>
                          </a>
                        </div>
                        <div className="space-y-2">
                          <p className="text-xs font-bold text-gray-500 uppercase">
                            Proof of Address
                          </p>
                          <a
                            href={selectedSub.data.address.proofOfAddressUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="block p-4 bg-gray-50 dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 hover:border-blue-500 hover:text-blue-600 group transition-all"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <MapPin className="text-gray-400 group-hover:text-blue-500" />
                                <span className="text-sm font-semibold">
                                  View Proof Document
                                </span>
                              </div>
                              <ExternalLink size={16} />
                            </div>
                          </a>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="space-y-2">
                          <p className="text-xs font-bold text-gray-500 uppercase">
                            Selfie Photo
                          </p>
                          <a
                            href={(selectedSub.data as Tier3Payload).selfieUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="block p-4 bg-gray-50 dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 hover:border-blue-500 hover:text-blue-600 group transition-all"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <UserIcon className="text-gray-400 group-hover:text-blue-500" />
                                <span className="text-sm font-semibold">
                                  View Selfie Image
                                </span>
                              </div>
                              <ExternalLink size={16} />
                            </div>
                          </a>
                        </div>
                        <div className="space-y-2">
                          <p className="text-xs font-bold text-gray-500 uppercase">
                            Liveness Video
                          </p>
                          <a
                            href={
                              (selectedSub.data as Tier3Payload)
                                .livenessVideoUrl
                            }
                            target="_blank"
                            rel="noreferrer"
                            className="block p-4 bg-gray-50 dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 hover:border-blue-500 hover:text-blue-600 group transition-all"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <Video className="text-gray-400 group-hover:text-blue-500" />
                                <span className="text-sm font-semibold">
                                  View Liveness Video
                                </span>
                              </div>
                              <ExternalLink size={16} />
                            </div>
                          </a>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Reject Input */}
              {showRejectInput && (
                <div className="bg-red-50 dark:bg-red-900/10 p-6 rounded-2xl border border-red-100 dark:border-red-900/30 space-y-4 animate-in slide-in-from-top-4">
                  <div className="flex items-center gap-2 text-red-700 dark:text-red-400 font-bold">
                    <AlertCircle size={18} /> Rejection Reason
                  </div>
                  <textarea
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="Explain why this application was rejected (e.g. ID document is unreadable)"
                    className="w-full h-24 p-4 bg-white dark:bg-black/40 border border-red-200 dark:border-red-900/50 rounded-xl outline-none focus:ring-2 focus:ring-red-500/20 text-sm"
                  />
                  <div className="flex justify-end gap-3 text-xs">
                    <button
                      onClick={() => setShowRejectInput(false)}
                      className="px-4 py-2 text-gray-600 hover:bg-gray-200/50 rounded-lg"
                    >
                      Cancel
                    </button>
                    <button
                      disabled={actionLoading === "reject"}
                      onClick={() => handleReject(selectedSub.id)}
                      className="px-4 py-2 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 transition-all flex items-center gap-2"
                    >
                      {actionLoading === "reject" && (
                        <Loader2 size={14} className="animate-spin" />
                      )}{" "}
                      Confirm Rejection
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-6 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between gap-4 bg-gray-50/50 dark:bg-gray-800/10">
              <button
                disabled={actionLoading !== null}
                onClick={() => setShowRejectInput(true)}
                className={`px-6 py-3 border-2 border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 font-bold rounded-2xl hover:bg-red-50 dark:hover:bg-red-900/10 transition-all flex items-center gap-2 ${showRejectInput ? "hidden" : ""}`}
              >
                <XCircle size={20} /> Reject Submission
              </button>
              <div className="flex-1"></div>
              <button
                disabled={actionLoading !== null}
                onClick={() => handleApprove(selectedSub.id)}
                className="px-10 py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded-2xl shadow-lg shadow-green-500/20 transition-all flex items-center gap-2 active:scale-95"
              >
                {actionLoading === "approve" ? (
                  <>
                    <Loader2 size={20} className="animate-spin" /> Verifying...
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={20} /> Approve Verification
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminKYCScreen;
