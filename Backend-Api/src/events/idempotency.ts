import mongoose from "mongoose";

export interface ProcessedEvent {
  _id: string;        // eventId
  processedAt: Date;
  topic?: string;
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

  await collection.createIndex({ processedAt: 1 }, { expireAfterSeconds: 30 * 24 * 3600 });

  processedEventsCollection = collection;
  return collection;
};

// Optional failed events collection
let failedEventsCollection: mongoose.Collection<FailedEvent>;

export const initFailedEvents = async () => {
  if (failedEventsCollection) return failedEventsCollection;

  const collection = mongoose.connection.collection<FailedEvent>("failed_events");

  await collection.createIndex({ failedAt: 1 });

  failedEventsCollection = collection;
  return collection;
};

/**
 * Ensure idempotent processing using Mongoose transaction session
 */
export const ensureIdempotent = async (
  eventId: string,
  session: mongoose.ClientSession,
  topic: string
): Promise<boolean> => {
  const collection = await initProcessedEvents();

  try {
    await collection.insertOne(
      { _id: eventId, processedAt: new Date(), topic},
      { session }
    );
    return true; // first-time processing
  } catch (err: any) {
    if (err.code === 11000) return false; // duplicate, already processed
    throw err;
  }
};
