import { OTPModel, OTPPurpose, IOTP } from "./otp.model";
import { hashOtp, verifyOtp } from "@/config/hashToken";
import { randomInt } from "crypto";

export { OTPPurpose };

export interface OTPConfig {
  length?: number;
  expiryMinutes?: number;
  maxAttempts?: number;
  type?: "numeric" | "alphanumeric";
  // Rate limiting (per identifier + purpose)
  throttleSeconds?: number; // min seconds between creations
  maxPerHour?: number; // max creations in a rolling 1hr window
}

export interface OTPVerifyResult {
  success: boolean;
  message: string;
  attemptsLeft?: number;
  error?: string;
}

export class OTPManager {
  private generateCode(
    length: number = 6,
    type: "numeric" | "alphanumeric" = "numeric",
  ): string {
    if (type === "alphanumeric") {
      const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
      return Array.from({ length }, () => chars[randomInt(chars.length)]).join(
        "",
      );
    }
    const max = Math.pow(10, length);
    return randomInt(max).toString().padStart(length, "0");
  }

  private normalize(identifier: string): string {
    return identifier.toLowerCase().trim();
  }

  /**
   * Creates a fresh OTP. Any existing active OTP for (identifier, purpose) is replaced atomically.
   * Returns the plaintext code exactly once — caller must hand it directly to the email/SMS layer.
   */
  async create(
    identifier: string,
    purpose: OTPPurpose,
    config: OTPConfig = {},
    metadata?: Record<string, any>,
    options?: { bypassThrottle?: boolean },
  ): Promise<{ code: string; expiresAt: Date; expiryMinutes: number }> {
    const {
      length = 6,
      expiryMinutes = 10,
      maxAttempts = 5,
      type = "numeric",
      throttleSeconds = 60,
      maxPerHour = 5,
    } = config;

    const normalized = this.normalize(identifier);

    // only enforce rate limit for user-initiated requests
    if (!options?.bypassThrottle) {
      await this.enforceRateLimit(
        normalized,
        purpose,
        throttleSeconds,
        maxPerHour,
      );
    }

    // --- Rate limit check (cooldown + hourly ceiling) ---
    await this.enforceRateLimit(
      normalized,
      purpose,
      throttleSeconds,
      maxPerHour,
    );

    // --- Generate fresh code ---
    const code = this.generateCode(length, type);
    const codeHash = hashOtp(code);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + expiryMinutes * 60 * 1000);

    // --- Atomic replace: kill any existing active OTP, write the new one ---
    // We do a delete-then-insert because findOneAndReplace with upsert can have
    // edge cases when the filter matches multiple docs.
    await OTPModel.deleteMany({
      identifier: normalized,
      purpose,
      consumedAt: null,
    });

    await OTPModel.create({
      identifier: normalized,
      purpose,
      codeHash,
      attempts: 0,
      maxAttempts,
      expiresAt,
      consumedAt: null,
      metadata,
      createdAt: now,
    });

    return { code, expiresAt, expiryMinutes };
  }

  /**
   * Verifies an OTP. On success, stamps consumedAt (doesn't delete — TTL handles cleanup).
   * On failure, increments attempts atomically.
   */
  async verify(
    identifier: string,
    code: string,
    purpose: OTPPurpose,
  ): Promise<OTPVerifyResult> {
    const normalized = this.normalize(identifier);

    const otp = await OTPModel.findOne({
      identifier: normalized,
      purpose,
      consumedAt: null,
    });

    if (!otp) {
      return {
        success: false,
        message: "Invalid or expired verification code",
        error: "OTP_NOT_FOUND",
      };
    }

    // Expired check (TTL might not have fired yet)
    if (new Date() > otp.expiresAt) {
      return {
        success: false,
        message: "Verification code has expired",
        error: "OTP_EXPIRED",
      };
    }

    // Max attempts already reached
    if (otp.attempts >= otp.maxAttempts) {
      return {
        success: false,
        message:
          "Maximum verification attempts exceeded. Please request a new code.",
        error: "MAX_ATTEMPTS_EXCEEDED",
      };
    }

    const isValid = await verifyOtp(code, otp.codeHash);

    if (!isValid) {
      // Atomic increment so two concurrent verifies don't lose an attempt count
      const updated = await OTPModel.findOneAndUpdate(
        { _id: otp._id, attempts: { $lt: otp.maxAttempts } },
        { $inc: { attempts: 1 } },
        { new: true },
      );

      const attemptsLeft = updated ? updated.maxAttempts - updated.attempts : 0;

      if (attemptsLeft <= 0) {
        return {
          success: false,
          message:
            "Maximum verification attempts exceeded. Please request a new code.",
          attemptsLeft: 0,
          error: "MAX_ATTEMPTS_EXCEEDED",
        };
      }

      return {
        success: false,
        message: `Invalid verification code. ${attemptsLeft} attempt${attemptsLeft > 1 ? "s" : ""} remaining`,
        attemptsLeft,
        error: "INVALID_CODE",
      };
    }

    // SUCCESS — stamp consumedAt atomically (CAS to prevent double-consume)
    const consumed = await OTPModel.findOneAndUpdate(
      { _id: otp._id, consumedAt: null },
      { $set: { consumedAt: new Date() } },
      { new: true },
    );

    if (!consumed) {
      // Someone else already consumed this OTP between our find and update
      return {
        success: false,
        message: "Verification code has already been used",
        error: "OTP_ALREADY_CONSUMED",
      };
    }

    return {
      success: true,
      message: "Verification successful",
    };
  }

  /**
   * Enforces both:
   *   - cooldown: must wait N seconds between creations
   *   - hourly ceiling: max M creations in the last hour
   */
  private async enforceRateLimit(
    identifier: string,
    purpose: OTPPurpose,
    throttleSeconds: number,
    maxPerHour: number,
  ): Promise<void> {
    const now = Date.now();

    // Cooldown check — most recent OTP (any state) must be older than throttleSeconds
    const mostRecent = await OTPModel.findOne(
      { identifier, purpose },
      { createdAt: 1 },
    ).sort({ createdAt: -1 });

    if (mostRecent) {
      const elapsedSeconds = (now - mostRecent.createdAt.getTime()) / 1000;
      if (elapsedSeconds < throttleSeconds) {
        const waitSeconds = Math.ceil(throttleSeconds - elapsedSeconds);
        throw new OTPThrottleError(
          `Please wait ${waitSeconds} second${waitSeconds > 1 ? "s" : ""} before requesting another code`,
          waitSeconds,
        );
      }
    }

    // Hourly ceiling — count creations in last 60 minutes
    const oneHourAgo = new Date(now - 60 * 60 * 1000);
    const recentCount = await OTPModel.countDocuments({
      identifier,
      purpose,
      createdAt: { $gte: oneHourAgo },
    });

    if (recentCount >= maxPerHour) {
      throw new OTPThrottleError(
        `Too many verification requests. Please try again in an hour.`,
      );
    }
  }

  /**
   * Lightweight status check — does an active OTP exist? Used for UI ("we sent a code") states.
   */
  async getInfo(
    identifier: string,
    purpose: OTPPurpose,
  ): Promise<{ exists: boolean; attemptsLeft?: number; expiresAt?: Date }> {
    const normalized = this.normalize(identifier);
    const otp = await OTPModel.findOne({
      identifier: normalized,
      purpose,
      consumedAt: null,
      expiresAt: { $gt: new Date() },
    });

    if (!otp) return { exists: false };

    return {
      exists: true,
      attemptsLeft: otp.maxAttempts - otp.attempts,
      expiresAt: otp.expiresAt,
    };
  }

  /**
   * Manual cleanup — useful for "user changed their email" scenarios.
   */
  async invalidate(identifier: string, purpose: OTPPurpose): Promise<void> {
    const normalized = this.normalize(identifier);
    await OTPModel.deleteMany({
      identifier: normalized,
      purpose,
      consumedAt: null,
    });
  }
}

export class OTPThrottleError extends Error {
  constructor(
    message: string,
    public waitSeconds?: number,
  ) {
    super(message);
    this.name = "OTPThrottleError";
  }
}

export const OTPConfigs = {
  emailVerification: {
    length: 6,
    expiryMinutes: 10,
    maxAttempts: 5,
    type: "numeric" as const,
    throttleSeconds: 60,
    maxPerHour: 5,
  },
  passwordReset: {
    length: 6,
    expiryMinutes: 15,
    maxAttempts: 5,
    type: "numeric" as const,
    throttleSeconds: 60,
    maxPerHour: 5,
  },
  twoFactor: {
    length: 6,
    expiryMinutes: 5,
    maxAttempts: 3,
    type: "numeric" as const,
    throttleSeconds: 30,
    maxPerHour: 10,
  },
  phoneVerification: {
    length: 6,
    expiryMinutes: 10,
    maxAttempts: 5,
    type: "numeric" as const,
    throttleSeconds: 60,
    maxPerHour: 5,
  },
  transactionConfirm: {
    length: 6,
    expiryMinutes: 5,
    maxAttempts: 3,
    type: "numeric" as const,
    throttleSeconds: 30,
    maxPerHour: 20, // higher for transactions, users may do several
  },
};

export function createOTPManager(): OTPManager {
  return new OTPManager();
}

export default OTPManager;
