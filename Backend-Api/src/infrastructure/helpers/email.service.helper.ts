import { config } from "@/config/index";
import { Resend } from "resend";
import { logger } from "@/shared/utils/logger";
import BadRequestError from "@/shared/errors/badRequest";
import redis from "../cache/redis.cli";
import { withResendBreaker } from "@/infrastructure/resilience/breakers/resend.breaker";
import { emailSendDuration, emailSendTotal } from "@/kafka/emails/email.poller";
// import { emailSendTotal, emailSendDuration } from

const resend = new Resend(config?.email?.apiKey);

// ─── Types ────────────────────────────────────────────────────────────────────
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
  fromAccountType: string;
  toAccountType: string;
  fromAccountLast4: string;
  toAccountLast4: string;
  fromPreviousBalance: number;
  fromNewBalance: number;
  toPreviousBalance: number;
  toNewBalance: number;
  type: string;
}

// ─── Email Service ────────────────────────────────────────────────────────────
export class EmailService {
  // ─── Core send method — ALL emails go through here ────────────────────────
  // Circuit breaker + metrics are wired here once, applies to every email type
  static async sendEmail(
    to: string,
    subject: string,
    html: string,
    jobName: string = "generic",
    options?: { idempotencyKey?: string },
  ): Promise<any> {
    const platformName = config?.app?.name || "Zely";
    const timer = emailSendDuration.startTimer({ job_name: jobName });

    // ✅ In dev, redirect all emails to test recipient
    const recipient =
      config.app.env === "development" && config?.email?.testRecipient
        ? config.email.testRecipient
        : to;

    return withResendBreaker(async () => {
      const { data, error } = await resend.emails.send(
        {
          from: `${platformName} <onboarding@resend.dev>`,
          to: recipient,
          subject:
            config.app.env === "development"
              ? `[DEV - to: ${to}] ${subject}`
              : subject,
          html,
        },
        options?.idempotencyKey
          ? { idempotencyKey: options.idempotencyKey }
          : undefined,
      );

      if (error) {
        emailSendTotal.inc({ status: "failure", job_name: jobName });
        timer();
        logger.error("Email send failed", { to, subject, jobName, error });
        throw new Error(`Email sending failed: ${error.message}`);
      }

      emailSendTotal.inc({ status: "success", job_name: jobName });
      timer();
      logger.info("Email sent successfully", {
        to,
        jobName,
        messageId: data?.id,
      });
      return data;
    }, `sendEmail:${jobName}:${to}`);
  }

  // ─── Verification email ───────────────────────────────────────────────────
  static async sendVerificationEmail(
    email: string,
    name: string,
    otp: string,
    options?: { idempotencyKey?: string },
  ) {
    const html = `
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
    `;

    return this.sendEmail(
      email,
      "Verify Your Email Address",
      html,
      "verification",
      options,
    );
  }

  // ─── Password reset email ─────────────────────────────────────────────────
  static async sendPasswordResetEmail(
    email: string,
    name: string,
    otp: string,
    expiryMinutes: number,
    options?: { idempotencyKey?: string },
  ) {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Password Reset Request</h2>
        <p>Hi ${name},</p>
        <p>We received a request to reset your password. Use the code below to reset your password:</p>
        <div style="background-color: #f5f5f5; padding: 20px; text-align: center; margin: 20px 0; border-radius: 8px;">
          <h1 style="margin: 0; color: #dc3545; font-size: 36px; letter-spacing: 8px;">${otp}</h1>
        </div>
        <p>Enter this code in the app to reset your password.</p>
        <p style="color: #999; font-size: 12px; margin-top: 24px;">
          This code will expire in ${expiryMinutes} minutes. If you didn't request this, please ignore this email.
        </p>
      </div>
    `;

    return this.sendEmail(
      email,
      "Reset Your Password",
      html,
      "password_reset",
      options,
    );
  }

  // ─── Password reset success email ─────────────────────────────────────────
  static async sendPasswordResetSuccessEmail(
    email: string,
    name: string,
    options?: { idempotencyKey?: string },
  ) {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Password Successfully Reset</h2>
        <p>Hi ${name},</p>
        <p>Your password for ${config?.app?.name} has been successfully reset.</p>
        <div style="background-color: #e8f5e9; padding: 20px; text-align: center; margin: 20px 0; border-radius: 8px; border-left: 4px solid #4caf50;">
          <p style="margin: 0; color: #2e7d32; font-size: 18px; font-weight: bold;">✓ Password Reset Complete</p>
        </div>
        <p>You can now log in to your account using your new password.</p>
        <p style="margin-top: 24px;">
          If you did not make this change, please contact our support team immediately.
        </p>
        <p style="color: #999; font-size: 12px; margin-top: 24px;">
          This is an automated security notification from ${config?.app?.name}.
        </p>
      </div>
    `;

    return this.sendEmail(
      email,
      "Password Reset Successful",
      html,
      "password_reset_success",
      options,
    );
  }

  // ─── Welcome email ────────────────────────────────────────────────────────
  static async sendWelcomeEmail(
    email: string,
    name: string,
    options?: { idempotencyKey?: string },
  ) {
    const html = `
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
    `;

    return this.sendEmail(
      email,
      `Welcome to ${config?.app?.name}!`,
      html,
      "welcome",
      options,
    );
  }

  // ─── Debit notification ───────────────────────────────────────────────────
  static async sendDebitNotification(
    params: any,
    options?: { idempotencyKey?: string },
  ) {
    const {
      recipientEmail,
      recipientName,
      amount,
      currencySymbol,
      transactionId,
      referenceId,
      transactionDate,
      fromAccountType,
      fromAccountLast4,
      previousBalance,
      newBalance,
      senderName,
      transactionLink,
    } = params;

    const platformName = config?.app?.name || "Zely";
    const supportEmail = "support@zely.com";
    const currentYear = new Date().getFullYear();
    const subject = `Debit Alert · ${currencySymbol}${amount.toLocaleString()}`;

    const html = `
      <html>
      <body style="margin:0;padding:0;background:#f6f9fc;font-family:-apple-system,Segoe UI,Roboto;">
      <table width="100%" cellpadding="0" cellspacing="0">
      <tr><td align="center" style="padding:40px 16px;">
      <table width="600" style="background:#fff;border-radius:8px;overflow:hidden;">

      <tr>
      <td align="center" style="padding:28px;border-bottom:1px solid #e5e7eb;">
      <h1 style="margin:0;font-size:20px;">${platformName}</h1>
      </td>
      </tr>

      <tr>
      <td align="center" style="padding:28px 32px;">
      <h2 style="margin:0 0 6px;color:#b91c1c;">Debit Successful</h2>
      <p style="margin:0;color:#6b7280;">
      Hi ${recipientName}, you sent ${currencySymbol}${amount.toLocaleString()} to ${senderName}.
      </p>
      </td>
      </tr>

      <tr>
      <td style="padding:0 32px 28px;">
      <div style="background:#b91c1c;color:#fff;border-radius:12px;padding:24px;text-align:center;">
      <p style="margin:0;font-size:34px;font-weight:700;">
      - ${currencySymbol}${amount.toLocaleString()}
      </p>
      </div>
      </td>
      </tr>

      <tr>
      <td style="padding:0 32px 24px;">
      <p style="font-size:13px;color:#6b7280;margin:0;">Account: ${fromAccountType} ••••${fromAccountLast4}</p>
      <p style="font-size:13px;color:#6b7280;margin:8px 0 0;">Previous Balance: ${currencySymbol}${previousBalance.toLocaleString()}</p>
      <p style="font-size:15px;font-weight:700;margin:6px 0 0;">New Balance: ${currencySymbol}${newBalance.toLocaleString()}</p>
      </td>
      </tr>

      <tr>
      <td align="center" style="padding:24px;">
      <a href="${transactionLink}" style="background:#111827;color:#fff;padding:12px 28px;text-decoration:none;border-radius:6px;">View Transaction</a>
      </td>
      </tr>

      <tr>
      <td align="center" style="padding:20px;font-size:12px;color:#9ca3af;background:#f9fafb;">
      <p style="margin:0 0 6px;">If this wasn't you, contact ${supportEmail} immediately.</p>
      <p style="margin:0;">© ${currentYear} ${platformName}</p>
      </td>
      </tr>

      </table>
      </td></tr>
      </table>
      </body>
      </html>
    `;

    return this.sendEmail(
      recipientEmail,
      subject,
      html,
      "debit_notification",
      options,
    );
  }

  // ─── Credit notification ──────────────────────────────────────────────────
  static async sendCreditNotification(
    params: any,
    options?: { idempotencyKey?: string },
  ) {
    const {
      recipientEmail,
      recipientName,
      amount,
      currencySymbol,
      transactionId,
      referenceId,
      transactionDate,
      toAccountType,
      toAccountLast4,
      previousBalance,
      newBalance,
      senderName,
      transactionLink,
    } = params;

    const platformName = config?.app?.name || "Zely";
    const supportEmail = "support@zely.com";
    const currentYear = new Date().getFullYear();
    const subject = `Credit Alert · ${currencySymbol}${amount.toLocaleString()}`;

    const html = `
      <html>
      <body style="margin:0;padding:0;background:#f6f9fc;font-family:-apple-system,Segoe UI,Roboto;">
      <table width="100%" cellpadding="0" cellspacing="0">
      <tr><td align="center" style="padding:40px 16px;">
      <table width="600" style="background:#fff;border-radius:8px;overflow:hidden;">

      <tr>
      <td align="center" style="padding:28px;border-bottom:1px solid #e5e7eb;">
      <h1 style="margin:0;font-size:20px;">${platformName}</h1>
      </td>
      </tr>

      <tr>
      <td align="center" style="padding:28px 32px;">
      <h2 style="margin:0 0 6px;color:#047857;">Credit Successful</h2>
      <p style="margin:0;color:#6b7280;">
      Hi ${recipientName}, you received ${currencySymbol}${amount.toLocaleString()} from ${senderName}.
      </p>
      </td>
      </tr>

      <tr>
      <td style="padding:0 32px 28px;">
      <div style="background:#047857;color:#fff;border-radius:12px;padding:24px;text-align:center;">
      <p style="margin:0;font-size:34px;font-weight:700;">
      + ${currencySymbol}${amount.toLocaleString()}
      </p>
      </div>
      </td>
      </tr>

      <tr>
      <td style="padding:0 32px 24px;">
      <p style="font-size:13px;color:#6b7280;margin:0;">Account: ${toAccountType} ••••${toAccountLast4}</p>
      <p style="font-size:13px;color:#6b7280;margin:8px 0 0;">Previous Balance: ${currencySymbol}${previousBalance.toLocaleString()}</p>
      <p style="font-size:15px;font-weight:700;margin:6px 0 0;">New Balance: ${currencySymbol}${newBalance.toLocaleString()}</p>
      </td>
      </tr>

      <tr>
      <td align="center" style="padding:24px;">
      <a href="${transactionLink}" style="background:#111827;color:#fff;padding:12px 28px;text-decoration:none;border-radius:6px;">View Transaction</a>
      </td>
      </tr>

      <tr>
      <td align="center" style="padding:20px;font-size:12px;color:#9ca3af;background:#f9fafb;">
      <p style="margin:0 0 6px;">This transaction was processed securely.</p>
      <p style="margin:0;">© ${currentYear} ${platformName}</p>
      </td>
      </tr>

      </table>
      </td></tr>
      </table>
      </body>
      </html>
    `;

    return this.sendEmail(
      recipientEmail,
      subject,
      html,
      "credit_notification",
      options,
    );
  }

  // ─── Transfer notification (legacy — kept for backwards compatibility) ─────
  static async sendTransferNotification(
    params: SendCreditNotificationParams,
    options?: { idempotencyKey?: string },
  ) {
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

    const platformName = config?.app?.name || "Zely";
    const supportEmail = "support@zely.com";
    const companyAddress = "123 Business Street, Lagos, Nigeria";
    const currentYear = new Date().getFullYear();

    const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; background-color: #f6f9fc;">
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f6f9fc;">
      <tr><td style="padding: 40px 20px;">
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px;">

      <tr>
      <td style="padding: 40px 40px 20px; text-align: center; border-bottom: 1px solid #e6e9ef;">
      <h1 style="margin: 0; font-size: 24px; font-weight: 600; color: #1a1a1a;">${platformName}</h1>
      </td>
      </tr>

      <tr>
      <td style="padding: 40px 40px 20px; text-align: center;">
      <h2 style="margin: 0 0 10px; font-size: 28px; font-weight: 600; color: #1a1a1a;">Payment Received!</h2>
      <p style="margin: 0; font-size: 16px; color: #6b7280;">Hi ${recipientName}, you've received a payment</p>
      </td>
      </tr>

      <tr>
      <td style="padding: 0 40px 30px;">
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 12px; padding: 30px; text-align: center;">
      <p style="margin: 0 0 8px; font-size: 14px; color: rgba(255,255,255,0.9); text-transform: uppercase; letter-spacing: 1px;">Amount Credited</p>
      <h3 style="margin: 0; font-size: 42px; font-weight: 700; color: #ffffff;">${currencySymbol}${amount.toLocaleString()}</h3>
      </div>
      </td>
      </tr>

      <tr>
      <td style="padding: 0 40px 30px;">
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f9fafb; border-radius: 8px; padding: 24px;">
      <tr><td style="padding: 8px 16px; font-size: 14px; color: #6b7280;">From</td><td style="padding: 8px 16px; font-size: 14px; font-weight: 600; color: #1a1a1a; text-align: right;">${senderName}</td></tr>
      <tr><td style="padding: 8px 16px; font-size: 14px; color: #6b7280; border-top: 1px solid #e5e7eb;">Sender Email</td><td style="padding: 8px 16px; font-size: 14px; font-weight: 600; color: #1a1a1a; text-align: right; border-top: 1px solid #e5e7eb;">${senderEmail}</td></tr>
      <tr><td style="padding: 8px 16px; font-size: 14px; color: #6b7280; border-top: 1px solid #e5e7eb;">Date</td><td style="padding: 8px 16px; font-size: 14px; font-weight: 600; color: #1a1a1a; text-align: right; border-top: 1px solid #e5e7eb;">${transactionDate}</td></tr>
      <tr><td style="padding: 8px 16px; font-size: 14px; color: #6b7280; border-top: 1px solid #e5e7eb;">Transaction ID</td><td style="padding: 8px 16px; font-size: 14px; font-weight: 600; color: #1a1a1a; text-align: right; border-top: 1px solid #e5e7eb; font-family: monospace;">${transactionId}</td></tr>
      <tr><td style="padding: 8px 16px; font-size: 14px; color: #6b7280; border-top: 1px solid #e5e7eb;">Reference</td><td style="padding: 8px 16px; font-size: 14px; font-weight: 600; color: #1a1a1a; text-align: right; border-top: 1px solid #e5e7eb; font-family: monospace;">${referenceId}</td></tr>
      </table>
      </td>
      </tr>

      ${
        senderMessage
          ? `
      <tr>
      <td style="padding: 0 40px 30px;">
      <div style="background-color: #fffbeb; border-left: 4px solid #f59e0b; border-radius: 6px; padding: 16px 20px;">
      <p style="margin: 0 0 4px; font-size: 12px; color: #92400e; font-weight: 600; text-transform: uppercase;">Message from ${senderName}</p>
      <p style="margin: 0; font-size: 14px; color: #78350f; font-style: italic;">"${senderMessage}"</p>
      </div>
      </td>
      </tr>`
          : ""
      }

      <tr>
      <td style="padding: 0 40px 30px;">
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
      <tr><td style="font-size: 14px; color: #6b7280; padding: 12px 0; border-top: 2px solid #e5e7eb;">Previous Balance</td><td style="font-size: 14px; font-weight: 600; color: #1a1a1a; text-align: right; padding: 12px 0; border-top: 2px solid #e5e7eb;">${currencySymbol}${previousBalance.toLocaleString()}</td></tr>
      <tr><td style="font-size: 14px; color: #6b7280; padding: 12px 0;">Amount Credited</td><td style="font-size: 14px; font-weight: 600; color: #10b981; text-align: right; padding: 12px 0;">+ ${currencySymbol}${amount.toLocaleString()}</td></tr>
      <tr><td style="font-size: 16px; font-weight: 700; color: #1a1a1a; padding: 12px 0; border-top: 2px solid #1a1a1a;">New Balance</td><td style="font-size: 18px; font-weight: 700; color: #1a1a1a; text-align: right; padding: 12px 0; border-top: 2px solid #1a1a1a;">${currencySymbol}${newBalance.toLocaleString()}</td></tr>
      </table>
      </td>
      </tr>

      <tr>
      <td style="padding: 0 40px 40px; text-align: center;">
      <a href="${transactionLink}" style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">View Transaction Details</a>
      </td>
      </tr>

      <tr>
      <td style="padding: 30px 40px; background-color: #f9fafb; border-top: 1px solid #e5e7eb; border-radius: 0 0 8px 8px;">
      <p style="margin: 0 0 10px; font-size: 13px; color: #6b7280; text-align: center;">Need help? <a href="mailto:${supportEmail}" style="color: #667eea;">${supportEmail}</a></p>
      <p style="margin: 0; font-size: 12px; color: #9ca3af; text-align: center;">© ${currentYear} ${platformName}. All rights reserved.</p>
      <p style="margin: 10px 0 0; font-size: 11px; color: #9ca3af; text-align: center;">${companyAddress}</p>
      </td>
      </tr>

      </table>
      </td></tr>
      </table>
      </body>
      </html>
    `;

    return this.sendEmail(
      recipientEmail,
      `You've received ${currencySymbol}${amount.toLocaleString()} from ${senderName}`,
      html,
      "transfer_notification",
      options,
    );
  }

  // ─── Internal transfer notification ──────────────────────────────────────
  static async sendInternalTransferNotifications(
    internalTransferParams: any,
    options?: { idempotencyKey?: string },
  ) {
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
    } = internalTransferParams;

    const platformName = config?.app?.name || "Zely";
    const supportEmail = "support@zely.com";
    const companyAddress = "123 Business Street, Lagos, Nigeria";
    const currentYear = new Date().getFullYear();

    const isInternal = transferType === "INTERNAL_TRANSFER";
    const isDebit = type === "DEBIT";
    const isCredit = type === "CREDIT";

    const title = isInternal
      ? "Internal Transfer Completed"
      : isDebit
        ? "Debit Successful"
        : "Credit Successful";

    const subtitle = isInternal
      ? "Your transfer between your accounts was successful"
      : isDebit
        ? "Your account has been debited successfully"
        : "Your account has been credited successfully";

    const primaryColor = isDebit ? "#b91c1c" : isCredit ? "#047857" : "#1d4ed8";

    const subject = `${title} · ${currencySymbol}${amount.toLocaleString()}`;

    const fromAccountLabel = fromAccountType
      ? `${fromAccountType} ••••${fromAccountLast4}`
      : "";
    const toAccountLabel = toAccountType
      ? `${toAccountType} ••••${toAccountLast4}`
      : "";

    const html = `
      <!DOCTYPE html>
      <html lang="en">
      <body style="margin:0;padding:0;background:#f6f9fc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
      <tr><td align="center" style="padding:40px 16px;">
      <table width="600" cellpadding="0" cellspacing="0" role="presentation" style="background:#ffffff;border-radius:8px;overflow:hidden;">

      <tr>
      <td align="center" style="padding:28px 32px;border-bottom:1px solid #e5e7eb;">
      <h1 style="margin:0;font-size:20px;color:#111827;">${platformName}</h1>
      </td>
      </tr>

      <tr>
      <td align="center" style="padding:28px 32px 12px;">
      <h2 style="margin:0 0 6px;font-size:22px;color:#111827;">${title}</h2>
      <p style="margin:0;font-size:14px;color:#6b7280;">${subtitle}</p>
      </td>
      </tr>

      <tr>
      <td style="padding:0 32px 28px;">
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:${primaryColor};border-radius:12px;">
      <tr><td align="center" style="padding:26px;">
      <p style="margin:0;font-size:11px;letter-spacing:0.12em;color:#e5e7eb;">AMOUNT</p>
      <p style="margin:8px 0 0;font-size:34px;font-weight:700;color:#ffffff;">${currencySymbol}${amount.toLocaleString()}</p>
      </td></tr>
      </table>
      </td>
      </tr>

      <tr>
      <td style="padding:0 32px 24px;">
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#f9fafb;border-radius:8px;">
      ${fromAccountLabel ? `<tr><td style="padding:12px 16px;font-size:13px;color:#6b7280;">From</td><td align="right" style="padding:12px 16px;font-size:13px;font-weight:600;color:#111827;">${fromAccountLabel}</td></tr>` : ""}
      ${toAccountLabel ? `<tr><td style="padding:12px 16px;font-size:13px;color:#6b7280;">To</td><td align="right" style="padding:12px 16px;font-size:13px;font-weight:600;color:#111827;">${toAccountLabel}</td></tr>` : ""}
      <tr><td style="padding:12px 16px;font-size:13px;color:#6b7280;">Date</td><td align="right" style="padding:12px 16px;font-size:13px;color:#111827;">${transactionDate}</td></tr>
      <tr><td style="padding:12px 16px;font-size:13px;color:#6b7280;">Transaction ID</td><td align="right" style="padding:12px 16px;font-family:monospace;font-size:12px;color:#111827;">${transactionId}</td></tr>
      <tr><td style="padding:12px 16px;font-size:13px;color:#6b7280;">Reference</td><td align="right" style="padding:12px 16px;font-family:monospace;font-size:12px;color:#111827;">${referenceId}</td></tr>
      </table>
      </td>
      </tr>

      ${
        isInternal
          ? `
      <tr>
      <td style="padding:0 32px 24px;">
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
      <tr>
      <td style="font-size:13px;color:#6b7280;">From Balance</td>
      <td align="right" style="font-size:13px;">${currencySymbol}${fromPreviousBalance?.toLocaleString()} → <strong>${currencySymbol}${fromNewBalance?.toLocaleString()}</strong></td>
      </tr>
      <tr>
      <td style="padding-top:8px;font-size:13px;color:#6b7280;">To Balance</td>
      <td align="right" style="padding-top:8px;font-size:13px;">${currencySymbol}${toPreviousBalance?.toLocaleString()} → <strong>${currencySymbol}${toNewBalance?.toLocaleString()}</strong></td>
      </tr>
      </table>
      </td>
      </tr>`
          : ""
      }

      <tr>
      <td align="center" style="padding:8px 32px 36px;">
      <a href="${transactionLink}" style="display:inline-block;padding:12px 28px;background:#111827;color:#ffffff;text-decoration:none;border-radius:6px;font-size:14px;font-weight:600;">View Transaction</a>
      </td>
      </tr>

      <tr>
      <td align="center" style="padding:20px;background:#f9fafb;font-size:12px;color:#9ca3af;">
      <p style="margin:0 0 6px;">Need help? <a href="mailto:${supportEmail}" style="color:#2563eb;text-decoration:none;">${supportEmail}</a></p>
      <p style="margin:0;">© ${currentYear} ${platformName}</p>
      <p style="margin:6px 0 0;">${companyAddress}</p>
      </td>
      </tr>

      </table>
      </td></tr>
      </table>
      </body>
      </html>
    `;

    return this.sendEmail(
      recipientEmail,
      subject,
      html,
      "internal_transfer",
      options,
    );
  }
}

// ─── OTP Rate Limiting ────────────────────────────────────────────────────────
const ATTEMPT_LIMIT = 5;
const ATTEMPT_WINDOW = 10 * 60;

export async function checkOtpRateLimit(email: string) {
  const key = `otp-attempts:${email}`;
  const attempts = await redis.getClient().incr(key);

  if (attempts === 1) {
    await redis.getClient().expire(key, ATTEMPT_WINDOW);
  }

  if (attempts > ATTEMPT_LIMIT) {
    throw new BadRequestError(
      "Too many verification attempts. Please try again later.",
    );
  }
}
