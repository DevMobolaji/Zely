import { Queue } from "bullmq"
import { config } from "@/config/index";

export const AUDIT_OUTBOX_QUEUE = "audit-outbox";

export const auditOutboxQueue = new Queue(AUDIT_OUTBOX_QUEUE, {
  connection: {
    host: config.redis.host,
    port: config.redis.port,
    password: config.redis.password,
    db: config.redis.db
  },
  defaultJobOptions: {
    attempts: 5,
    backoff: { type: "exponential", delay: 500 },
    removeOnComplete: true,
    removeOnFail: false
  }
});

export default auditOutboxQueue;