import axios from "axios";
import { axiosPrivate } from "../api/client";

import {
  KYCDocumentType,
  KYCSubmission,
  KYCTier,
  KYCStatus,
  Tier2Payload,
} from "../types"; // adjust to your actual path

export interface UploadSignatureResponse {
  signature: string;
  timestamp: number;
  apiKey: string;
  cloudName: string;
  folder: string;
  allowedFormats: string[];
  maxBytes: number;
  resourceType: string; // "image" | "auto" | "video" etc.
  type: "authenticated";
}

export interface CloudinaryUploadResult {
  public_id: string;
  secure_url: string;
  format: string;
  bytes: number;
  [key: string]: any;
}

export interface GovernmentIdPayload {
  type: string; // e.g. "DRIVERS_LICENSE"
  number: string;
  documentUrl: string;
}

export interface AddressPayload {
  street: string;
  city: string;
  state: string;
  country: string;
  proofOfAddressUrl: string;
}

export interface SubmitTier2Payload {
  bvn: string;
  nin: string;
  dateOfBirth: string;
  governmentId: GovernmentIdPayload;
  address: AddressPayload;
}

export interface KycSubmissionResponse {
  submissionId: string;
  status: string;
  targetTier: string;
  submittedAt: string;
}

// Shape of the raw document returned by the backend (Mongoose .lean() doc)
// — NOT the same shape the frontend's KYCSubmission type expects. We map
// between the two in mapToKYCSubmission() below.
//
// NOTE: after .populate("userId", "email fullName"), Mongoose replaces the
// `userId` field IN PLACE with the populated object — it does NOT add a
// separate `user` key. So `userId` here is either a raw ObjectId string
// (if population didn't run) or this populated shape (if it did).
interface RawSubmissionDoc {
  _id: string;
  userId: {
    _id: string;
    email?: string;
    name?: string;
  };
  userPublicId: string;
  targetTier: string;
  status: string;
  bvn: string;
  nin: string;
  dateOfBirth: string;
  governmentId: GovernmentIdPayload;
  address: AddressPayload;
  providerName: string;
  submittedAt: string;
  createdAt: string;
  updatedAt: string;
  rejectionReason?: string;
}

/**
 * Maps the raw backend document (Mongoose shape, flat fields, `_id`,
 * populated `userId`) into the frontend's KYCSubmission type (`id`,
 * `tier`, nested `data`). Currently only handles tier-2 shaped docs —
 * extend the `data` branch if/when tier-3 admin review needs the same
 * treatment.
 */
function mapToKYCSubmission(doc: RawSubmissionDoc): KYCSubmission {
  const tier2Data: Tier2Payload = {
    bvn: doc.bvn,
    nin: doc.nin,
    dateOfBirth: doc.dateOfBirth,
    governmentId: doc.governmentId as Tier2Payload["governmentId"],
    address: doc.address,
  };

  return {
    id: doc._id,
    userId: doc.userPublicId,
    userEmail: doc?.userId.email,
    userName: doc?.userId.name,
    tier: doc.targetTier as KYCTier,
    status: doc.status as KYCStatus,
    submittedAt: doc.submittedAt,
    rejectionReason: doc.rejectionReason,
    data: tier2Data,
  };
}

export const kycService = {
  /**
   * Step 1: Ask our backend for a signed Cloudinary upload payload.
   * Backend derives the user's folder from the auth context (ctx.userId) —
   * we only need to tell it which document type we're uploading.
   */
  getUploadSignature: async (
    documentType: KYCDocumentType,
  ): Promise<UploadSignatureResponse> => {
    const response = await axiosPrivate.post("/kyc/upload-signature", {
      documentType,
    });
    return response.data.data; // matches your { ok, data } response envelope
  },

  /**
   * Step 2: Upload the file directly to Cloudinary using the signed payload.
   * IMPORTANT: every field included in the original signature on the backend
   * (timestamp, folder, allowed_formats, type) MUST be sent here, with the
   * exact same values — any mismatch causes an "Invalid Signature" rejection.
   * This call goes straight to Cloudinary, not through our own backend.
   */
  uploadDocumentToCloudinary: async (
    file: File,
    signatureData: UploadSignatureResponse,
    onProgress?: (percent: number) => void,
  ): Promise<CloudinaryUploadResult> => {
    const formData = new FormData();

    // Signed params — must match exactly what the backend signed
    formData.append("api_key", signatureData.apiKey);
    formData.append("timestamp", String(signatureData.timestamp));
    formData.append("signature", signatureData.signature);
    formData.append("folder", signatureData.folder);
    formData.append("allowed_formats", signatureData.allowedFormats.join(","));
    formData.append("type", signatureData.type);

    // The actual file — always last, doesn't participate in signing
    formData.append("file", file);

    const uploadUrl = `https://api.cloudinary.com/v1_1/${signatureData.cloudName}/${signatureData.resourceType}/upload`;

    // Plain axios (not axiosPrivate) — this request goes to Cloudinary,
    // not our backend, so it must NOT carry our app's auth header.
    const response = await axios.post(uploadUrl, formData, {
      headers: { "Content-Type": "multipart/form-data" },
      onUploadProgress: (event) => {
        if (onProgress && event.total) {
          const percent = Math.round((event.loaded * 100) / event.total);
          onProgress(percent);
        }
      },
    });

    return response.data;
  },

  /**
   * Step 3: Submit the tier-2 KYC application once all required documents
   * have been uploaded and you have their secure_url values.
   */
  upgradeToTier2: async (
    payload: SubmitTier2Payload,
  ): Promise<KycSubmissionResponse> => {
    const response = await axiosPrivate.post("/kyc/upgrade-to-tier-2", payload);
    return response.data.data;
  },

  /**
   * Check the current user's KYC status.
   */
  getMyStatus: async (): Promise<any> => {
    const response = await axiosPrivate.get("/kyc/my-status");
    return response.data.data;
  },

  // ---------------------------------------------------------------------
  // Admin endpoints
  // ---------------------------------------------------------------------

  /**
   * Admin: list all submissions currently pending review.
   */
  getPendingSubmissions: async (): Promise<KYCSubmission[]> => {
    const response = await axiosPrivate.get("/admin/kyc/pending");
    const docs: RawSubmissionDoc[] = response.data.data;
    return docs.map(mapToKYCSubmission);
  },

  /**
   * Admin: get full detail for a single submission (used by the review modal).
   */
  getSubmissionDetail: async (submissionId: string): Promise<KYCSubmission> => {
    const response = await axiosPrivate.get(`/admin/kyc/${submissionId}`);
    return mapToKYCSubmission(response.data.data);
  },

  /**
   * Admin: approve a pending submission.
   */
  approveSubmission: async (submissionId: string): Promise<void> => {
    await axiosPrivate.post(`/admin/kyc/${submissionId}/approve`);
  },

  /**
   * Admin: reject a pending submission with a reason (5-500 chars,
   * matching the validation already enforced in AdminKYCScreen).
   */
  rejectSubmission: async (
    submissionId: string,
    reason: string,
  ): Promise<void> => {
    await axiosPrivate.post(`/admin/kyc/${submissionId}/reject`, { reason });
  },
};
