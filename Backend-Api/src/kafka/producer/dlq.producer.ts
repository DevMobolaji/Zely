import { Kafka } from 'kafkajs';

const kafka = new Kafka({
    clientId: 'audit-dlq-producer',
    brokers: ['localhost:9094'],
});

const producer = kafka.producer();
let isConnected = false;

export async function sendToDLQ(originalTopic: string, originalMessage: string, error: unknown) {
    if (!isConnected) {
        await producer.connect();
        isConnected = true;
    }

    try {
        await producer.send({
            topic: 'audit.events.DLQ',
            messages: [
                {
                    value: JSON.stringify({
                        originalTopic,
                        originalMessage,
                        error: error instanceof Error ? error.message : String(error),
                        failedAt: new Date().toISOString(),
                    }),
                },
            ],
        });
    } catch (err) {
        console.error('CRITICAL: Failed to send message to DLQ', err);
    }
}
