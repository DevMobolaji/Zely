import crypto from "crypto";
import { config } from "@/config/index";
import BadRequestError from "@/shared/errors/badRequest";

export enum KycDocumentType {
  GOVERNMENT_ID = "GOVERNMENT_ID",
  PROOF_OF_ADDRESS = "PROOF_OF_ADDRESS",
  SELFIE = "SELFIE",
  LIVENESS_VIDEO = "LIVENESS_VIDEO",
}

export const DOCUMENT_CONSTRAINTS: Record<
  KycDocumentType,
  {
    allowedFormats: string[];
    maxBytes: number;
    resourceType: "image" | "video" | "auto";
  }
> = {
  [KycDocumentType.GOVERNMENT_ID]: {
    allowedFormats: ["jpg", "jpeg", "png", "pdf"],
    maxBytes: 5 * 1024 * 1024,
    resourceType: "auto", // covers both image and pdf
  },
  [KycDocumentType.PROOF_OF_ADDRESS]: {
    allowedFormats: ["jpg", "jpeg", "png", "pdf"],
    maxBytes: 5 * 1024 * 1024,
    resourceType: "auto",
  },
  [KycDocumentType.SELFIE]: {
    allowedFormats: ["jpg", "jpeg", "png"],
    maxBytes: 5 * 1024 * 1024,
    resourceType: "image",
  },
  [KycDocumentType.LIVENESS_VIDEO]: {
    allowedFormats: ["mp4", "mov"],
    maxBytes: 25 * 1024 * 1024,
    resourceType: "video",
  },
};

export class KycUploadService {
  public generateSignature(
    userPublicId: string,
    documentType: KycDocumentType,
  ) {
    const constraints = DOCUMENT_CONSTRAINTS[documentType];
    if (!constraints) {
      throw new BadRequestError("INVALID_DOCUMENT_TYPE");
    }

    const timestamp = Math.floor(Date.now() / 1000);
    const folder = `kyc/${userPublicId}/${documentType.toLowerCase()}`;

    const paramsToSign = {
      timestamp,
      folder,
      allowed_formats: constraints.allowedFormats.join(","),
      type: "authenticated",
    };

    const signature = this.signParams(paramsToSign);

    return {
      signature,
      timestamp,
      apiKey: config.cloudinary.apiKey,
      cloudName: config.cloudinary.cloudName,
      folder,
      allowedFormats: constraints.allowedFormats,
      maxBytes: constraints.maxBytes,
      resourceType: constraints.resourceType,
      type: "authenticated",
    };
  }

  private signParams(params: Record<string, any>): string {
    const sortedKeys = Object.keys(params).sort();
    const toSign = sortedKeys.map((key) => `${key}=${params[key]}`).join("&");

    return crypto
      .createHash("sha1")
      .update(toSign + config.cloudinary.apiSecret)
      .digest("hex");
  }
}

export default new KycUploadService();
