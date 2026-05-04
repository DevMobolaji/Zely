import { Queue } from "bullmq";
import { config } from "@/config/index";
import { conn } from "@/workers/bullMq.config";

export const EMAIL_QUEUE = "email-queue";

export const emailQueue = new Queue(EMAIL_QUEUE, {
  connection: conn,
  defaultJobOptions: {
    attempts: 5,
    backoff: { type: "exponential", delay: 500 },
    removeOnComplete: {
      age: 300, // ✅ keep completed jobs for 5 minutes (covers all retry windows)
      count: 1000, // ✅ cap memory usage
    },
    removeOnFail: false,
  },
});

export default emailQueue;
