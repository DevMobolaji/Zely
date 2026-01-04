// // kafka/dlq.consumer.ts
// import { Kafka, type EachMessagePayload } from 'kafkajs';

// const kafka = new Kafka({
//     clientId: 'audit-dlq-service',
//     brokers: ['localhost:9092'],
// });

// export async function startAuditDLQConsumer() {
//     const consumer = kafka.consumer({ groupId: 'audit-dlq-consumers' });
//     await consumer.connect();
//     await consumer.subscribe({ topic: 'audit.events.DLQ', fromBeginning: false });

//     const dlqHandler = async ({ message }: EachMessagePayload) => {
//         if (!message.value) {
//             console.warn('Received empty message in AUDIT_DLQ_EVENT');
//             return;
//         }

//         try {
//             const parsed = JSON.parse(message.value.toString());
//             console.error('AUDIT_DLQ_EVENT', parsed);
//         } catch (err) {
//             console.error('Failed to parse DLQ message', err, message.value.toString());
//         }
//     };

//     await consumer.run({ eachMessage: dlqHandler });
// }


import { producer } from "../config/kafka.config";

export async function sendToDLQ(payload: any) {
  await producer.send({
    topic: "audit.user.events.dlq",
    messages: [
      {
        key: payload.eventId || "unknown",
        value: JSON.stringify({
          ...payload,
          failedAt: new Date().toISOString(),
          source: "audit-consumer"
        })
      }
    ]
  });
}
