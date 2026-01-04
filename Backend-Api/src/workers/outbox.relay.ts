import { OutboxEvent } from '@/modules/audit/outbox.model';
import { producer, startKafkaProducer } from '@/kafka/config';

export async function runOutboxRelay() {
  await producer.connect();

  console.log(`[${new Date().toISOString()}] Kafka producer connected, starting relay loop`);

  setInterval(async () => {
    console.log(`[${new Date().toISOString()}] Polling for pending outbox events...`);

    let event;

    // Keep claiming one event at a time to prevent duplicates
    while (
      (event = await OutboxEvent.findOneAndUpdate(
        {
          status: 'PENDING',
          $or: [
            { lockedAt: null },
            { lockedAt: { $lt: new Date(Date.now() - 60_000) } }, // reclaim stale locks
          ],
        },
        {
          status: 'PROCESSING',
          lockedAt: new Date(),
        },
        { sort: { createdAt: 1 }, returnDocument: 'after' }
      ))
    ) {

      if(!event) {
        console.log(`[${new Date().toISOString()}] No pending events`);
        continue;
      }

      try {
        console.log(`[${new Date().toISOString()}] Sending event ${event.eventId} to topic ${event.eventType}`);

        await producer.send({
          topic: event.eventType,
          messages: [
            {
              key: event.aggregateId,
              value: JSON.stringify({
                eventId: event.eventId,
                eventType: event.eventType,
                aggregateId: event.aggregateId,
                aggregateType: event.aggregateType,
                payload: event.payload,
              }),
            },
          ],
        });

        await OutboxEvent.updateOne(
          { _id: event._id, status: 'PROCESSING' },
          { status: 'PROCESSED', sentAt: new Date() }
        );

        console.log(`[${new Date().toISOString()}] Event ${event.eventId} processed successfully`);
      } catch (err) {
        await OutboxEvent.updateOne(
          { _id: event._id },
          {
            status: 'FAILED',
            $inc: { retryCount: 1 },
          }
        );
        console.error(`[${new Date().toISOString()}] Failed to process event ${event.eventId}`, err);
      }
    }
  }, 2000);
}
