import mongoose, { ClientSession } from "mongoose";

export interface ProcessedEvent {
  eventId: string;
  topic?: string;
  consumerGroup: string;
  attemptCount: number; // total number of attempts made so far, incl. current
  succeededOnAttempt?: number; // set once, at COMPLETED time: which attempt won
  retryTopic?: string;
  status: "PROCESSING" | "COMPLETED" | "FAILED";
  leaseExpiresAt?: Date; // only meaningful while status === "PROCESSING"
  processedAt: Date;
  updatedAt: Date;
  expiresAt: Date;
  version: number;
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
  const collection =
    mongoose.connection.collection<ProcessedEvent>("processed_events");

  await collection.createIndex(
    { eventId: 1, consumerGroup: 1, topic: 1 },
    { unique: true },
  );

  await collection.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });

  processedEventsCollection = collection;
  return collection;
};

let failedEventsCollection: mongoose.Collection<FailedEvent>;

export const initFailedEvents = async () => {
  if (failedEventsCollection) return failedEventsCollection;

  const collection =
    mongoose.connection.collection<FailedEvent>("failed_events");

  await collection.createIndex({ failedAt: 1 });

  failedEventsCollection = collection;
  return collection;
};

const STALE_THRESHOLD_MS = 180 * 1000; // lease duration: how long a worker may hold PROCESSING before it's reclaimable

export type IdempotencyResult =
  | { decision: "PROCESSED"; version: number }
  | { decision: "RETRY"; version: number }
  | { decision: "SKIP" };

const TTL = {
  COMPLETED: 14 * 24 * 60 * 60 * 1000, // 14 days
  FAILED: 30 * 24 * 60 * 60 * 1000, // 30 days
  PROCESSING: 14 * 24 * 60 * 60 * 1000, // overwritten on completion/failure
};

export const initIdempotency = async (
  eventId: string,
  topic?: string,
  consumerGroup?: string,
  session?: ClientSession,
): Promise<IdempotencyResult> => {
  const collection = await initProcessedEvents();
  if (!consumerGroup) throw new Error("consumerGroup is required");

  try {
    await collection.insertOne(
      {
        eventId,
        topic,
        consumerGroup,
        attemptCount: 1, // this insert IS attempt #1
        status: "PROCESSING",
        leaseExpiresAt: new Date(Date.now() + STALE_THRESHOLD_MS),
        processedAt: new Date(),
        updatedAt: new Date(),
        expiresAt: new Date(Date.now() + TTL.PROCESSING),
        version: 0,
      },
      session ? { session } : {},
    );

    return { decision: "PROCESSED", version: 0 };
  } catch (err: any) {
    if (err.code !== 11000) throw err;

    // Lookup by identity only. attemptCount is store-owned state, not part
    // of identity, so it must never be used to filter "does this exist".
    const existing = await collection.findOne(
      { eventId, consumerGroup, topic },
      session ? { session } : {},
    );

    if (!existing) return { decision: "PROCESSED", version: 0 };

    if (existing.status === "COMPLETED") return { decision: "SKIP" };

    if (existing.status === "FAILED") {
      // A previously failed event is retryable. Bump attemptCount so the
      // doc keeps an accurate count of every attempt, including this one.
      const result = await collection.updateOne(
        {
          eventId,
          consumerGroup,
          topic,
          status: "FAILED",
          version: existing.version,
        },
        {
          $set: {
            status: "PROCESSING",
            leaseExpiresAt: new Date(Date.now() + STALE_THRESHOLD_MS),
            updatedAt: new Date(),
            expiresAt: new Date(Date.now() + TTL.PROCESSING),
          },
          $inc: { version: 1, attemptCount: 1 },
        },
        session ? { session } : {},
      );

      if (result.matchedCount === 0) return { decision: "SKIP" };

      return { decision: "RETRY", version: existing.version + 1 };
    }

    if (existing.status === "PROCESSING") {
      const leaseExpired =
        !existing.leaseExpiresAt || existing.leaseExpiresAt < new Date();

      if (leaseExpired) {
        const result = await collection.updateOne(
          {
            eventId,
            consumerGroup,
            topic,
            status: "PROCESSING",
            version: existing.version,
          },
          {
            $set: {
              leaseExpiresAt: new Date(Date.now() + STALE_THRESHOLD_MS),
              updatedAt: new Date(),
            },
            $inc: { version: 1, attemptCount: 1 },
          },
          session ? { session } : {},
        );

        if (result.matchedCount === 0) return { decision: "SKIP" };

        return { decision: "RETRY", version: existing.version + 1 };
      }
      return { decision: "SKIP" };
    }

    return { decision: "SKIP" };
  }
};

export const completeIdempotency = async (
  eventId: string,
  consumerGroup: string,
  expectedVersion: number,
  session?: ClientSession,
  retryTopic?: string,
  topic?: string,
): Promise<void> => {
  const collection = await initProcessedEvents();

  const result = await collection.findOneAndUpdate(
    {
      eventId,
      consumerGroup,
      topic,
      status: "PROCESSING",
      version: expectedVersion,
    },
    [
      {
        $set: {
          status: "COMPLETED",
          retryTopic,
          succeededOnAttempt: "$attemptCount",
          updatedAt: new Date(),
          expiresAt: new Date(Date.now() + TTL.COMPLETED),
          version: { $add: ["$version", 1] },
        },
      },
    ],
    { returnDocument: "after", ...(session ? { session } : {}) },
  );

  if (!result) {
    throw new Error(
      `IdempotencyVersionMismatch: eventId=${eventId}, consumerGroup=${consumerGroup}, expectedVersion=${expectedVersion}`,
    );
  }
};

export const failIdempotency = async (
  eventId: string,
  consumerGroup: string,
  topic: string,
  expectedVersion: number,
  session?: ClientSession,
): Promise<void> => {
  const collection = await initProcessedEvents();

  const result = await collection.updateOne(
    {
      eventId,
      consumerGroup,
      topic,
      status: "PROCESSING",
      version: expectedVersion,
    },
    {
      $set: {
        status: "FAILED",
        updatedAt: new Date(),
        expiresAt: new Date(Date.now() + TTL.FAILED),
      },
      $inc: { version: 1 },
    },
    session ? { session } : {},
  );

  if (result.matchedCount === 0) {
    throw new Error(
      `IdempotencyVersionMismatch: eventId=${eventId}, consumerGroup=${consumerGroup}, expectedVersion=${expectedVersion}`,
    );
  }
};
