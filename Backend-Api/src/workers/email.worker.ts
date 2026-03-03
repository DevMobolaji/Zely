import { EmailService, InternalTransferNotificationParams, SendCreditNotificationParams } from "../infrastructure/helpers/email.service.helper";
import { Worker } from "bullmq";
import { EMAIL_QUEUE } from "../infrastructure/queues/email.queue";
import { conn } from "./bullMq.config";

console.log('🔥 EMAIL WORKER FILE LOADED');

async function bootstrap() {

  const connection = conn

  const emailWorker = new Worker(EMAIL_QUEUE, async job => {
    console.log('🟢 Processing job', job.id, job.data);

    const { email, name, otp, type, amount, currency, currencySymbol, fromUserEmail, fromUserId, previousBalance, currentBalance, transactionId, referenceId, referenceType, transactionRef, expiryMinutes, transferType, fromAccountType, fromAccountLast4, toAccountType, toAccountLast4, senderEmail, senderName, recipientEmail, recipientName, toPreviousBalance, toCurrentBalance } = job.data;


    interface SendCreditNotificationParams {
      recipientEmail: string;
      recipientName: string;
      amount: number;
      currencySymbol: string;
      senderEmail: string;
      senderName: string;
      transactionLink: string;
      previousBalance: number;
      newBalance: number;
      transactionId: string;
      referenceId: string;
      referenceType: string;
      transactionDate: string;
      type: string
    }

    interface SendDebitNotificationParams {
      recipientEmail: string;
      recipientName: string;
      amount: number;
      currencySymbol: string;
      transactionLink: string;
      previousBalance: number;
      newBalance: number;
      transactionId: string;
      referenceId: string;
      referenceType: string;
      transferType: string;
      toAccountType: string;
      toAccountLast4: string;
      transactionDate: string;
      type: string
    }

    const debitParams: SendDebitNotificationParams = {
      recipientEmail,
      recipientName,
      amount,
      currencySymbol,
      transactionLink: `${process.env.APP_URL}/transactions/${transactionRef}`,
      previousBalance,
      type,
      newBalance: currentBalance,
      transactionId,
      referenceId,
      referenceType,
      transferType,
      toAccountType,
      toAccountLast4,
      transactionDate: new Date().toLocaleString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZoneName: "short"
      })
    };


    const creditParams: SendCreditNotificationParams = {
      recipientEmail,
      recipientName,
      amount,
      currencySymbol,
      senderEmail,
      senderName,
      transactionLink: `${process.env.APP_URL}/transactions/${transactionRef}`,
      previousBalance,
      newBalance: currentBalance,
      transactionId,
      referenceId,
      referenceType,
      type,
      transactionDate: new Date().toLocaleString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZoneName: "short"
      })
    };
  

    const internalTransferParams = {
      recipientEmail: email,
      recipientName: name,
      amount,
      currencySymbol: currency,
      fromAccountType,
      toAccountType,
      fromAccountLast4,
      toAccountLast4,
      toPreviousBalance: toPreviousBalance,
      toNewBalance: toCurrentBalance,
      fromPreviousBalance: previousBalance,
      fromNewBalance: currentBalance,
      transactionId: transactionId,
      referenceId: referenceId,
      transactionDate: new Date().toISOString(),
      type: type,
      transactionLink: `${process.env.APP_URL}/transactions/${transactionRef}`,
      transferType
    };


    if (type === 'TRANSFER' && (!email || !name)) {
      throw new Error(`Invalid job data: Missing recipient email or name. Got: ${JSON.stringify(job.data)}`);
    }

    switch (type) {
      case "VERIFICATION":
        if (!otp) throw new Error("OTP is required for verification emails");
        await EmailService.sendVerificationEmail(email, name, otp);
        break;

      case "WELCOME":
        await EmailService.sendWelcomeEmail(email, name);
        break;

      case "EMAIL_VERIFICATION":
        await EmailService.sendVerificationEmail(email, name, otp);
        break;

      case "PASSWORD_RESET_REQUEST":
        await EmailService.sendPasswordResetEmail(email, name, otp, expiryMinutes);
        break;

      case "PASSWORD_RESET_SUCCESS":
        await EmailService.sendPasswordResetSuccessEmail(email, name);
        break;

      // case "TRANSFER":
      //   await EmailService.sendTransferNotification(params);
      //   break;

      case "INTERNAL_TRANSFER":
        await EmailService.sendInternalTransferNotifications(internalTransferParams);
        break

      case "DEBIT":
        await EmailService.sendDebitNotification(debitParams);
        break;

      case "CREDIT":
        await EmailService.sendCreditNotification(creditParams);
        break;


      default:
        throw new Error(`Unknown email type: ${type}`);
    }

  },
    {
      connection,
      concurrency: 10,
      autorun: true,
      limiter: { max: 10, duration: 1000 },
      removeOnComplete: { count: 100 },
      removeOnFail: { count: 500 },
    });

  //emailWorker.on('active', job => console.log('Job started:', job.id, job.data));
  //emailWorker.on('completed', job => console.log('Job completed:', job.id));
  emailWorker.on('failed', (job, err) => console.error('Job failed:', job?.id, err));
  emailWorker.on('error', err => console.error('Worker error:', err));
}

bootstrap().catch(err => {
  console.error("❌ Worker startup failed", err);
  process.exit(1);
});

