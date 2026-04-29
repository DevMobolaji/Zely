// src/modules/kyc/verifiers/kyc.verifier.factory.ts
import { config } from "@/config/index";
import { logger } from "@/shared/utils/logger";
import { AdminKycVerifier } from "./admin.kyc.verifier";
import { DojahKycVerifier } from "./dojah.kyc.verifier";
import { KycVerifier } from "./kyc.verifier.interface";

let cachedVerifier: KycVerifier | null = null;

export function getActiveKycVerifier(): KycVerifier {
  if (cachedVerifier) return cachedVerifier;

  const provider = (config.kyc?.provider ?? "ADMIN").toUpperCase();

  switch (provider) {
    case "DOJAH":
      cachedVerifier = new DojahKycVerifier();
      break;
    case "ADMIN":
      cachedVerifier = new AdminKycVerifier();
      break;
    default:
      throw new Error(`Unsupported KYC provider: ${provider}`);
  }

  logger.info(`✅ KYC verifier initialized: ${cachedVerifier.providerName}`);
  return cachedVerifier;
}

// For testing — allows manually overriding the verifier
export function setKycVerifierForTesting(verifier: KycVerifier | null) {
  cachedVerifier = verifier;
}