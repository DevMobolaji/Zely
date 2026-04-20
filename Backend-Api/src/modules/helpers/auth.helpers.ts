import { verifyPassword } from "@/config/password";
import redis from "@/infrastructure/cache/redis.cli"

export const storeResetMetadata = async (email: string, metadata: any): Promise<void> => {
  await redis.getClient().setex(
    `password_reset_meta:${email}`,
    15 * 60,
    JSON.stringify(metadata)
    )
}

export const isPasswordInHistory = async (user: any, newPassword: string): Promise <boolean> => {
  if(!user.passwordHistory || user.passwordHistory.length === 0) {
  return false;
}

for (const oldHash of user.passwordHistory) {
  console.log(oldHash)
  const isMatch = await verifyPassword(newPassword, oldHash)
  if (isMatch) {
    return true;
  }
}

return false;
}
    
export const invalidateAllUsrSess = async (email: string): Promise<void> => {
    const keys = await redis.getClient().keys(`refresh_token:*:${email}`);
    if(keys.length > 0) {
    await redis.getClient().del(...keys);
  }
}

// export const checkPasswordStrengthc = async (password: string): Promise<isStrong: boolean | string[]> => {
//   const issues: string[] = [];

//   if (password.length < 8) {
//     issues.push('Password must be at least 8 characters long');
//   }
//   if (!/[a-z]/.test(password)) {
//     issues.push('Password must contain at least one lowercase letter');
//   }
//   if (!/[A-Z]/.test(password)) {
//     issues.push('Password must contain at least one uppercase letter');
//   }
//   if (!/[0-9]/.test(password)) {
//     issues.push('Password must contain at least one number');
//   }
//   if (!/[^a-zA-Z0-9]/.test(password)) {
//     issues.push('Password must contain at least one special character');
//   }

//   // Check against common passwords (simplified)
//   const commonPasswords = ['password', '12345678', 'qwerty', 'abc123'];
//   if (commonPasswords.includes(password.toLowerCase())) {
//     issues.push('Password is too common');
//   }

//   return {
//     isStrong: issues.length === 0,
//     issues
//   };
// }