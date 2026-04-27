import mongoose, { ClientSession } from "mongoose";


export interface ProcessedEvent {
  eventId: string;        // eventId
  topic?: string;
  consumerGroup?: string;
  processedAt: Date;
  status: "PROCESSING" | "COMPLETED";
  updatedAt: Date
}

export interface FailedEvent {
  _id?: string;
  topic: string;
  key: string | null;
  payload: any;
  headers: Record<string, any>;
  error: string;
  failedAt: Date;
}

let processedEventsCollection: mongoose.Collection<ProcessedEvent>;

export const initProcessedEvents = async () => {
  if (processedEventsCollection) return processedEventsCollection;
  const collection = mongoose.connection.collection<ProcessedEvent>("processed_events");
  await collection.createIndex({ eventId: 1, consumerGroup: 1 }, { unique: true });
  await collection.createIndex({ processedAt: 1 }, { expireAfterSeconds: 30 * 24 * 3600 });
  processedEventsCollection = collection;
  return collection;
};


let failedEventsCollection: mongoose.Collection<FailedEvent>;

export const initFailedEvents = async () => {
  if (failedEventsCollection) return failedEventsCollection;

  const collection = mongoose.connection.collection<FailedEvent>("failed_events");

  await collection.createIndex({ failedAt: 1 });

  failedEventsCollection = collection;
  return collection;
};


const STALE_THRESHOLD_MS = 180 * 1000;

export type IdempotencyResult =
  | { decision: "PROCESSED"; version: number }
  | { decision: "RETRY"; version: number }
  | { decision: "SKIP" };


export const initIdempotency = async (
  eventId: string,
  topic?: string,
  consumerGroup?: string
): Promise<IdempotencyResult> => {
  const collection = await initProcessedEvents();
  if (!consumerGroup) throw new Error("consumerGroup is required");

  // Insert OUTSIDE any transaction — duplicate-key errors must not poison a session.
  try {
    await collection.insertOne({
      eventId,
      topic,
      consumerGroup,
      status: "PROCESSING",
      processedAt: new Date(),
      updatedAt: new Date(),
      version: 0,
    });
    return { decision: "PROCESSED", version: 0 };
  } catch (err: any) {
    if (err.code !== 11000) throw err;

    const existing = await collection.findOne({ eventId, consumerGroup });
    if (!existing) return { decision: "PROCESSED", version: 0 };
    if (existing.status === "COMPLETED") return { decision: "SKIP" };

    if (existing.status === "PROCESSING") {
      const ageMs = Date.now() - existing.updatedAt.getTime();

      if (ageMs > STALE_THRESHOLD_MS) {
        // Atomic stale-takeover via CAS on version.
        const result = await collection.updateOne(
          {
            eventId,
            consumerGroup,
            status: "PROCESSING",
            version: existing.version,
          },
          {
            $set: { updatedAt: new Date() },
            $inc: { version: 1 },
          }
        );

        if (result.matchedCount === 0) {
          return { decision: "SKIP" };
        }
        return { decision: "RETRY", version: existing.version + 1 };
      }

      return { decision: "SKIP" };
    }

    return { decision: "SKIP" };
  }
};

// ✅ Complete INSIDE the transaction too
export const completeIdempotency = async (
  eventId: string,
  consumerGroup: string,
  expectedVersion: number,
  session?: ClientSession,
  retryTopic?: string,
): Promise<void> => {
  const collection = await initProcessedEvents();

  const result = await collection.updateOne(
    {
      eventId,
      consumerGroup,
      status: "PROCESSING",
      version: expectedVersion,
    },
    {
      $set: { status: "COMPLETED", retryTopic, updatedAt: new Date() },
      $inc: { version: 1 },
    },
    session ? { session } : {}
  );

  if (result.matchedCount === 0) {
    // We don't own this claim anymore. Throw so the transaction aborts —
    // we MUST NOT let the business write commit if the completion can't.
    throw new Error(
      `IdempotencyVersionMismatch: claim for eventId=${eventId} was modified by another consumer. ` +
      `Expected version=${expectedVersion}. Aborting transaction.`
    );
  }
};

