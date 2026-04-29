// retry.producer.ts
import { producer } from "../config/kafka.config";
import { logger } from "@/shared/utils/logger";
import { RetryEnvelope } from "../retry.helpers/retry.envelope";
import { resolveRetryPolicy } from "../retry.helpers/retry.policy";
import { withKafkaBreaker } from '@/infrastructure/resilience/breakers/kafka.breaker';
import { kafkaMessagesProcessedTotal } from '@/infrastructure/resilience/metrics';

export async function sendToRetry(
  baseTopic: string,
  envelope: RetryEnvelope,
) {

  const { event, meta } = envelope;
  const { levels } = resolveRetryPolicy(envelope.event.aggregateType);

  const retryCount = meta.retryCount ?? 0;

  logger.info(`Sending to retry topic, attempt #${retryCount}`);

  const retryLevel = levels[retryCount];

  if (!retryLevel) {
    logger.error(`No retry level found for retryCount ${retryCount}`);
  }

  const key = envelope.event.eventId || "unknown";

  const nextEnvelope = {
    event,
    meta: {
      ...meta,
      retryCount: retryCount,
      lastError: meta.lastError,
      originalTopic: baseTopic,
      createdAt: meta.createdAt || new Date().toISOString(),
    },
  };

  // await producer.send({
  //   topic: retryLevel.topic,
  //   messages: [
  //     {
  //       key,
  //       value: JSON.stringify(nextEnvelope),
  //       headers: {
  //         "x-retry-count": String(nextEnvelope.meta.retryCount),
  //         "x-last-error": envelope.meta.lastError || "unknown",
  //       },
  //     },
  //   ],
  // });

  await withKafkaBreaker(async () => {
    await producer.send({
      topic: retryLevel.topic,
      messages: [
        {
          key,
          value: JSON.stringify(nextEnvelope),
          headers: {
            "x-retry-count": String(nextEnvelope.meta.retryCount),
            "x-last-error": envelope.meta.lastError || "unknown",
          },
        },
      ],
    });
  }, 'sendToRetry');

  kafkaMessagesProcessedTotal.inc({
    topic: retryLevel.topic,
    consumer_group: 'retry-producer',
  });


  logger.warn("Event sent to retry topic");
}




// import { producer } from "../config/kafka.config";
// import { logger } from "@/shared/utils/logger";
// import { RetryEnvelope } from "../consumer/helpers/retry.envelope";
// import { resolveRetryPolicy } from "../consumer/helpers/retry.policy";
// import { sendToDLQ } from "./sendToDlq";


// export async function sendToRetry(
//   baseTopic: string,
//   envelope: RetryEnvelope,
// ) {
//   const { event, meta } = envelope;
//   const { levels, maxRetries } = resolveRetryPolicy(envelope.event.aggregateType);

//   const retryCount = meta.retryCount ?? 0;
//   const nextRetryCount = retryCount + 1;

//   if (retryCount >= maxRetries || !levels[retryCount]) {
//     logger.error("Max retries exceeded, routing to DLQ", {
//       eventId: event.eventId,
//       retryCount,
//       maxRetries,
//     });
//     await sendToDLQ(baseTopic, envelope, new Error(`Max retries exceeded after ${retryCount} attempts`));
//     return;
//   }

//   const retryLevel = levels[retryCount];
//   const key = event.eventId || "unknown";

//   const nextEnvelope: RetryEnvelope = {
//     event,
//     meta: {
//       ...meta,
//       retryCount: nextRetryCount,
//       lastError: meta.lastError,
//       originalTopic: baseTopic,
//       createdAt: meta.createdAt || new Date().toISOString(),
//     },
//   };

//   await withKafkaBreaker(async () => {
//     await producer.send({
//       topic: retryLevel.topic,
//       messages: [
//         {
//           key,
//           value: JSON.stringify(nextEnvelope),
//           headers: {
//             "x-retry-count": String(nextRetryCount),
//             "x-last-error": meta.lastError || "unknown",
//           },
//         },
//       ],
//     });
//   }, 'sendToRetry');

// kafkaMessagesProcessedTotal.inc({
//   topic: retryLevel.topic,
//   consumer_group: 'retry-producer',
// });

//   logger.warn("Event sent to retry topic", {
//     eventId: event.eventId,
//     topic: retryLevel.topic,
//     retryCount: nextRetryCount,
//   });
// }