import { config } from "@/config/index";
import mongoose from "mongoose";
import { logger } from "@/shared/utils/logger";
import { runOutboxRouter } from "@/kafka/config/outboxRouter";

async function bootstrap() {
  try {
    /** -------------------------
     * CONNECT TO MONGODB
     * ------------------------- */
    await mongoose.connect(config.database.mongodb.uri)
    logger.info("Outbox Worker connected to MongoDB");

    /** -------------------------
     * GRACEFUL SHUTDOWN
     * ------------------------- */
    process.on("SIGTERM", async () => {
      logger.info("SIGTERM received, shutting down poller");
      await mongoose.disconnect();
      process.exit(0);
    });

    process.on("SIGINT", async () => {
      logger.info("SIGINT received, shutting down poller");
      await mongoose.disconnect();
      process.exit(0);
    });

    // Catch unhandled errors — log but never crash silently
    process.on("unhandledRejection", (reason) => {
      logger.error("Unhandled rejection in poller process", { reason });
    });

    process.on("uncaughtException", (err) => {
      logger.error("Uncaught exception in poller process", {
        error: err.message,
        stack: err.stack,
      });
      // Give logger time to flush before exiting
      setTimeout(() => process.exit(1), 1000);
    });

    /** -------------------------
     * START POLLER
     * ------------------------- */
    await runOutboxRouter();
  } catch (err: any) {
    logger.error("Failed to bootstrap poller", { error: err.message });
    process.exit(1);
  }
}

bootstrap();
