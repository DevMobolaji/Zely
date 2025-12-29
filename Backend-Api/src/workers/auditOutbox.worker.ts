import "dotenv/config";
import mongoose from "mongoose";
import { Worker } from "bullmq";

import { AUDIT_OUTBOX_QUEUE } from "@/infrastructure/queues/auditOutbox.queue";
import { AuditOutboxModel } from "@/modules/audit/auditOutbox.model";
import { producer } from "@/kafka/config/kafka.config";
import { config } from "@/config/index";
import mongo from "@/config/mongo";

// ---- Bootstrap DB & Kafka first ----
async function bootstrap() {
  await mongo.connect();
  await producer.connect();

  console.log("✅ Worker connected to MongoDB & Kafka");

  const worker = new Worker(
    AUDIT_OUTBOX_QUEUE,
    async job => {
      const { outboxId } = job.data;

      const event = await AuditOutboxModel.findById(outboxId);
      if (!event || event.processed) return;

      await producer.send({
        topic: "audit.user.events",
        messages: [
          {
            key: event.userId ?? event._id.toString(),
            value: JSON.stringify({
              eventId: event._id.toString(),
              eventType: event.eventType,
              action: event.action,
              status: event.status,
              reason: event.reason,
              userId: event.userId,
              occurredAt: event.occurredAt.toISOString(),
              context: event.context,
              metadata: {
                schemaVersion: 1,
                source: "auth-service"
              }
            })
          }
        ]
      });

      event.processed = true;
      event.processedAt = new Date();
      await event.save();
    },
    {
      connection: {
        host: config.redis.host,
        port: config.redis.port,
        password: config.redis.password,
        db: config.redis.db
      },
      concurrency: 10
    }
  );

  worker.on("completed", job =>
    console.log("🎉 Job completed", job.id)
  );

  worker.on("failed", (job, err) =>
    console.error("❌ Job failed", job?.id, err)
  );
}

bootstrap().catch(err => {
  console.error("❌ Worker startup failed", err);
  process.exit(1);
});
