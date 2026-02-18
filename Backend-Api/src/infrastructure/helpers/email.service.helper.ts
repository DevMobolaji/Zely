import { config } from '@/config/index';
import { Resend } from 'resend';
import { logger } from '@/shared/utils/logger';
import BadRequestError from '@/shared/errors/badRequest';
import redis from '../cache/redis.cli';

const resend = new Resend(config?.email?.apiKey);

// types.ts
export interface SendCreditNotificationParams {
  recipientEmail: string;
  recipientName: string;
  senderName: string;
  senderEmail: string;
  amount: number;
  currencySymbol: string;
  transactionId: string;
  referenceId: string;
  referenceType: string;
  transactionDate: string;
  previousBalance: number;
  newBalance: number;
  senderMessage?: string;
  transactionLink: string;
}

interface BaseTransferParams {
  recipientEmail: string;
  recipientName: string;
  amount: number;
  currencySymbol: string;
  transactionId: string;
  referenceId: string;
  transactionDate: string;
  transactionLink: string;
}

export interface P2PTransferNotificationParams extends BaseTransferParams {
  senderName: string;
  senderAccountLast4: string;
  recipientAccountLast4: string;
  senderMessage?: string;
  previousBalance: number;
  newBalance: number;
}

export interface InternalTransferNotificationParams extends BaseTransferParams {
  fromAccountType: string; // e.g. "Checking"
  toAccountType: string;   // e.g. "Savings"
  fromAccountLast4: string;
  toAccountLast4: string;
  fromPreviousBalance: number;
  fromNewBalance: number;
  toPreviousBalance: number;
  toNewBalance: number;
  type: string;
}


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
  static async sendPasswordResetEmail(email: string, name: string, otp: string, expiryMinutes: number) {
    try {
      const { data, error } = await resend.emails.send({
        from: 'Zely <onboarding@resend.dev>',
        to: email,
        subject: 'Reset Your Password',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Password Reset Request</h2>
            <p>Hi ${name},</p>
            <p>We received a request to reset your password. Use the code below to reset your password:</p>
            <div style="background-color: #f5f5f5; padding: 20px; text-align: center; margin: 20px 0; border-radius: 8px;">
              <h1 style="margin: 0; color: #dc3545; font-size: 36px; letter-spacing: 8px;">${otp}</h1>
            </div>
            <p>Enter this code in the app to reset your password.</p>
            <p style="color: #999; font-size: 12px; margin-top: 24px;">
              This code will expire in ${expiryMinutes} minutes. If you didn't request this, please ignore this email and your password will remain unchanged.
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

  static async sendPasswordResetSuccessEmail(email: string, name: string) {
    try {
      const { data, error } = await resend.emails.send({
        from: 'Zely <onboarding@resend.dev>',
        to: email,
        subject: 'Password Reset Successful',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Password Successfully Reset</h2>
            <p>Hi ${name},</p>
            <p>Your password for ${config?.app?.name} has been successfully reset.</p>
            <div style="background-color: #e8f5e9; padding: 20px; text-align: center; margin: 20px 0; border-radius: 8px; border-left: 4px solid #4caf50;">
              <p style="margin: 0; color: #2e7d32; font-size: 18px; font-weight: bold;">✓ Password Reset Complete</p>
            </div>
            <p>You can now log in to your account using your new password.</p>
            <p style="margin-top: 24px;">If you did not make this change or if you believe an unauthorized person has accessed your account, please contact our support team immediately.</p>
            <p style="color: #999; font-size: 12px; margin-top: 24px;">
              This is an automated security notification from ${config?.app?.name}. For your security, we recommend using a strong, unique password.
            </p>
          </div>
        `,
      });

      if (error) {
        console.error('Error sending password reset success email:', error);
        throw new Error('Failed to send password reset success email');
      }

      return data;
    } catch (error) {
      console.error('Password reset success email error:', error);
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

  // send transfer notification
  static async sendTransferNotification(params: SendCreditNotificationParams) {
    const {
      recipientEmail,
      recipientName,
      senderName,
      senderEmail,
      amount,
      currencySymbol,
      transactionId,
      referenceId,
      referenceType,
      transactionDate,
      previousBalance,
      newBalance,
      senderMessage,
      transactionLink,
    } = params;

    const platformName = config?.app?.name || 'Zely';
    const supportEmail = 'support@zely.com';
    const companyAddress = '123 Business Street, Lagos, Nigeria';
    const currentYear = new Date().getFullYear();

    try {
      const { data, error } = await resend.emails.send({
        from: `${platformName} <onboarding@resend.dev>`,
        to: recipientEmail,
        subject: `You've received ${currencySymbol}${amount.toLocaleString()} from ${senderName}`,
        html: `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Payment Received</title>
        </head>
        <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f6f9fc; line-height: 1.6;">
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f6f9fc;">
                <tr>
                    <td style="padding: 40px 20px;">
                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
                            
                            <!-- Header -->
                            <tr>
                                <td style="padding: 40px 40px 20px; text-align: center; border-bottom: 1px solid #e6e9ef;">
                                    <h1 style="margin: 0; font-size: 24px; font-weight: 600; color: #1a1a1a;">
                                        ${platformName}
                                    </h1>
                                </td>
                            </tr>
                            
                            <!-- Success Icon -->
                            <tr>
                                <td style="padding: 40px 40px 20px; text-align: center;">
                                    <div style="display: inline-block; width: 64px; height: 64px; background-color: #10b981; border-radius: 50%;">
                                        <svg width="64" height="64" viewBox="0 0 64 64" style="display: block;">
                                            <path d="M20 32l8 8 16-16" stroke="#ffffff" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
                                        </svg>
                                    </div>
                                </td>
                            </tr>
                            
                            <!-- Main Content -->
                            <tr>
                                <td style="padding: 0 40px 30px;">
                                    <h2 style="margin: 0 0 10px; font-size: 28px; font-weight: 600; color: #1a1a1a; text-align: center;">
                                        Payment Received!
                                    </h2>
                                    <p style="margin: 0; font-size: 16px; color: #6b7280; text-align: center;">
                                        Hi ${recipientName}, you've received a payment
                                    </p>
                                </td>
                            </tr>
                            
                            <!-- Amount Highlight -->
                            <tr>
                                <td style="padding: 0 40px 30px;">
                                    <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 12px; padding: 30px; text-align: center;">
                                        <p style="margin: 0 0 8px; font-size: 14px; color: rgba(2, 1, 1, 0.9); text-transform: uppercase; letter-spacing: 1px; font-weight: 500;">
                                            Amount Credited
                                        </p>
                                        <h3 style="margin: 0; font-size: 42px; font-weight: 700; color: #040404ff;">
                                            ${currencySymbol}${amount.toLocaleString()}
                                        </h3>
                                    </div>
                                </td>
                            </tr>
                            
                            <!-- Transaction Details -->
                            <tr>
                                <td style="padding: 0 40px 30px;">
                                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f9fafb; border-radius: 8px; padding: 24px;">
                                        <tr>
                                            <td style="padding: 8px 0;">
                                                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                                    <tr>
                                                        <td style="font-size: 14px; color: #6b7280; font-weight: 500;">From</td>
                                                        <td style="font-size: 14px; color: #1a1a1a; font-weight: 600; text-align: right;">${senderName}</td>
                                                    </tr>
                                                </table>
                                            </td>
                                        </tr>
                                        <tr>
                                            <td style="padding: 8px 0; border-top: 1px solid #e5e7eb;">
                                                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                                    <tr>
                                                        <td style="font-size: 14px; color: #6b7280; font-weight: 500;">Sender Email</td>
                                                        <td style="font-size: 14px; color: #1a1a1a; font-weight: 600; text-align: right;">${senderEmail}</td>
                                                    </tr>
                                                </table>
                                            </td>
                                        </tr>
                                        <tr>
                                            <td style="padding: 8px 0; border-top: 1px solid #e5e7eb;">
                                                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                                    <tr>
                                                        <td style="font-size: 14px; color: #6b7280; font-weight: 500;">Date & Time</td>
                                                        <td style="font-size: 14px; color: #1a1a1a; font-weight: 600; text-align: right;">${transactionDate}</td>
                                                    </tr>
                                                </table>
                                            </td>
                                        </tr>
                                        <tr>
                                            <td style="padding: 8px 0; border-top: 1px solid #e5e7eb;">
                                                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                                    <tr>
                                                        <td style="font-size: 14px; color: #6b7280; font-weight: 500;">Transaction ID</td>
                                                        <td style="font-size: 14px; color: #1a1a1a; font-weight: 600; text-align: right; font-family: monospace;">${transactionId}</td>
                                                    </tr>
                                                </table>
                                            </td>
                                        </tr>
                                        <tr>
                                            <td style="padding: 8px 0; border-top: 1px solid #e5e7eb;">
                                                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                                    <tr>
                                                        <td style="font-size: 14px; color: #6b7280; font-weight: 500;">Reference ID</td>
                                                        <td style="font-size: 14px; color: #1a1a1a; font-weight: 600; text-align: right; font-family: monospace;">${referenceId}</td>
                                                    </tr>
                                                </table>
                                            </td>
                                        </tr>
                                        <tr>
                                            <td style="padding: 8px 0; border-top: 1px solid #e5e7eb;">
                                                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                                    <tr>
                                                        <td style="font-size: 14px; color: #6b7280; font-weight: 500;">Reference Type</td>
                                                        <td style="font-size: 14px; color: #1a1a1a; font-weight: 600; text-align: right; font-family: monospace;">${referenceType}</td>
                                                    </tr>
                                                </table>
                                            </td>
                                        </tr>
                                        <tr>
                                            <td style="padding: 8px 0; border-top: 1px solid #e5e7eb;">
                                                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                                    <tr>
                                                        <td style="font-size: 14px; color: #6b7280; font-weight: 500;">Status</td>
                                                        <td style="text-align: right;">
                                                            <span style="display: inline-block; padding: 4px 12px; background-color: #d1fae5; color: #065f46; border-radius: 12px; font-size: 12px; font-weight: 600;">
                                                                ✓ Completed
                                                            </span>
                                                        </td>
                                                    </tr>
                                                </table>
                                            </td>
                                        </tr>
                                    </table>
                                </td>
                            </tr>
                            
                            ${senderMessage ? `
                            <!-- Message from Sender -->
                            <tr>
                                <td style="padding: 0 40px 30px;">
                                    <div style="background-color: #fffbeb; border-left: 4px solid #f59e0b; border-radius: 6px; padding: 16px 20px;">
                                        <p style="margin: 0 0 4px; font-size: 12px; color: #92400e; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">
                                            Message from ${senderName}
                                        </p>
                                        <p style="margin: 0; font-size: 14px; color: #78350f; font-style: italic;">
                                            "${senderMessage}"
                                        </p>
                                    </div>
                                </td>
                            </tr>
                            ` : ''}
                            
                            <!-- New Balance -->
                            <tr>
                                <td style="padding: 0 40px 30px;">
                                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                        <tr>
                                            <td style="font-size: 14px; color: #6b7280; font-weight: 500; padding: 12px 0; border-top: 2px solid #e5e7eb;">
                                                Previous Balance
                                            </td>
                                            <td style="font-size: 14px; color: #1a1a1a; font-weight: 600; text-align: right; padding: 12px 0; border-top: 2px solid #e5e7eb;">
                                                ${currencySymbol}${previousBalance.toLocaleString()}
                                            </td>
                                        </tr>
                                        <tr>
                                            <td style="font-size: 14px; color: #6b7280; font-weight: 500; padding: 12px 0;">
                                                Amount Credited
                                            </td>
                                            <td style="font-size: 14px; color: #10b981; font-weight: 600; text-align: right; padding: 12px 0;">
                                                + ${currencySymbol}${amount.toLocaleString()}
                                            </td>
                                        </tr>
                                        <tr>
                                            <td style="font-size: 16px; color: #1a1a1a; font-weight: 700; padding: 12px 0; border-top: 2px solid #1a1a1a;">
                                                New Balance
                                            </td>
                                            <td style="font-size: 18px; color: #1a1a1a; font-weight: 700; text-align: right; padding: 12px 0; border-top: 2px solid #1a1a1a;">
                                                ${currencySymbol}${newBalance.toLocaleString()}
                                            </td>
                                        </tr>
                                    </table>
                                </td>
                            </tr>
                            
                            <!-- CTA Button -->
                            <tr>
                                <td style="padding: 0 40px 40px; text-align: center;">
                                    <a href="${transactionLink}" style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #111111ff; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">
                                        View Transaction Details
                                    </a>
                                </td>
                            </tr>
                            
                            <!-- Security Notice -->
                            <tr>
                                <td style="padding: 0 40px 40px;">
                                    <div style="background-color: #eff6ff; border-radius: 8px; padding: 20px; border: 1px solid #bfdbfe;">
                                        <p style="margin: 0 0 10px; font-size: 13px; color: #1e40af; font-weight: 600;">
                                            🔒 Security Reminder
                                        </p>
                                        <p style="margin: 0; font-size: 13px; color: #1e40af; line-height: 1.5;">
                                            This transaction was processed securely. If you didn't expect this payment or notice any suspicious activity, please contact our support team immediately at ${supportEmail}.
                                        </p>
                                    </div>
                                </td>
                            </tr>
                            
                            <!-- Footer -->
                            <tr>
                                <td style="padding: 30px 40px; background-color: #f9fafb; border-top: 1px solid #e5e7eb; border-radius: 0 0 8px 8px;">
                                    <p style="margin: 0 0 10px; font-size: 13px; color: #6b7280; text-align: center;">
                                        Need help? Contact us at <a href="mailto:${supportEmail}" style="color: #667eea; text-decoration: none;">${supportEmail}</a>
                                    </p>
                                    <p style="margin: 0; font-size: 12px; color: #9ca3af; text-align: center;">
                                        © ${currentYear} ${platformName}. All rights reserved.
                                    </p>
                                    <p style="margin: 10px 0 0; font-size: 11px; color: #9ca3af; text-align: center;">
                                        ${companyAddress}
                                    </p>
                                </td>
                            </tr>
                            
                        </table>
                    </td>
                </tr>
            </table>
        </body>
        </html>
      `,
      });

      if (error) {
        logger.error('Failed to send credit notification email', {
          recipientEmail,
          transactionId,
          error
        });
        throw new Error('Failed to send credit notification email');
      }

      logger.info('Credit notification email sent', {
        recipientEmail,
        transactionId,
        messageId: data?.id
      });

      return data;

    } catch (error) {
      logger.error('Email service error', error);
      throw error;
    }
  }

  /**
   * Sends a P2P (peer-to-peer) transfer success email to the recipient.
   */

  // send internal transfer notification
  static async sendInternalTransferNotifications(internalTransferParams: any) {
    const {
      recipientEmail,
      transferType,
      type,
      amount,
      currencySymbol,
      transactionId,
      referenceId,
      transactionDate,
      fromAccountType,
      fromAccountLast4,
      toAccountType,
      toAccountLast4,
      fromPreviousBalance,
      fromNewBalance,
      toPreviousBalance,
      toNewBalance,
      transactionLink,
    } = internalTransferParams

    const platformName = config?.app?.name || 'Zely';
    const supportEmail = 'support@zely.com';
    const companyAddress = '123 Business Street, Lagos, Nigeria';
    const currentYear = new Date().getFullYear();

    const isInternal = transferType === 'INTERNAL_TRANSFER';
    const isDebit = type === 'DEBIT';
    const isCredit = type === 'CREDIT';

    const title =
      isInternal ? 'Internal Transfer Completed'
        : isDebit ? 'Debit Successful'
          : 'Credit Successful';

    const subtitle =
      isInternal
        ? 'Your transfer between your accounts was successful'
        : isDebit
          ? 'Your account has been debited successfully'
          : 'Your account has been credited successfully';

    const primaryColor =
      isDebit ? '#b91c1c'
        : isCredit ? '#047857'
          : '#1d4ed8';

    const subject = `${title} · ${currencySymbol}${amount.toLocaleString()}`;

    const fromAccountLabel = fromAccountType
      ? `${fromAccountType} ••••${fromAccountLast4}`
      : '';

    const toAccountLabel = toAccountType
      ? `${toAccountType} ••••${toAccountLast4}`
      : '';

    const html = `
  <!DOCTYPE html>
  <html lang="en">
  <body style="margin:0;padding:0;background:#f6f9fc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
  <tr>
  <td align="center" style="padding:40px 16px;">
  <table width="600" cellpadding="0" cellspacing="0" role="presentation" style="background:#ffffff;border-radius:8px;overflow:hidden;">
  
  <!-- HEADER -->
  <tr>
  <td align="center" style="padding:28px 32px;border-bottom:1px solid #e5e7eb;">
  <h1 style="margin:0;font-size:20px;color:#111827;">${platformName}</h1>
  </td>
  </tr>
  
  <!-- TITLE -->
  <tr>
  <td align="center" style="padding:28px 32px 12px;">
  <h2 style="margin:0 0 6px;font-size:22px;color:#111827;">${title}</h2>
  <p style="margin:0;font-size:14px;color:#6b7280;">${subtitle}</p>
  </td>
  </tr>
  
  <!-- AMOUNT -->
  <tr>
  <td style="padding:0 32px 28px;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
  style="background:${primaryColor};border-radius:12px;">
  <tr>
  <td align="center" style="padding:26px;">
  <p style="margin:0;font-size:11px;letter-spacing:0.12em;color:#e5e7eb;">
  AMOUNT
  </p>
  <p style="margin:8px 0 0;font-size:34px;font-weight:700;color:#ffffff;">
  ${currencySymbol}${amount.toLocaleString()}
  </p>
  </td>
  </tr>
  </table>
  </td>
  </tr>
  
  <!-- DETAILS -->
  <tr>
  <td style="padding:0 32px 24px;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
  style="background:#f9fafb;border-radius:8px;">
  ${fromAccountLabel ? `
  <tr>
  <td style="padding:12px 16px;font-size:13px;color:#6b7280;">From</td>
  <td align="right" style="padding:12px 16px;font-size:13px;font-weight:600;color:#111827;">
  ${fromAccountLabel}
  </td>
  </tr>` : ''}
  
  ${toAccountLabel ? `
  <tr>
  <td style="padding:12px 16px;font-size:13px;color:#6b7280;">To</td>
  <td align="right" style="padding:12px 16px;font-size:13px;font-weight:600;color:#111827;">
  ${toAccountLabel}
  </td>
  </tr>` : ''}
  
  <tr>
  <td style="padding:12px 16px;font-size:13px;color:#6b7280;">Date</td>
  <td align="right" style="padding:12px 16px;font-size:13px;color:#111827;">
  ${transactionDate}
  </td>
  </tr>
  
  <tr>
  <td style="padding:12px 16px;font-size:13px;color:#6b7280;">Transaction ID</td>
  <td align="right" style="padding:12px 16px;font-family:monospace;font-size:12px;color:#111827;">
  ${transactionId}
  </td>
  </tr>
  
  <tr>
  <td style="padding:12px 16px;font-size:13px;color:#6b7280;">Reference</td>
  <td align="right" style="padding:12px 16px;font-family:monospace;font-size:12px;color:#111827;">
  ${referenceId}
  </td>
  </tr>
  </table>
  </td>
  </tr>
  
  <!-- BALANCES (internal shows both sides) -->
  ${isInternal ? `
  <tr>
  <td style="padding:0 32px 24px;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
  <tr>
  <td style="font-size:13px;color:#6b7280;">From Balance</td>
  <td align="right" style="font-size:13px;">
  ${currencySymbol}${fromPreviousBalance?.toLocaleString()} → 
  <strong>${currencySymbol}${fromNewBalance?.toLocaleString()}</strong>
  </td>
  </tr>
  <tr>
  <td style="padding-top:8px;font-size:13px;color:#6b7280;">To Balance</td>
  <td align="right" style="padding-top:8px;font-size:13px;">
  ${currencySymbol}${toPreviousBalance?.toLocaleString()} → 
  <strong>${currencySymbol}${toNewBalance?.toLocaleString()}</strong>
  </td>
  </tr>
  </table>
  </td>
  </tr>` : ''}
  
  <!-- CTA -->
  <tr>
  <td align="center" style="padding:8px 32px 36px;">
  <a href="${transactionLink}"
  style="display:inline-block;padding:12px 28px;background:#111827;color:#ffffff;
  text-decoration:none;border-radius:6px;font-size:14px;font-weight:600;">
  View Transaction
  </a>
  </td>
  </tr>
  
  <!-- FOOTER -->
  <tr>
  <td align="center" style="padding:20px;background:#f9fafb;font-size:12px;color:#9ca3af;">
  <p style="margin:0 0 6px;">
  Need help? <a href="mailto:${supportEmail}" style="color:#2563eb;text-decoration:none;">
  ${supportEmail}
  </a>
  </p>
  <p style="margin:0;">© ${currentYear} ${platformName}</p>
  <p style="margin:6px 0 0;">${companyAddress}</p>
  </td>
  </tr>
  
  </table>
  </td>
  </tr>
  </table>
  </body>
  </html>
  `;

    const { data, error } = await resend.emails.send({
      from: `${platformName} <onboarding@resend.dev>`,
      to: recipientEmail,
      subject,
      html,
    });

    if (error) {
      logger.error('Transfer email failed', { recipientEmail, transactionId, error });
      throw new Error('Failed to send transfer notification');
    }

    return data;
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

// export async function resetOtpRateLimit(email: string) {
//   await redis.getClient().del(`otp-attempts:${email}`);
// }


// const RESEND_LIMIT = 3; // 3 resends per hour
// const RESEND_WINDOW = 60 * 60; // seconds

// export async function checkResendRateLimit(email: string) {
//   const key = `otp-resend:${email}`;
//   const count = await redis.getClient().incr(key);
//   if (count === 1) await redis.getClient().expire(key, RESEND_WINDOW);
//   if (count > RESEND_LIMIT) throw new BadRequestError("Resend limit reached.");
// }










// Example Usage:
/*
await sendCreditNotification({
  recipientEmail: 'user@example.com',
  recipientName: 'John Doe',
  senderName: 'Jane Smith',
  senderEmail: 'jane@example.com',
  amount: 50000,
  currency: 'NGN',
  currencySymbol: '₦',
  transactionId: 'TXN-20260111-ABC123',
  transactionDate: 'January 11, 2026 at 2:30 PM WAT',
  previousBalance: 100000,
  newBalance: 150000,
  senderMessage: 'Thanks for your help with the project!',
  transactionLink: 'https://app.zely.com/transactions/TXN-20260111-ABC123',
});
*/