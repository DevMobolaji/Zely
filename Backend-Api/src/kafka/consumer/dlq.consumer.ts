// dlq.consumer.ts
import { kafka } from "../config/kafka.config";
import { initFailedEvents } from "@/events/idempotency";
import { logger } from "@/shared/utils/logger";
import { TOPICS } from "../config/topics";

const dlqConsumer = kafka.consumer({ groupId: "generic-dlq-sink" });

export async function startDLQSink() {
    const failedCollection = await initFailedEvents();

    // Subscribe to all topics ending with .dlq
    await dlqConsumer.subscribe({
        topic: TOPICS.AUTH_EVENTS_DLQ,
        fromBeginning: false,
      });

    await dlqConsumer.run({
        autoCommit: false,
        eachMessage: async ({ topic, partition, message }: { topic: string; partition: number; message: any }) => {
            const commitOffset = async () => {
                await dlqConsumer.commitOffsets([
                    { topic, partition, offset: (Number(message.offset) + 1).toString() },
                ]);
            };

            try {
                const raw = message.value?.toString();
                if (!raw) return await commitOffset();

                const payload = JSON.parse(raw);

                // Idempotent insert
                await failedCollection.updateOne(
                    { "payload.eventId": payload.event?.eventId },
                    {
                        $setOnInsert: {
                            topic,
                            key: message.key?.toString() ?? null,
                            payload,
                            headers: Object.fromEntries(
                                Object.entries(message.headers ?? {}).map(([k, v]) => [k, v?.toString()])
                            ),
                            error: payload.meta?.lastError || payload.error || "unknown",
                            failedAt: new Date(),
                        },
                    },
                    { upsert: true }
                );

                logger.error("Stored failed event");
                await commitOffset();
            } catch (err) {
                logger.error("Failed DLQ write (manual intervention required)", err);
                await commitOffset(); // still commit to prevent blocking the consumer
            }
        },
    });
}
