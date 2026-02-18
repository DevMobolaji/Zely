import { config } from '@/config/index';
import { logger } from '@/shared/utils/logger';
import { Kafka, logLevel } from 'kafkajs';


export const kafka = new Kafka({
    clientId: config.kafka.clientId,
    brokers: config.kafka.brokers,
    logLevel: logLevel.ERROR,
    retry: {
        initialRetryTime: 100,
        retries: 8,
        maxRetryTime: 30_000,
        multiplier: 2,
    },
})

const admin = kafka.admin()

export async function createTopic(
    topic: string,
    numPartitions = 3,
    replicationFactor = 1
) {
    const existing = await admin.listTopics();

    if (!existing.includes(topic)) {
        await admin.createTopics({
            topics: [
                {
                    topic,
                    numPartitions,
                    replicationFactor,
                },
            ],
            waitForLeaders: true,
        });

        console.info(`✅ Kafka topic created: ${topic}`);
    } else {
        console.info(`ℹ️ Kafka topic already exists: ${topic}`);
    }
}


let adminConnected = false;

export async function connectAdmin(): Promise<void> {
    if (adminConnected) return;
    await admin.connect();
    adminConnected = true;
}

export async function disconnectAdmin(): Promise<void> {
    if (!adminConnected) return;
    await admin.disconnect();
    adminConnected = false;
}

export const producer = kafka.producer({
    idempotent: true,
    maxInFlightRequests: 1,
    allowAutoTopicCreation: false,
});
