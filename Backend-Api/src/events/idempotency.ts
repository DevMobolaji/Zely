import mongoose from "mongoose";

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

  await collection.createIndex({ eventId: 1, consumerGroup: 1 }, { unique: true }); // ✅ THIS is what makes 11000 fire
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


// idempotency.ts

export const initIdempotency = async (
  eventId: string,
  topic?: string,
  consumerGroup?: string
): Promise<"PROCESSED" | "SKIP" | "RETRY"> => {
  const collection = await initProcessedEvents();
  if (!consumerGroup) throw new Error("consumerGroup is required");

  // ✅ Insert OUTSIDE the transaction — no session here
  try {
    await collection.insertOne({
      eventId,
      topic,
      consumerGroup,
      status: "PROCESSING",
      processedAt: new Date(),
      updatedAt: new Date(),
    });
    return "PROCESSED";
  } catch (err: any) {
    if (err.code !== 11000) throw err;

    // ✅ Find OUTSIDE the transaction too
    const existing = await collection.findOne({ eventId, consumerGroup });

    if (!existing) return "PROCESSED";

    if (existing.status === "COMPLETED") return "SKIP";

    if (existing.status === "PROCESSING") {
      const ageMs = Date.now() - existing.updatedAt.getTime();
      const STALE_THRESHOLD_MS = 2 * 1000;

      if (ageMs > STALE_THRESHOLD_MS) {
        // Stale — take ownership
        await collection.updateOne(
          { eventId, consumerGroup },
          { $set: { status: "PROCESSING", updatedAt: new Date() } }
        );
        return "RETRY";
      }

      // Fresh PROCESSING — another instance handling it
      return "SKIP";
    }

    return "SKIP";
  }
};

// ✅ Complete OUTSIDE the transaction too
export const completeIdempotency = async (
  eventId: string,
  consumerGroup: string,
  retryTopic?: string,
): Promise<void> => {
  const collection = await initProcessedEvents();

  await collection.updateOne(
    { eventId, consumerGroup },
    { $set: { status: "COMPLETED", retryTopic, updatedAt: new Date() } }
    // ✅ No session — outside the transaction
  );
};

