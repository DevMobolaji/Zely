import { EmailService } from "../infrastructure/helpers/email.service.helper";
import { Worker } from "bullmq";
import { config } from "@/config/index";
import { EMAIL_QUEUE } from "../infrastructure/queues/email.queue";

console.log('🔥 EMAIL WORKER FILE LOADED');

async function bootstrap() {

  const connection = {
    host: config.redis.host,
    port: config.redis.port,
    password: config.redis.password,
    db: config.redis.db,
  };

  const emailWorker = new Worker(EMAIL_QUEUE, async job => {
    console.log('🟢 Processing job', job.id, job.data);

    const { email, name, otp, type } = job.data;

    if (!email || !name || !type) throw new Error("Invalid job data");

    switch (type) {
      case "VERIFICATION":
        if (!otp) throw new Error("OTP is required for verification emails");
        await EmailService.sendVerificationEmail(email, name, otp);
        break;

      case "WELCOME":
        await EmailService.sendWelcomeEmail(email, name);
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

  emailWorker.on('active', job => console.log('Job started:', job.id, job.data));
  emailWorker.on('completed', job => console.log('Job completed:', job.id));
  emailWorker.on('failed', (job, err) => console.error('Job failed:', job?.id, err));
  emailWorker.on('error', err => console.error('Worker error:', err));
}

bootstrap().catch(err => {
  console.error("❌ Worker startup failed", err);
  process.exit(1);
});

