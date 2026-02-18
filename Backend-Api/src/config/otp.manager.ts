import redisClient from "@/infrastructure/cache/redis.cli";
import { hashOtp, verifyOtp } from "./hashToken";



export interface OTPConfig {
  length?: number;           
  expiryMinutes?: number;    
  maxAttempts?: number; 
  type?: 'numeric' | 'alphanumeric';
}

export interface OTPData {
  code: string;
  attempts: number;
  maxAttempts: number;
  expiresAt: Date;
  createdAt: Date;
}

export interface OTPVerifyResult {
  success: boolean;
  message: string;
  attemptsLeft?: number;
  error?: string;
}

export enum OTPPurpose {
  EMAIL_VERIFICATION = 'email_verification',
  PASSWORD_RESET = 'password_reset',
  TWO_FACTOR = 'two_factor',
  PHONE_VERIFICATION = 'phone_verification',
  TRANSACTION_CONFIRM = 'transaction_confirm'
}

export class OTPManager {
  private redis: typeof redisClient
  private prefix: string;

  constructor(redis: typeof redisClient, prefix: string = 'otp') {
    this.redis = redis;
    this.prefix = prefix;
  }

  private generateCode(length: number = 6, type: 'numeric' | 'alphanumeric' = 'numeric'): string {
    if (type === 'alphanumeric') {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      let code = '';
      for (let i = 0; i < length; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return code;
    }

    // Numeric OTP
    const min = Math.pow(10, length - 1);
    const max = Math.pow(10, length) - 1;
    return Math.floor(min + Math.random() * (max - min + 1)).toString();
  }


  private getRedisKey(identifier: string, purpose: OTPPurpose): string {
    return `${this.prefix}:${purpose}:${identifier.toLowerCase()}`;
  }

  async create(
    identifier: string,
    purpose: OTPPurpose,
    config: OTPConfig = {}
  ): Promise<{ code: string; expiresAt: Date; expiryMinutes: number }> {
    const {
      length = 6,
      expiryMinutes = 10,
      maxAttempts = 5,
    } = config;

    const code = this.generateCode(length);
    const hashedOtp = hashOtp(code);
    const redisKey = this.getRedisKey(identifier, purpose);
    const now = Date.now();
    const expiresAt = new Date(now + expiryMinutes * 60 * 1000);

    const otpData: OTPData = {
      code: hashedOtp,
      attempts: 0,
      maxAttempts,
      expiresAt,
      createdAt: new Date()
    };

    // Store in Redis with auto-expiry
    const expirySeconds = expiryMinutes * 60;
    await this.redis.getClient().setex(
      redisKey,
      expirySeconds,
      JSON.stringify(otpData)
    );

    return { code, expiresAt, expiryMinutes };
  }

  async verify(
    identifier: string,
    code: string,
    purpose: OTPPurpose
  ): Promise<OTPVerifyResult> {
    const redisKey = this.getRedisKey(identifier, purpose);

    try {
      const data = await this.redis.getClient().get(redisKey);
      if (!data) return {
        success: false,
        message: 'Invalid or expired verification code',
        error: 'OTP_NOT_FOUND'
      };

      const otpData: OTPData = JSON.parse(data);
      
      // OTP not found or expired
      if (!otpData) {
        return {
          success: false,
          message: 'Invalid or expired verification code',
          error: 'OTP_NOT_FOUND'
        };
      }

      // Check if expired
      if (new Date() > new Date(otpData.expiresAt)) {
        await this.redis.getClient().del(redisKey);
        return {
          success: false,
          message: 'Verification code has expired',
          error: 'OTP_EXPIRED'
        };
      }

      // Check max attempts
      if (otpData.attempts >= otpData.maxAttempts) {
        await this.redis.getClient().del(redisKey);
        return {
          success: false,
          message: 'Maximum verification attempts exceeded!, Please request a new code.',
          error: 'MAX_ATTEMPTS_EXCEEDED'
        };
      }

      const isOtpValid = await verifyOtp(code, otpData.code);
      
      // Verify code
      if (!isOtpValid) {
        // Increment attempts
        otpData.attempts += 1;
        const ttl = await this.redis.getClient().ttl(redisKey);

        if (ttl > 0) {
          await this.redis.getClient().setex(redisKey, ttl, JSON.stringify(otpData));
        }

        const attemptsLeft = otpData.maxAttempts - otpData.attempts;

        if (attemptsLeft <= 0) {
          await this.redis.getClient().del(redisKey);
          return {
            success: false,
            message: 'Maximum verification attempts exceeded!, Please request a new code.',
            attemptsLeft: 0,
            error: 'MAX_ATTEMPTS_EXCEEDED'
          };
        }

        return {
          success: false,
          message: `Invalid verification code. ${attemptsLeft} attempt${attemptsLeft > 1 ? 's' : ''} remaining`,
          attemptsLeft,
          error: 'INVALID_CODE'
        };
      }

      // SUCCESS - Delete OTP
      await this.redis.getClient().del(redisKey);
      await this.redis.getClient().del(`th`);

      return {
        success: true,
        message: 'Verification successful'
      };
    } catch (error) {
      console.error('OTP verification error:', error);
      return {
        success: false,
        message: 'Verification failed',
        error: 'VERIFICATION_ERROR'
      };
    }
  }

  async getInfo(
    identifier: string,
    purpose: OTPPurpose
  ): Promise<{ exists: boolean; attemptsLeft?: number; expiresAt?: Date }> {
    const redisKey = this.getRedisKey(identifier, purpose);

    try {
      const data = await this.redis.getClient().get(redisKey);

      if (!data) {
        return { exists: false };
      }

      const otpData = JSON.parse(data);

      const attemptsLeft = otpData.maxAttempts - otpData.attempts;

      return {
        exists: true,
        attemptsLeft,
        expiresAt: new Date(otpData.expiresAt)
      };
    } catch (error) {
      console.error('OTP info error:', error);
      return { exists: false };
    }
  }

  async delete(identifier: string, purpose: OTPPurpose): Promise<boolean> {
    const redisKey = this.getRedisKey(identifier, purpose);

    try {
      const result = await this.redis.getClient().del(redisKey);
      return result > 0;
    } catch (error) {
      console.error('OTP deletion error:', error);
      return false;
    }
  }

  async shouldThrottle(
    identifier: string,
    purpose: OTPPurpose,
    throttleSeconds: number = 60
  ): Promise<{ shouldThrottle: boolean; waitSeconds?: number }> {
    const redisKey = this.getRedisKey(identifier, purpose);

    try {
      const ttl = await this.redis.getClient().ttl(redisKey);

      if (ttl < 0) {
        return { shouldThrottle: false };
      }

      const data = await this.redis.getClient().get(redisKey);
      if (!data) {
        return { shouldThrottle: false };
      }

      const otpData: OTPData = JSON.parse(data);
      
      const createdAt = new Date(otpData.createdAt).getTime();
      const now = Date.now();
      const elapsedSeconds = (now - createdAt) / 1000;

      if (elapsedSeconds < throttleSeconds) {
        const waitSeconds = Math.ceil(throttleSeconds - elapsedSeconds);
        return {
          shouldThrottle: true,
          waitSeconds
        };
      }

      return { shouldThrottle: false };
    } catch (error) {
      console.error('OTP throttle check error:', error);
      return { shouldThrottle: false };
    }
  }

  async resend(
    identifier: string,
    purpose: OTPPurpose,
    config: OTPConfig = {},
    throttleSeconds: number = 60
  ): Promise<{
    success: boolean;
    code?: string;
    expiresAt?: Date;
    expiryMinutes?: number;
    waitSeconds?: number;
    error?: string
  }> {
    //Check throttle
    const throttleCheck = await this.shouldThrottle(identifier, purpose, throttleSeconds);

    if (throttleCheck.shouldThrottle) {
      return {
        success: false,
        error: 'THROTTLED',
        waitSeconds: throttleCheck.waitSeconds
      };
    }

    // Delete old OTP
    await this.delete(identifier, purpose);

    // Create new OTP
    try {
      const result = await this.create(identifier, purpose, config);
      return {
        success: true,
        ...result
      };
    } catch (error) {
      return {
        success: false,
        error: 'CREATION_FAILED'
      };
    }
  }
}   


export const OTPConfigs = {
  emailVerification: {
    length: 6,
    expiryMinutes: 10,
    maxAttempts: 5,
    type: 'numeric' as const
  },
  passwordReset: {
    length: 6,
    expiryMinutes: 15,
    maxAttempts: 5,
    type: 'numeric' as const
  },
  twoFactor: {
    length: 6,
    expiryMinutes: 5,
    maxAttempts: 3,
    type: 'numeric' as const
  },
  phoneVerification: {
    length: 6,
    expiryMinutes: 10,
    maxAttempts: 5,
    type: 'numeric' as const
  },
  transactionConfirm: {
    length: 6,
    expiryMinutes: 5,
    maxAttempts: 3,
    type: 'numeric' as const
  }
};

export function createOTPManager(redis: typeof redisClient): OTPManager {
  return new OTPManager(redis);
}

export default OTPManager;