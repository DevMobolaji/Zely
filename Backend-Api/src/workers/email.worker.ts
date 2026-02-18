import { EmailService, InternalTransferNotificationParams, SendCreditNotificationParams } from "../infrastructure/helpers/email.service.helper";
import { Worker } from "bullmq";
import { EMAIL_QUEUE } from "../infrastructure/queues/email.queue";
import { conn } from "./bullMq.config";

console.log('🔥 EMAIL WORKER FILE LOADED');

async function bootstrap() {

  const connection = conn

  const emailWorker = new Worker(EMAIL_QUEUE, async job => {
    console.log('🟢 Processing job', job.id, job.data);

    const { email, name, otp, type, amount, currency, currencySymbol, fromUserEmail, fromUserId, previousBalance, currentBalance, transactionId, referenceId, referenceType, transactionRef, expiryMinutes, transferType, fromAccountType, fromAccountLast4, toAccountType, toAccountLast4, senderEmail, senderName, recipientEmail, recipientName } = job.data;


    // Only send email notification if we have recipient info
    const params: SendCreditNotificationParams = {
      recipientEmail: email,
      recipientName: name,
      amount,
      currencySymbol: currency,
      senderEmail: fromUserEmail,
      senderName: fromUserId,
      senderMessage: "",
      transactionLink: `${process.env.APP_URL}/transactions/${transactionRef}`,
      previousBalance,
      newBalance: currentBalance,
      transactionId: transactionRef,
      referenceId: referenceId,
      referenceType: referenceType,
      transactionDate: new Date().toLocaleString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZoneName: 'short'
      })
    }

    const internalTransferParams = {
      recipientEmail,
      recipientName,
      amount,
      currencySymbol,
      fromAccountType,
      toAccountType,
      fromAccountLast4,
      toAccountLast4,
      toPreviousBalance: previousBalance,
      toNewBalance: currentBalance,
      fromPreviousBalance: previousBalance,
      fromNewBalance: currentBalance,
      transactionId: transactionId,
      referenceId: referenceId,
      transactionDate: new Date().toISOString(),
      type: type,
      transactionLink: `${process.env.APP_URL}/transactions/${transactionRef}`,
      transferType
    };

    console.log('🟢 Processing internalTransferParams', internalTransferParams);


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

      case "TRANSFER":
        await EmailService.sendTransferNotification(params);
        break;

      case "CREDIT":
        if (transferType === "INTERNAL_TRANSFER") {
          await EmailService.sendInternalTransferNotifications(internalTransferParams);
        } else {
          //await EmailService.sendP2PTransferNotification(params);
        }
        break;

      case "DEBIT":
        if (transferType === "INTERNAL_TRANSFER") {
          await EmailService.sendInternalTransferNotifications(internalTransferParams);
        } else {
          //await EmailService.sendP2PTransferNotification(params);
        }
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

