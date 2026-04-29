// src/modules/kyc/verifiers/dojah.kyc.verifier.ts
import { logger } from "@/shared/utils/logger";
import { KycSubmissionDocument } from "./kyc.model";
import { KycVerifier, KycVerificationResult } from "./kyc.verifier.interface";

/**
 * Dojah KYC verifier — wires real BVN/NIN/liveness verification.
 * Currently a skeleton with TODOs. Fill in axios calls when ready to go live.
 *
 * Docs: https://dojah.io/documentation
 */
export class DojahKycVerifier implements KycVerifier {
  readonly providerName = "DOJAH";

  async verifyTier2(submission: KycSubmissionDocument): Promise<KycVerificationResult> {
    logger.warn("DojahKycVerifier.verifyTier2 not implemented — falling back to manual review");

    // TODO: Implement Dojah Tier 2 verification flow
    // 1. POST /api/v1/kyc/bvn/full → get BVN data (DOB, name, phone)
    // 2. Compare returned DOB with submission.dateOfBirth
    //    Mismatch → return { status: "AUTO_REJECTED", reason: "BVN_DOB_MISMATCH" }
    // 3. POST /api/v1/kyc/nin → verify NIN
    //    Invalid → return { status: "AUTO_REJECTED", reason: "NIN_INVALID" }
    // 4. POST /api/v1/document/analysis → OCR government ID, validate fields match
    //    Mismatch → return { status: "AUTO_REJECTED", reason: "ID_DOCUMENT_MISMATCH" }
    // 5. All checks pass → return { status: "AUTO_APPROVED", providerReference, rawResponse }
    // 6. On API error/timeout → return { status: "MANUAL_REVIEW_REQUIRED" } so admin reviews

    return { status: "MANUAL_REVIEW_REQUIRED", reason: "DOJAH_NOT_IMPLEMENTED" };
  }

  async verifyTier3(submission: KycSubmissionDocument): Promise<KycVerificationResult> {
    logger.warn("DojahKycVerifier.verifyTier3 not implemented — falling back to manual review");

    // TODO: Implement Dojah Tier 3 verification flow
    // 1. POST /api/v1/kyc/liveness → send livenessVideoUrl
    //    Failed → return { status: "AUTO_REJECTED", reason: "LIVENESS_FAILED" }
    // 2. POST /api/v1/kyc/photoid → face match selfie vs government ID photo
    //    Confidence < 0.85 → return { status: "AUTO_REJECTED", reason: "FACE_MATCH_FAILED" }
    // 3. Both pass → return { status: "AUTO_APPROVED", providerReference, rawResponse }

    return { status: "MANUAL_REVIEW_REQUIRED", reason: "DOJAH_NOT_IMPLEMENTED" };
  }
}