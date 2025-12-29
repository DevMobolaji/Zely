// kafka/producer.ts

import { UserEvent } from '../schema/user.schema';
import { producer } from '../config/kafka.config';
import { startKafkaProducer } from '../config';
import logger from '@/shared/utils/logger';



export async function produceUserCreatedEvent(event: UserEvent) {
    await startKafkaProducer().catch(console.error)
    try {
        // Use trackedEmail as key to preserve partition ordering for attempt-tracking events
        const key = event?.email || 'user.created';
        await producer.send({
            topic: 'audit.user.events',
            acks: -1,
            messages: [
                {
                    key,
                    value: JSON.stringify(event),
                },
            ],
        });
    }
     catch (err) {
        logger.error('KAFKA_SEND_FAILED', { error: (err as Error).message, event });
        throw err; // optional: allow caller to log failure
    }
}


