// src/workers/payment-reaper.worker.ts // if you use path aliases like @/
import { config } from "@/config/index";
import {
  schedulePaymentReaper,
  startPaymentReaperWorker,
} from "@/modules/payments/payments.reaper";
import { logger } from "@/shared/utils/logger";
import mongoose from "mongoose";

async function bootstrap() {
  logger.info("🚀 Starting payment reaper worker...");

  // 1. Connect to MongoDB
  await mongoose.connect(config.database.mongodb.uri);
  logger.info("Outbox Worker connected to MongoDB");

  // 2. Register the cron schedule in BullMQ
  await schedulePaymentReaper();

  // 3. Start the worker
  const worker = startPaymentReaperWorker();

  logger.info("✅ Payment reaper worker is running");

  // 4. Graceful shutdown
  const shutdown = async (signal: string) => {
    logger.info(`${signal} received — shutting down reaper worker`);
    await worker.close();
    await mongoose.disconnect();
    logger.info("✅ Graceful shutdown complete");
    process.exit(0);
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

bootstrap().catch((err) => {
  logger.error("Fatal error starting payment reaper worker", {
    error: err.message,
  });
  process.exit(1);
});
