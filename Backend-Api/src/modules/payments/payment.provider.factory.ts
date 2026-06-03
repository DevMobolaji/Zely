// src/modules/payments/providers/payment.provider.factory.ts
import { config } from "@/config/index";
import { logger } from "@/shared/utils/logger";
import { PaymentProvider } from "./payment.provider.interface";
import { MockProvider } from "./payment.provider.mock";
import { PaystackProvider } from "@/modules/payments/payment.paystack.provider";
//import { PaystackProvider } from "./paystack.provider";  // ← uncomment when we build it

let cachedProvider: PaymentProvider | null = null;

export function getActivePaymentProvider(): PaymentProvider {
  if (cachedProvider) return cachedProvider;

  const providerName = (config.payment?.provider ?? "MOCK").toUpperCase();

  switch (providerName) {
    case "PAYSTACK":
      cachedProvider = new PaystackProvider();
      break;
    case "MOCK":
    default:
      cachedProvider = new MockProvider();
      break;
  }

  logger.info(
    `✅ Payment provider initialized: ${cachedProvider?.providerName}`,
  );
  return cachedProvider;
}

/**
 * Override the active provider — used by tests to inject custom providers.
 * Pass null to clear and force re-resolution from config.
 */
export function setPaymentProviderForTesting(provider: PaymentProvider | null) {
  cachedProvider = provider;
}
