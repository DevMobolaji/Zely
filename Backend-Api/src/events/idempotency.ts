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


export const intIdempotency = async (
  eventId: string,
  session: mongoose.ClientSession | null,
  topic?: string,
  consumerGroup?: string
): Promise<"PROCESSED" | "SKIP"> => {
  const collection = await initProcessedEvents();

  if (!consumerGroup) {
    throw new Error("consumerGroup is required for idempotency");
  }

  try {
    await collection.insertOne(
      {
        eventId,
        topic,
        consumerGroup,
        status: "COMPLETED",
        processedAt: new Date(),
        updatedAt: new Date(),
      },
      session ? { session } : undefined
    );
    return "PROCESSED";
  } catch (err: any) {
    if (err.code !== 11000) throw err;

    const existing = await collection.findOne(
      { eventId, consumerGroup },
      session ? { session } : undefined
    )

    if (!existing) return "PROCESSED";

    if (existing.status === "COMPLETED") {
      return "SKIP"; 
    }

    // PROCESSING → possible crash scenario
    return "SKIP"; // or implement stale logic if needed
  }
};


