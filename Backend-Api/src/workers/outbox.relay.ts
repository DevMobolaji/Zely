import { OutboxEvent } from '@/modules/audit/outbox.model';
import { producer } from '@/kafka/config';


function sleep(ms: number) {
  return new Promise(res => setTimeout(res, ms));
}

export async function runOutboxRelay() {
  // === Step 1: Connect to Kafka with retry ===
  let connected = false;
  while (!connected) {
    try {
      await producer.connect();
      connected = true;
      console.log(`[${new Date().toISOString()}] Kafka producer connected`);
    } catch (err) {
      console.error('Kafka connection failed, retrying in 5s...', err);
      await sleep(5000);
    }
  }

  // === Step 2: Start relay loop ===
  console.log(`[${new Date().toISOString()}] Starting outbox relay loop`);

  while (true) {
    try {
      const event = await OutboxEvent.findOneAndUpdate(
        {
          status: 'PENDING',
          $and: [
            { $or: [{ lockedAt: null }, { lockedAt: { $lt: new Date(Date.now() - 60_000) } }] },
            { $or: [{ nextRetryAt: null }, { nextRetryAt: { $lte: new Date() } }] },
          ],
        },
        { status: 'PROCESSING', lockedAt: new Date() },
        { sort: { createdAt: 1 }, returnDocument: 'after' }
      );

      if (!event) {
        await sleep(1000);
        continue;
      }

      // === Step 3: Send to Kafka ===
      try {
        const envelope = {
          meta: {
            retryCount: event.retryCount ?? 0,
            createdAt: new Date().toISOString(),
          },
          event: {
            eventId: event.eventId,
            eventType: event.eventType,
            aggregateId: event.aggregateId,
            aggregateType: event.aggregateType,
            payload: event.payload,
            createdAt: event.createdAt,
            version: event.version,
            action: event.action,
            status: event.status,
            context: event.context,
            occurredAt: event.occurredAt ?? new Date().toISOString(),
          },
        };
        await producer.send({
          topic: event.topic,
          acks: -1,
          messages: [
            {
              key: event.eventId,
              value: JSON.stringify(envelope), // ✅ send the full envelope
            },
          ],
        });
        console.log(`[${new Date().toISOString()}] Event sent`, event.eventId);

        // Mark as PROCESSED only if send succeeds
        await OutboxEvent.updateOne(
          { _id: event._id, status: 'PROCESSING' },
          {
            status: 'PROCESSED',
            sentAt: new Date(),
            lockedAt: null,
          }
        );
        console.log(`[${new Date().toISOString()}] Event marked as processed`, event.eventId);
      } catch (err: any) {
        console.error(`[${new Date().toISOString()}] Kafka send failed`, event.eventId, err);

        const retries = (event.retryCount ?? 0) + 1;

        if (retries >= 5) {
          await OutboxEvent.updateOne(
            { _id: event._id },
            {
              status: 'FAILED',
              retryCount: retries,
              failedAt: new Date(),
              error: err.message,
              lockedAt: null,
            }
          );
        } else {
          await OutboxEvent.updateOne(
            { _id: event._id },
            {
              status: 'PENDING',
              retryCount: retries,
              nextRetryAt: new Date(Date.now() + retries ** 2 * 5000),
              lockedAt: null,
            }
          );
        }
      }
    } catch (loopErr) {
      console.error(`[${new Date().toISOString()}] Relay loop error`, loopErr);
      await sleep(1000);
    }
  }
}
