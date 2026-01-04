import { config } from '@/config/index';
import { Resend } from 'resend';
import { logger } from '@/shared/utils/logger';
import BadRequestError from '@/shared/errors/badRequest';
import redis from '../cache/redis.cli';

const resend = new Resend(config?.email?.apiKey);

export class EmailService {

  // Send email verification with OTP
  static async sendVerificationEmail(email: string, name: string, otp: string) {
    try {
      const { data, error } = await resend.emails.send({
        from: 'Zely <onboarding@resend.dev>',
        to: email,
        subject: 'Verify Your Email Address',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Welcome to ${config?.app?.name}, ${name}!</h2>
            <p>Thank you for registering. Please verify your email address to activate your account.</p>
            <p>Your verification code is:</p>
            <div style="background-color: #f5f5f5; padding: 20px; text-align: center; margin: 20px 0; border-radius: 8px;">
              <h1 style="margin: 0; color: #007bff; font-size: 36px; letter-spacing: 8px;">${otp}</h1>
            </div>
            <p>Enter this code in the app to verify your email.</p>
            <p style="color: #999; font-size: 12px; margin-top: 24px;">
              This code will expire in 10 minutes. If you didn't create an account, please ignore this email.
            </p>
          </div>
        `,
      });

      if (error) {
        logger.error('Failed to send verification email', { email, error });
        throw new Error('Failed to send verification email');
      }

      logger.info('Verification email sent', { email, messageId: data?.id });
      return data;

    } catch (error) {
      logger.error('Email service error', error);
      throw error;
    }
  }

  // Send password reset with OTP
  static async sendPasswordResetEmail(email: string, firstName: string, otp: string) {
    try {
      const { data, error } = await resend.emails.send({
        from: `${config?.email?.fromName} <${config?.email?.from}>`,
        to: email,
        subject: 'Reset Your Password',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Password Reset Request</h2>
            <p>Hi ${firstName},</p>
            <p>We received a request to reset your password. Use the code below to reset your password:</p>
            <div style="background-color: #f5f5f5; padding: 20px; text-align: center; margin: 20px 0; border-radius: 8px;">
              <h1 style="margin: 0; color: #dc3545; font-size: 36px; letter-spacing: 8px;">${otp}</h1>
            </div>
            <p>Enter this code in the app to reset your password.</p>
            <p style="color: #999; font-size: 12px; margin-top: 24px;">
              This code will expire in 10 minutes. If you didn't request this, please ignore this email and your password will remain unchanged.
            </p>
          </div>
        `,
      });

      if (error) {
        logger.error('Failed to send reset email', { email, error });
        throw new Error('Failed to send reset email');
      }

      logger.info('Password reset email sent', { email, messageId: data?.id });
      return data;

    } catch (error) {
      logger.error('Email service error', error);
      throw error;
    }
  }

  // Send welcome email (after verification)
  static async sendWelcomeEmail(email: string, name: string) {
    try {
      const { data, error } = await resend.emails.send({
        from: 'Zely <onboarding@resend.dev>',
        to: email,
        subject: `Welcome to ${config?.app?.name}!`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Welcome aboard, ${name}! 🎉</h2>
            <p>Your email has been verified successfully. Your account is now active!</p>
            <p>You can now:</p>
            <ul>
              <li>Create your first account</li>
              <li>Make transactions</li>
              <li>Manage your finances</li>
            </ul>
            <p>Thank you for choosing ${config?.app?.name}!</p>
          </div>
        `,
      });

      if (error) {
        logger.error('Failed to send welcome email', { email, error });
      }

      logger.info('Welcome email sent', { email, messageId: data?.id });
      return data;

    } catch (error) {
      logger.error('Email service error', error);
    }
  }
}

const ATTEMPT_LIMIT = 5; // max 5 attempts
const ATTEMPT_WINDOW = 10 * 60; // 10 minutes in seconds

export async function checkOtpRateLimit(email: string) {
  const key = `otp-attempts:${email}`;
  const attempts = await redis.getClient().incr(key);

  if (attempts === 1) {
    await redis.getClient().expire(key, ATTEMPT_WINDOW);
  }

  if (attempts > ATTEMPT_LIMIT) {
    throw new BadRequestError(
      "Too many verification attempts. Please try again later."
    );
  }
}

export async function resetOtpRateLimit(email: string) {
  await redis.getClient().del(`otp-attempts:${email}`);
}


const RESEND_LIMIT = 3; // 3 resends per hour
const RESEND_WINDOW = 60 * 60; // seconds

export async function checkResendRateLimit(email: string) {
  const key = `otp-resend:${email}`;
  const count = await redis.getClient().incr(key);
  if (count === 1) await redis.getClient().expire(key, RESEND_WINDOW);
  if (count > RESEND_LIMIT) throw new BadRequestError("Resend limit reached.");
}