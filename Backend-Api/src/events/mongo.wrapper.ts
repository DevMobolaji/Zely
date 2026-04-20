import mongoose, { ClientSession } from "mongoose";
import { withMongoBreaker } from "@/infrastructure/resilience/breakers/mongodb.breaker";
import { mongoTransactionTotal, mongoOperationDuration } from "@/infrastructure/resilience/metrics";

const MAX_MONGO_TX_RETRIES = 2;

export async function withMongoTransaction<T>(
  fn: (session: ClientSession) => Promise<T>
): Promise<T | undefined> {
  const timer = mongoOperationDuration.startTimer({
    operation: 'transaction',
    collection: 'session',
  });

  let timerCalled = false;
  const endTimer = () => {
    if (!timerCalled) {
      timerCalled = true;
      timer();
    }
  };

  return withMongoBreaker(async () => {
    const session = await mongoose.startSession();

    try {
      for (let attempt = 1; attempt <= MAX_MONGO_TX_RETRIES; attempt++) {
        session.startTransaction();

        try {
          const fnResult = await fn(session);

          if (!session.inTransaction()) {
            mongoTransactionTotal.inc({ status: 'success' });
            endTimer();
            return fnResult;
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

          mongoTransactionTotal.inc({ status: 'success' });
          endTimer();
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

          mongoTransactionTotal.inc({ status: 'failure' });
          endTimer();
          throw err;
        }
      }

      throw new Error("Transaction failed after exhausting all retries");
    } finally {
      await session.endSession();
      endTimer(); // safety net — ensures timer always ends
    }
  }, 'withMongoTransaction');
}