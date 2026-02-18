import { producer } from "@/kafka/config/kafka.config"
import { logger } from "@/shared/utils/logger";
import { connectAdmin, createTopic, disconnectAdmin } from './kafka.config';
import { TOPICS } from './topics';

const PARTITIONS = 3;
const REPLICATION_FACTOR = 1;

export async function setupKafkaTopics(): Promise<void> {
    await connectAdmin();

    for (const topic of Object.values(TOPICS)) {
        await createTopic(topic, PARTITIONS, REPLICATION_FACTOR);
    }

    await disconnectAdmin();
}


let isConnected = false;

export async function startKafkaProducer() {
    const p = producer
    if (isConnected) return;
    try {
        await p.connect()
        isConnected = true;
        logger.info('=== ⚒️Kafka producer connected ===');
    } catch (err) {
        isConnected = false;
        throw new Error(`Kafka producer connection failed: ${(err as Error).message}`);
    }
}

export async function shutdownKafkaProducer() {
    if (producer && isConnected) {
        try {
            await producer.disconnect();
            logger.info('Kafka producer disconnected gracefully');
            isConnected = false;
        } catch (err) {
            logger.error('Kafka producer disconnect failed', { error: (err as Error).message });
        }
    }
}

export { producer };
