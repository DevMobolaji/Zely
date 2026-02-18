import mongoose, { ClientSession } from "mongoose";

const MAX_MONGO_TX_RETRIES = 1;

export async function withMongoTransaction(
  fn: (session: ClientSession) => Promise<void>
) {
  const session = await mongoose.startSession();

  try {
    for (let attempt = 1; attempt <= MAX_MONGO_TX_RETRIES; attempt++) {
      session.startTransaction();

      try {
        await fn(session);

        while (true) {
          try {
            await session.commitTransaction();
            return; // ✅ fully committed
          } catch (commitErr: any) {
            if (commitErr?.hasErrorLabel?.("UnknownTransactionCommitResult")) {
              // Commit result unknown → retry commit
              continue;
            }

            if (commitErr?.hasErrorLabel?.("TransientTransactionError")) {
              // Commit failed → retry entire transaction
              break;
            }

            throw commitErr;
          }
        }
      } catch (err: any) {
        if (session.inTransaction()) {
          await session.abortTransaction();
        }

        if (err?.hasErrorLabel?.("TransientTransactionError")) {
          // Retry entire transaction
          continue;
        }

        throw err;
      }
    }
  } finally {
    await session.endSession();
  }
}


