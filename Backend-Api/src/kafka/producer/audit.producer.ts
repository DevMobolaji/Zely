// kafka/producer.ts

import { logger } from '@/shared/utils/logger';
//import { AuditEvent } from '@/kafka/schema/audit.schema';

import { producer } from '@/kafka/config/kafka.config';
import { startKafkaProducer } from '../config';


export async function produceAuditEvent(event: any) {
    try {
        // Use trackedEmail as key to preserve partition ordering for attempt-tracking events
        const key = event.metadata?.email || 'audit';
        
        await producer.send({
            topic: 'audit.events',
            acks: -1,
            messages: [
                {
                    key,
                    value: JSON.stringify(event),
                },
            ],
        });
    } catch (err) {
        logger.error('KAFKA_SEND_FAILED', { error: (err as Error).message, event });
        throw err;
    }
}



