import { extIdempotenceModel } from "@/modules/helpers/idempotence.model";
import BadRequestError from "@/shared/errors/badRequest";
import { logger } from "@/shared/utils/logger";

const THRESHOLD = 2 * 60 * 1000 //2Min

export async function extEnsureIdempotence(
  idempotencyKey: string,
): Promise<{ alreadyCompleted: boolean; response?: any }> {
  try {
    const now = new Date()

    // Atomically try to insert IN_PROGRESS at first instance
    const doc = await extIdempotenceModel.findOneAndUpdate(
      { idempotencyKey },
      { $setOnInsert: { status: "IN_PROGRESS", createdAt: now, lastUpdatedAt: now }
     },
      { upsert: true, new: true }
    );

    const isNew = doc.createdAt.getTime() === doc.lastUpdatedAt.getTime();

    if (!isNew) {
      if (doc.status === "COMPLETED") {
        logger.error(`Duplicate idempotency attempt: ${idempotencyKey}`);
        return { alreadyCompleted: true, response: doc.response };
      }

      // If the document already existed as IN_PROGRESS
      if (doc.status === "IN_PROGRESS" ) {
        const isStale =
          Date.now() - new Date(doc.lastUpdatedAt).getTime() >
          THRESHOLD;

        if (!isStale) {
          throw new BadRequestError("Transfer already in progress");
        }
      }

      // Atomic takeover
      const takeover = await extIdempotenceModel.findOneAndUpdate(
        {
          idempotencyKey,
          status: "IN_PROGRESS",
          lastUpdatedAt: doc.lastUpdatedAt
        },
        {
          $set: { lastUpdatedAt: now }
        },
        { new: true }
      );

      if (!takeover) {
        throw new BadRequestError("Transfer already being retried");
      }
    }

    if (doc.status === "FAILED") {
      await extIdempotenceModel.updateOne(
        { idempotencyKey, status: "FAILED" },
        {
          $set: {
            status: "IN_PROGRESS",
            lastUpdatedAt: new Date()
          }
        }
      );
    }

    return { alreadyCompleted: false };

  } catch (err: any) {
  if (err.code === 11000) {
    const existing = await extIdempotenceModel.findOne({ idempotencyKey })
    if (existing?.status === "COMPLETED") {
      return { alreadyCompleted: true, response: existing.response };
    }
    // Log duplicate attempt
    console.error(`Duplicate idempotency attempt: ${idempotencyKey}`);
    throw new BadRequestError("Transfer already in progress");
  }

  throw err;
}
}

export async function markCompleted(
  idempotencyKey: string,
  transactionRef: string,
  response: any
) {
  const res = await extIdempotenceModel.updateOne(
    { idempotencyKey, status: "IN_PROGRESS" },
    {
      $set: {
        status: "COMPLETED",
        transactionRef,
        response,
        lastUpdatedAt: new Date()
      }
    }
  );

  if (res.modifiedCount === 0) {
    // Check WHY it wasn't updated
    const existing = await extIdempotenceModel.findOne({ idempotencyKey });

    if (!existing) {
      throw new BadRequestError("Idempotency record not found");
    }

    if (existing.status === "COMPLETED") {
      // Duplicate concurrent request — already completed, safe to return
      return;
    }

    // Genuinely unexpected state (FAILED, PENDING, etc.)
    throw new BadRequestError(
      `Idempotency completion failed: invalid state (${existing.status})`
    );
  }
}


export async function markFailed(
  idempotencyKey: string,
  error: any
) {
  await extIdempotenceModel.updateOne(
    { idempotencyKey, status: "IN_PROGRESS" },
    {
      $set: {
        status: "FAILED",
        response: {
          error: error?.message || "Unknown error"
        },
        lastUpdatedAt: new Date()
      }
    }
  );
}