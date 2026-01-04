import BadRequestError from "@/shared/errors/badRequest";
import { kafka } from "../config/kafka.config";
import { sendToDLQ } from "./dlq.consumer";
import { logger } from "@/shared/utils/logger";
import { ensureIdempotent } from "events/idempotency";
import mongoose from "mongoose";
import { TOPICS } from "../config/topics";


const consumer = kafka.consumer({ groupId: "user-created-consumer" });

export async function runUserRegisteredConsumer() {
  await consumer.connect();
  await consumer.subscribe({
    topic: TOPICS.AUTH_USER_REGISTER,
    fromBeginning: false, // only new events
  });

  await consumer.run({
    eachMessage: async ({ topic, message, partition, heartbeat }: any) => {
      if (!message.value) return;

      const event = JSON.parse(message.value.toString());
      const { eventId, payload } = event;

      const session = await mongoose.startSession();

      try {
        await session.withTransaction(async () => {
          const firstTime = await ensureIdempotent(eventId, session, topic);
          if (!firstTime) {
            return;
          }

          // 2️⃣ Side effects: create wallet, ledger, etc.
          // await Wallet.create(
          //   [{ userId: payload.userId, balance: 0 }],
          //   { session }
          // );

          // You can add more atomic side effects here
          logger.info("User registered successfully");

          await consumer.commitOffsets([{ topic, partition, offset: (Number(message.offset) + 1).toString() }]);
        });
      } finally {
        await session.endSession();
      }
    },
  });
}
