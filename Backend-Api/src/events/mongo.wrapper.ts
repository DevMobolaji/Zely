import mongoose, { ClientSession } from "mongoose";

const MAX_MONGO_TX_RETRIES = 3;

export async function withMongoTransaction(
  fn: (session: ClientSession) => Promise<void>
) {
  const session = await mongoose.startSession();

  try {
    for (let attempt = 1; attempt <= MAX_MONGO_TX_RETRIES; attempt++) {
      session.startTransaction();

      try {
        await fn(session);

        // ✅ Commit retry loop (CRITICAL)
        let committed = false;

        while (!committed) {
          try {
            await session.commitTransaction();
            committed = true;
          } catch (commitErr: any) {
            const isUnknown =
              commitErr?.hasErrorLabel?.("UnknownTransactionCommitResult");

            if (isUnknown) {
              // 🔁 Retry commit ONLY (not full transaction)
              continue;
            }

            // ⚠️ ANY other commit error → assume commit MAY HAVE SUCCEEDED
            // Do NOT retry full transaction
            throw commitErr;
          }
        }

        return; // ✅ success
      } catch (err: any) {
        if (session.inTransaction()) {
          await session.abortTransaction();
        }

        const isTransient =
          err?.hasErrorLabel?.("TransientTransactionError");

        if (isTransient && attempt < MAX_MONGO_TX_RETRIES) {
          continue; // 🔁 retry full transaction safely
        }

        throw err;
      }
    }

    throw new Error("Transaction failed after exhausting all retries");
  } finally {
    await session.endSession();
  }
}