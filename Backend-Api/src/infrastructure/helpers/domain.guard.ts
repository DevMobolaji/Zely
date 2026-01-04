export const AccountStatus = {
  PENDING_EMAIL_VERIFICATION: "PENDING_EMAIL_VERIFICATION",
  EMAIL_VERIFIED: "EMAIL_VERIFIED",
  ACCOUNT_PROVISIONING: "ACCOUNT_PROVISIONING",
  ACCOUNT_READY: "ACCOUNT_READY",
  ACTIVE: "ACTIVE",
  SUSPENDED: "SUSPENDED",
} as const;

const allowedTransitions: Record<string, string[]> = {
  PENDING_EMAIL_VERIFICATION: [AccountStatus.EMAIL_VERIFIED],
  EMAIL_VERIFIED: [AccountStatus.ACCOUNT_PROVISIONING],
  ACCOUNT_PROVISIONING: [AccountStatus.ACCOUNT_READY],
  ACCOUNT_READY: [AccountStatus.ACTIVE],
  ACTIVE: [AccountStatus.SUSPENDED],
};


export function assertValidTransition(from: string, to: string) {
  if (!allowedTransitions[from]?.includes(to)) {
    throw new Error(`Invalid account status transition: ${from} → ${to}`);
  }
}
