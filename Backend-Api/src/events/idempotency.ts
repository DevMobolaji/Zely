import mongoose from "mongoose";

export interface ProcessedEvent {
  eventId: string;        // eventId
  topic?: string;
  consumerGroup?: string;
  processedAt: Date;
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
): Promise<boolean> => {
  const collection = await initProcessedEvents();

  try {
    await collection.insertOne(
      { 
        eventId, 
        topic,
        consumerGroup,
        processedAt: new Date(), 
        },
      session ? { session } : undefined
    );
    return true; 
  } catch (err: any) {
    if (err.code === 11000) return false
    throw err;
  }
};
