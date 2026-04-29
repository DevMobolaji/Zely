// src/modules/kyc/verifiers/kyc.verifier.interface.ts
import { KycSubmissionDocument } from "./kyc.model";

export type KycVerificationStatus =
  | "AUTO_APPROVED"
  | "AUTO_REJECTED"
  | "MANUAL_REVIEW_REQUIRED";

export interface KycVerificationResult {
  status: KycVerificationStatus;
  reason?: string;
  providerReference?: string;
  rawResponse?: any;
}

export interface KycVerifier {
  readonly providerName: string;
  verifyTier2(submission: KycSubmissionDocument): Promise<KycVerificationResult>;
  verifyTier3(submission: KycSubmissionDocument): Promise<KycVerificationResult>;
}
