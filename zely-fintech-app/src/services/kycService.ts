import axios from "axios";
import { axiosPrivate } from "../api/client";
import {
  CloudinaryUploadResult,
  KYCDocumentType,
  KycSubmissionResponse,
  SubmitTier2Payload,
  UploadSignatureResponse,
} from "../types";

export const kycService = {
  getUploadSignature: async (
    documentType: KYCDocumentType,
  ): Promise<UploadSignatureResponse> => {
    const response = await axiosPrivate.post("/kyc/upload-signature", {
      documentType,
    });
    return response.data.data; // matches your { ok, data } response envelope
  },

  uploadDocumentToCloudinary: async (
    file: File,
    signatureData: UploadSignatureResponse,
    onProgress?: (percent: number) => void,
  ): Promise<CloudinaryUploadResult> => {
    const formData = new FormData();

    formData.append("api_key", signatureData.apiKey);
    formData.append("timestamp", String(signatureData.timestamp));
    formData.append("signature", signatureData.signature);
    formData.append("folder", signatureData.folder);
    formData.append("allowed_formats", signatureData.allowedFormats.join(","));
    formData.append("type", signatureData.type);

    formData.append("file", file);

    const uploadUrl = `https://api.cloudinary.com/v1_1/${signatureData.cloudName}/${signatureData.resourceType}/upload`;

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

  submitTier2: async (
    payload: SubmitTier2Payload,
  ): Promise<KycSubmissionResponse> => {
    const response = await axiosPrivate.post("/kyc/upgrade-to-tier-2", payload);
    return response.data.data;
  },

  getMyStatus: async (): Promise<any> => {
    const response = await axiosPrivate.get("/kyc/my-status");
    return response.data.data;
  },
};
