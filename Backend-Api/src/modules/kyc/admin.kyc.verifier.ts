


import { KycSubmissionDocument } from "./kyc.model";
import { KycVerifier, KycVerificationResult } from "./kyc.verifier.interface";

export class AdminKycVerifier implements KycVerifier {
  readonly providerName = "ADMIN";

  async verifyTier2(_submission: KycSubmissionDocument): Promise<KycVerificationResult> {
    return { status: "MANUAL_REVIEW_REQUIRED" };
  }

  async verifyTier3(_submission: KycSubmissionDocument): Promise<KycVerificationResult> {
    return { status: "MANUAL_REVIEW_REQUIRED" };
  }
}