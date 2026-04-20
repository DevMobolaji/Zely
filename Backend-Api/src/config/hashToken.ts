import crypto from "crypto";
import bcrypt from "bcrypt";

export const hashToken = (token: string) => {
    return crypto.createHash("sha256").update(token).digest("hex");
};

export const generateResetToken = async (email: string): Promise<string> => {
    const token = crypto.randomBytes(32).toString('hex');
    return `rst_${token}`;
}

export const generateOTP = (): { otp: string; expires: Date } => {
    const otp = Math.floor(100000 + Math.random() * 900000).toString(); // 6 digits
    const expires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
    return { otp, expires };
}

export const hashOtp = (otp: string) => {
    return bcrypt.hashSync(otp, 10);
}

export function verifyOtp(otp: string, hashedOtp: string): Promise<boolean> {
    return bcrypt.compare(otp, hashedOtp);
}
  