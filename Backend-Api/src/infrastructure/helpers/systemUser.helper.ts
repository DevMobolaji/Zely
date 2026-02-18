import { accountStatus, UserRole } from "@/modules/auth/authinterface";
import User from "@/modules/auth/authmodel";

export async function ensureSystemUser() {
  const existing = await User.findOne({ userId: "SYSTEM_USER" });

  if (existing) {
    return existing;
  }
  
  const user = await User.create({
    userId: "SYSTEM_USER",
    role: UserRole.SYSTEM,
    email: "system@internal",
    name: "System",
    accountStatus: accountStatus.ACTIVE,
  });

  return user
}


