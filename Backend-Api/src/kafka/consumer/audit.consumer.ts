// // kafka/audit.consumer.ts
// import { Kafka } from "kafkajs";
// //import { AuditEventSchema, AuditEvent } from "../schema/audit.schema";
// import { logger } from "@/shared/utils/logger";
// import { config } from "@/config/index";

// const kafka = new Kafka({
//     clientId: "audit-service",
//     brokers: config.kafka.brokers,
// });

// const consumer = kafka.consumer({ groupId: "audit-consumers" });

// export async function startAuditConsumer() {
//     await consumer.connect();
//     await consumer.subscribe({ topic: "audit.events", fromBeginning: false });

//     logger.info("🛡️ Audit consumer connected and subscribed");

//     await consumer.run({
//         eachMessage: async ({ message, partition }: { message: any; partition: number }) => {
//             const rawMessage = message.value?.toString() || "unknown";
//             console.log(message)

//             // try {
//             //     const event = AuditEventSchema.parse(JSON.parse(rawMessage));

//             //     // Only attempt-tracking events use attemptCount/initialStatus
//             //     if (event.attemptTracking && event.trackedEmail) {
//             //         const filter = {
//             //             trackedEmail: event.trackedEmail,
//             //             action: event.action,
//             //         };

//             //         // Fetch previous document (if any)
//             //         const previous = await AuditModel.findOne(filter);

//             //         const previousInitialStatus = previous
//             //             ? previous.latestStatus
//             //             : "PENDING"; // initial default
//             //         const attemptCount = (previous?.attemptCount ?? 0) + 1;

//             //         const update = {
//             //             $set: {
//             //                 latestStatus: event.status,
//             //                 initialStatus: previousInitialStatus,
//             //                 lastAttempt: new Date(event.lastAttempt || Date.now()),
//             //                 requestId: event.requestId,
//             //                 ip: event.ip,
//             //                 userAgent: event.userAgent,
//             //                 userId: event.userId,
//             //                 metadata: event.metadata || {},
//             //                 severity: event.severity || "INFO",
//             //             },
//             //             $setOnInsert: {
//             //                 createdAt: new Date(),
//             //             },
//             //             $inc: { attemptCount: 1 },
//             //         };

//             //         const doc = await AuditModel.findOneAndUpdate(filter, update, {
//             //             upsert: true,
//             //             new: true,
//             //         });

//             //         if (!doc) {
//             //             logger.warn("AUDIT_LOGGED: Upsert returned null", { filter, update });
//             //         } else {
//             //             logger.info(`AUDIT_LOGGED: ${event.action} - ${event.status}`, {
//             //                 auditedEmail: event.trackedEmail,
//             //                 auditedUserId: event.userId,
//             //                 initialStatus: doc.initialStatus,
//             //                 latestStatus: doc.latestStatus,
//             //                 attemptCount: doc.attemptCount,
//             //                 requestId: doc.requestId,
//             //                 partition,
//             //             });
//             //         }
//             //     } else {
//             //         // Non-attempt-tracking events
//             //         await AuditModel.create(event);
//             //     }
//             // } catch (err) {
//             //     logger.error("AUDIT_CONSUMER_FAILED", {
//             //         error: (err as Error).message,
//             //         rawMessage,
//             //     });
//             //     // Optionally send to DLQ here if desired
//             // }
//         },
//     });
// }

// // Graceful shutdown
// export async function shutdownAuditConsumer() {
//     try {
//         await consumer.disconnect();
//         logger.info("Audit consumer disconnected gracefully");
//     } catch (err) {
//         logger.error("Audit consumer disconnect failed", { error: (err as Error).message });
//     }
// }

// process.on("SIGTERM", shutdownAuditConsumer);
// process.on("SIGINT", shutdownAuditConsumer);

import { kafka } from "../config/kafka.config";
import { validateUserEvent } from "../schema/audit.schema";
import { sendToDLQ } from "./dlq.consumer";
import { logger } from "@/shared/utils/logger";

const consumer = kafka.consumer({ groupId: "audit-consumer" });

export async function startAuditConsumer() {
    await consumer.connect();
    await consumer.subscribe({ topic: "audit.user.events" });

    await consumer.run({
        eachMessage: async ({ message }: any) => {
            try {
                const raw = message.value?.toString();
                if (!raw) return;

                const parsed = JSON.parse(raw);
                const event = validateUserEvent(parsed);

                // store immutably / enrich / forward
                // (implementation depends on your storage)

            } catch (err: any) {
                await sendToDLQ({
                    error: err.message,
                    raw: message.value?.toString()
                });
            }
        }
    });
}

export async function shutdownAuditConsumer() {
    try {
        await consumer.disconnect();
        logger.info("Audit consumer disconnected gracefully");
    } catch (err) {
        logger.error("Audit consumer disconnect failed", { error: (err as Error).message });
    }
}

process.on("SIGTERM", shutdownAuditConsumer);
process.on("SIGINT", shutdownAuditConsumer);