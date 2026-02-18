import { extIdempotenceModel } from "@/modules/helpers/idempotence.model";
import BadRequestError from "@/shared/errors/badRequest";
import { ClientSession } from "mongoose";

export async function extEnsureIdempotence(
  idempotencyKey: string,
  session: ClientSession
): Promise<{ alreadyCompleted: boolean; response?: any }> {
  try {
    // Atomically try to insert IN_PROGRESS
    const existing = await extIdempotenceModel.findOneAndUpdate(
      { idempotencyKey },
      { $setOnInsert: { status: "IN_PROGRESS", createdAt: new Date() } },
      { upsert: true, new: true, session }
    );

    // If already completed, return early
    if (existing.status === "COMPLETED") {
      console.error(`Duplicate idempotency attempt: ${idempotencyKey}`);
      throw new BadRequestError("Transfer already completed");
    }

    // If the document already existed as IN_PROGRESS
    if (existing.status === "IN_PROGRESS" && existing.created < new Date()) {
      throw new BadRequestError("Transfer already in progress");
    }

    return { alreadyCompleted: false };

  } catch (err: any) {
    // Duplicate key outside transaction (rare, defensive)
    if (err.code === 11000) {
      const existing = await extIdempotenceModel.findOne({ idempotencyKey }).session(session);
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

export async function completedIdempotence(
  idempotencyKey: string,
  transactionRef: string,
  response: any,
  session: any
) {
  await extIdempotenceModel.updateOne({
    idempotencyKey
  },{
    status: "COMPLETED", transactionRef, response
  }, { session })
}
