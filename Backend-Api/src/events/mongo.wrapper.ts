import mongoose, { ClientSession } from "mongoose";

const MAX_MONGO_TX_RETRIES = 2;

export async function withMongoTransaction<T>(
  fn: (session: ClientSession) => Promise<T>
): Promise<T | undefined>  {
  const session = await mongoose.startSession();

  try {
    for (let attempt = 1; attempt <= MAX_MONGO_TX_RETRIES; attempt++) {
      session.startTransaction();

      try {
        const fnResult = await fn(session);

        // ✅ Only commit if session is still in a transaction
        if (!session.inTransaction()) {
          throw new Error("Transaction was aborted during execution");
        }

        let committed = false;
        while (!committed) {
          try {
            await session.commitTransaction();
            committed = true;
          } catch (commitErr: any) {
            if (commitErr?.hasErrorLabel?.("UnknownTransactionCommitResult")) {
              continue;
            }
            throw commitErr;
          }
        }

        return fnResult;

      } catch (err: any) {
        if (session.inTransaction()) {
          await session.abortTransaction();
        }

        const isTransient = err?.hasErrorLabel?.("TransientTransactionError");
        const isAborted = err?.code === 251;

        if ((isTransient || isAborted) && attempt < MAX_MONGO_TX_RETRIES) {
          continue;
        }

        throw err;
      }
    }

    throw new Error("Transaction failed after exhausting all retries");
  } finally {
    await session.endSession();
  }
}