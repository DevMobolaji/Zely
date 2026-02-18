import { Queue } from "bullmq";
import { config } from "@/config/index";
import { conn } from "@/workers/bullMq.config";

export const EMAIL_QUEUE = "email-queue";

export const emailQueue = new Queue(EMAIL_QUEUE, {
  connection: conn, 
  defaultJobOptions: {
    attempts: 5,
    backoff: { type: "exponential", delay: 500 },
    removeOnComplete: true,
    removeOnFail: false
  }
});

export default emailQueue;
