export const TOPICS = {
  // ======================
  // AUTH DOMAIN
  // ======================
  AUTH_EVENTS: "auth.events",
  AUTH_EVENTS_DLQ: "auth.events.dlq",

  PASSWORD_EVENTS: "password.events",

  // ======================
  // TRANSACTION DOMAIN
  // ======================
  TRANSFER_EVENTS: "transfer.events",
  TRANSFER_EVENTS_DLQ: "transfer.events.dlq",
  CONFIRMED_TRANSFER_EVENTS: "confirmed.transfer.events",
  CONFIRMED_EVENTS: "confirmed.events",

  // ======================
  // AUDIT DOMAIN
  // ======================
  AUDIT_EVENTS: "audit.events",
  AUDIT_EVENTS_DLQ: "audit.events.dlq",

  // ======================
  // VAULT DOMAIN
  // ======================
  VAULT_EVENTS: "vault.events",
  VAULT_EVENTS_DLQ: "vault.events.dlq",

  // ======================
  // KYC DOMAIN
  // ======================
  KYC_EVENTS: "kyc.events",
  KYC_EVENTS_DLQ: "kyc.events.dlq",

  // ======================
  // PAYMENT DOMAIN
  // ======================

  PAYMENT_EVENTS: "payment.events",
  PAYMENT_EVENTS_DLQ: "payment.events.dlq",

  // ======================
  // FUNDING DOMAIN
  // ======================
  FUNDING_EVENTS: "funding.events",
  FUNDING_EVENT_DLQ: "funding.events.dlq",

  // ======================
  // RECONCILIATION DOMAIN
  // ======================

  RECONCILIATION_EVENTS: "reconciliation.events",
  RECONCILIATION_EVENTS_DLQ: "reconciliation.events.dlq",

  // ======================
  // WALLET DOMAIN
  // ======================

  WALLET_EVENTS: "wallet.events",
  WALLET_EVENTS_DLQ: "wallet.events.dlq",
};
