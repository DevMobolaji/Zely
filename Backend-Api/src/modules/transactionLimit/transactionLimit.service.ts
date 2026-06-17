import redis from "@/infrastructure/cache/redis.cli";
import { KycTier, TransactionLimitConfig } from "./transaction.limit.model";
import { TransactionUsage } from "./transaction.usage.model";
import BadRequestError from "@/shared/errors/badRequest";
import { WalletDocument } from "../wallet/wallet.model";
import { ClientSession } from "mongoose";
import { logger } from "@/shared/utils/logger";
import {
  CHECK_AND_INCREMENT_SCRIPT,
  CHECK_AND_INCREMENT_VELOCITY_SCRIPT,
} from "./transaction.limit.lua";

const CACHE_TTL_SECONDS = 300;

// ─────────────────────────────────────────────────────────────────────────────
// COALESCER
// Prevents thundering herd when Redis is down — same user fires many requests
// Only one DB query fires per user key, the rest wait for the same promise
// ─────────────────────────────────────────────────────────────────────────────

const inflightRequests = new Map<string, Promise<number>>();

function coalesce(key: string, fn: () => Promise<number>): Promise<number> {
  if (inflightRequests.has(key)) {
    return inflightRequests.get(key)!;
  }

  const promise = fn().finally(() => inflightRequests.delete(key));

  inflightRequests.set(key, promise);
  return promise;
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

async function getLimitsForTier(tier: KycTier, currency: string) {
  const cacheKey = `tx_limits:${tier}:${currency}`;

  const cached = await redis.get(cacheKey);

  // ─── 1. Safe cache read ─────────────────────────────
  if (cached) {
    try {
      if (typeof cached === "string") {
        return JSON.parse(cached);
      }
      return cached;
    } catch (err) {
      logger.warn("Corrupt Redis cache detected, deleting key", { cacheKey });
      await redis.delete(cacheKey);
    }
  }

  // ─── 2. DB fallback ─────────────────────────────────
  const config = await TransactionLimitConfig.findOne({
    tier,
    currency,
    isActive: true,
  }).lean();

  if (!config) {
    throw new BadRequestError(`TRANSACTION_LIMIT_CONFIG_NOT_FOUND_FOR_${tier}`);
  }

  // ─── 3. Best-effort cache write ─────────────────────
  await redis.set(cacheKey, JSON.stringify(config), CACHE_TTL_SECONDS);

  return config;
}

function getDailyKey(userId: string, currency: string): string {
  const today = new Date().toISOString().slice(0, 10);
  return `daily_tx:${userId}:${currency}:${today}`;
}

function getVelocityKey(userId: string): string {
  return `velocity:${userId}`;
}

function getToday(): string {
  return new Date().toISOString().slice(0, 10);
}

function secondsUntilMidnight(): number {
  const now = new Date();
  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);
  return Math.floor((endOfDay.getTime() - now.getTime()) / 1000);
}

// ─────────────────────────────────────────────────────────────────────────────
// REHYDRATION
// Called on Redis miss — reads DB, writes correct value + TTL back to Redis
// Self-healing: next request hits Redis again, no manual resync needed
// Coalesced per user to prevent thundering herd on DB
// ─────────────────────────────────────────────────────────────────────────────

async function getDailyTotalWithRehydration(
  userPublicId: string,
  currency: string,
): Promise<number> {
  const dailyKey = getDailyKey(userPublicId, currency);
  const cached = await redis.get<number>(dailyKey);

  if (cached !== null) {
    return typeof cached === "number" ? cached : Number(cached);
  }

  // Coalesce concurrent requests for the same user
  // Only one DB query fires — rest wait for the same promise
  return coalesce(`daily:${userPublicId}:${currency}`, async () => {
    const record = await TransactionUsage.findOne({
      userPublicId,
      currency,
      date: getToday(),
    }).lean();

    const total = record?.dailyTotal ?? 0;

    // Rehydrate with remaining TTL for today — not a hardcoded 5 mins
    await redis.set(dailyKey, total, secondsUntilMidnight());

    return total;
  });
}

async function getVelocityCountWithRehydration(
  userPublicId: string,
): Promise<number> {
  const velocityKey = getVelocityKey(userPublicId);
  const cached = await redis.get<number>(velocityKey);

  if (cached !== null) {
    return typeof cached === "number" ? cached : Number(cached);
  }

  return coalesce(`velocity:${userPublicId}`, async () => {
    const record = await TransactionUsage.findOne({
      userPublicId,
      date: getToday(),
    }).lean();

    if (!record) return 0;

    const now = new Date();
    const windowStart = new Date(record.hourWindowStart);
    const secondsElapsed = (now.getTime() - windowStart.getTime()) / 1000;

    // Window expired — velocity resets
    if (secondsElapsed > 3600) return 0;

    const count = record.hourlyCount;
    const secondsRemaining = Math.floor(3600 - secondsElapsed);

    // Rehydrate with remaining TTL — not a fresh 3600
    // If Redis was down for 20 mins, only 40 mins are left in the window
    await redis.set(velocityKey, count, secondsRemaining);

    return count;
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// ATOMIC DB FALLBACKS
// Used inside enforce() when Redis is down
// Mirrors what the Lua script does — check AND increment in one operation
// ─────────────────────────────────────────────────────────────────────────────

async function atomicIncrementDailyTotal(
  userPublicId: string,
  currency: string,
  amount: number,
  limit: number,
): Promise<boolean> {
  const today = getToday();

  // Single atomic operation — check $expr condition AND increment in one query
  // If condition fails (would exceed limit), findOneAndUpdate returns null
  const result = await TransactionUsage.findOneAndUpdate(
    {
      userPublicId,
      currency,
      date: today,
      $expr: { $lte: [{ $add: ["$dailyTotal", amount] }, limit] },
    },
    { $inc: { dailyTotal: amount } },
    { new: true },
  );

  if (!result) {
    // Document might not exist yet (first transaction of the day)
    // Try creating it — unique index prevents duplicates
    try {
      await TransactionUsage.create({
        userPublicId,
        currency,
        date: today,
        dailyTotal: amount,
        hourlyCount: 0,
        hourWindowStart: new Date(),
      });
      return true;
    } catch (err: any) {
      if (err.code === 11000) {
        // Duplicate key — another concurrent request created it first
        // Re-run the conditional update now that the document exists
        const retry = await TransactionUsage.findOneAndUpdate(
          {
            userPublicId,
            currency,
            date: today,
            $expr: { $lte: [{ $add: ["$dailyTotal", amount] }, limit] },
          },
          { $inc: { dailyTotal: amount } },
          { new: true },
        );
        return retry !== null;
      }
      throw err;
    }
  }

  return true;
}

async function atomicIncrementVelocity(
  userPublicId: string,
  limit: number,
): Promise<boolean> {
  const today = getToday();
  const now = new Date();

  // First check if the hour window has expired — if so reset the count
  const existing = await TransactionUsage.findOne({
    userPublicId,
    date: today,
  }).lean();

  if (existing) {
    const secondsElapsed =
      (now.getTime() - new Date(existing.hourWindowStart).getTime()) / 1000;

    if (secondsElapsed > 3600) {
      // Window expired — reset count and allow
      await TransactionUsage.findOneAndUpdate(
        { userPublicId, date: today },
        { $set: { hourlyCount: 1, hourWindowStart: now } },
        { new: true },
      );
      return true;
    }
  }

  // Window still active — check and increment atomically
  const result = await TransactionUsage.findOneAndUpdate(
    {
      userPublicId,
      date: today,
      $expr: { $lt: ["$hourlyCount", limit] },
    },
    { $inc: { hourlyCount: 1 } },
    { new: true },
  );

  if (!result) {
    // Document doesn't exist yet — first transaction of the day
    try {
      await TransactionUsage.create({
        userPublicId,
        date: today,
        dailyTotal: 0,
        hourlyCount: 1,
        hourWindowStart: now,
      });
      return true;
    } catch (err: any) {
      if (err.code === 11000) {
        const retry = await TransactionUsage.findOneAndUpdate(
          {
            userPublicId,
            date: today,
            $expr: { $lt: ["$hourlyCount", limit] },
          },
          { $inc: { hourlyCount: 1 } },
          { new: true },
        );
        return retry !== null;
      }
      throw err;
    }
  }

  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// DB COMMIT
// Always called after session.commitTransaction()
// Single atomic operation — no separate findOne + findOneAndUpdate
// ─────────────────────────────────────────────────────────────────────────────

async function commitToDatabase(
  userPublicId: string,
  amount: number,
  currency: string,
): Promise<void> {
  const now = new Date();
  const today = getToday();

  // BUG FIX: was doing findOne + findOneAndUpdate as two ops (race condition)
  // Now a single atomic operation using $expr to check if hour window has expired
  await TransactionUsage.findOneAndUpdate(
    { userPublicId, currency, date: today },
    [
      {
        $set: {
          // ── FIX: $ifNull defaults to 0 when field doesn't exist on upsert
          dailyTotal: { $add: [{ $ifNull: ["$dailyTotal", 0] }, amount] },

          hourlyCount: {
            $cond: {
              if: {
                $gt: [
                  { $subtract: [now, { $ifNull: ["$hourWindowStart", now] }] },
                  3600000,
                ],
              },
              then: 1,
              else: { $add: [{ $ifNull: ["$hourlyCount", 0] }, 1] },
            },
          },

          hourWindowStart: {
            $cond: {
              if: {
                $gt: [
                  { $subtract: [now, { $ifNull: ["$hourWindowStart", now] }] },
                  3600000,
                ],
              },
              then: now,
              else: { $ifNull: ["$hourWindowStart", now] },
            },
          },
        },
      },
    ],
    { upsert: true, new: true, updatePipeline: true },
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ENFORCE
// ─────────────────────────────────────────────────────────────────────────────

// export async function enforceTransactionLimits({
//   userId,
//   userPublicId,
//   kycTier,
//   amount,
//   currency,
//   senderWallet,
//   session,
// }: {
//   userId: string;
//   userPublicId: string;
//   kycTier: KycTier;
//   amount: number;
//   currency: string;
//   senderWallet: WalletDocument;
//   session: ClientSession;
// }): Promise<void> {

//   const limits = await getLimitsForTier(kycTier, currency);

//   // ─── 1. Per-transaction limit ─────────────────────────────────────────
//   if (limits.maxPerTransaction > 0 && amount > limits.maxPerTransaction) {
//     throw new BadRequestError(
//       `TRANSFER_EXCEEDS_PER_TRANSACTION_LIMIT_OF_${limits.maxPerTransaction}`
//     );
//   }

//   // ─── 2. Daily limit ───────────────────────────────────────────────────
//   // Redis UP  → Lua script — atomic check + increment in one operation
//   // Redis DOWN → atomicIncrementDailyTotal — same guarantee via $expr + $inc
//   if (limits.maxPerDay > 0) {
//     const dailyKey = getDailyKey(userPublicId, currency);

//     const result = await redis.execute(
//       async () => {
//         const client = redis.getClient();
//         return client.eval(
//           CHECK_AND_INCREMENT_SCRIPT,
//           1,
//           dailyKey,
//           limits.maxPerDay,
//           amount
//         ) as Promise<number>;
//       },
//       async () => {
//         // BUG FIX: was calling getVelocityCountWithRehydration (wrong function)
//         // atomicIncrementDailyTotal does atomic check + increment in MongoDB
//         const passed = await atomicIncrementDailyTotal(
//           userPublicId,
//           currency,
//           amount,
//           limits.maxPerDay
//         );
//         console.log("This is the passed value for daily total check", passed);
//         return passed ? 1 : -1;
//       },
//       `enforce:daily:${userPublicId}`
//     );

//     if (result === -1) {
//       throw new BadRequestError(
//         `TRANSFER_EXCEEDS_DAILY_LIMIT_OF_${limits.maxPerDay}`
//       );
//     }
//   }

//   // ─── 3. Velocity check ────────────────────────────────────────────────
//   // Redis UP  → Lua script — atomic check + increment in one operation
//   // Redis DOWN → atomicIncrementVelocity — same guarantee via $expr + $inc
//   if (limits.maxTransfersPerHour > 0) {
//     const velocityKey = getVelocityKey(userPublicId);

//     const result = await redis.execute(
//       async () => {
//         const client = redis.getClient();
//         return client.eval(
//           CHECK_AND_INCREMENT_VELOCITY_SCRIPT,
//           1,
//           velocityKey,
//           limits.maxTransfersPerHour
//         ) as Promise<number>;
//       },
//       async () => {
//         // BUG FIX: was calling getVelocityCountWithRehydration (read-only, wrong function)
//         // atomicIncrementVelocity does atomic check + increment in MongoDB
//         const passed = await atomicIncrementVelocity(
//           userPublicId,
//           limits.maxTransfersPerHour
//         );
//         console.log("This is the passed value", passed);
//         return passed ? 1 : -1;
//       },
//       `enforce:velocity:${userPublicId}`

//     );

//     console.log("This is the velocity result", result);

//     if (result === -1) {
//       throw new BadRequestError(
//         `TRANSFER_VELOCITY_LIMIT_EXCEEDED_MAX_${limits.maxTransfersPerHour}_PER_HOUR`
//       );
//     }
//   }
// }

export async function enforceTransactionLimits({
  userId,
  userPublicId,
  kycTier,
  amount,
  currency,
  senderWallet,
  session,
}: {
  userId: string;
  userPublicId: string;
  kycTier: KycTier;
  amount: number;
  currency: string;
  senderWallet: WalletDocument;
  session: ClientSession;
}): Promise<KycTier> {
  const DAILY_TX_TTL = 48 * 60 * 60; // 2 days
  const VELOCITY_TTL = 60 * 60; // 1 hour

  const limits = await getLimitsForTier(kycTier, currency);

  // 1. per-transaction
  if (limits.maxPerTransaction > 0 && amount > limits.maxPerTransaction) {
    throw new BadRequestError(
      `TRANSFER_EXCEEDS_PER_TRANSACTION_LIMIT_OF_${limits.maxPerTransaction}`,
    );
  }

  // 2. daily
  if (limits.maxPerDay > 0) {
    const dailyKey = getDailyKey(userPublicId, currency);

    // Warm the Redis key from MongoDB if missing (Redis was down)
    await redis.execute(
      async () => {
        await getDailyTotalWithRehydration(userPublicId, currency);
      },
      async () => {}, // Redis still down — rehydration skipped, fallback handles it
      `rehydrate:daily:${userPublicId}`,
    );

    const result = await redis.execute(
      async () => {
        const client = redis.getClient();
        const raw = await client.eval(
          CHECK_AND_INCREMENT_SCRIPT,
          1,
          dailyKey,
          limits.maxPerDay.toString(),
          amount.toString(),
          DAILY_TX_TTL.toString(),
        );
        logger.info("Daily Lua result", {
          raw,
          type: typeof raw,
          userPublicId,
        });
        return raw as number;
      },
      async () => {
        const passed = await atomicIncrementDailyTotal(
          userPublicId,
          currency,
          amount,
          limits.maxPerDay,
        );
        return passed ? 1 : -1;
      },
      `enforce:daily:${userPublicId}`,
    );

    logger.info("Daily check final result", { result, userPublicId });
    if (result === -1)
      throw new BadRequestError(
        `TRANSFER_EXCEEDS_DAILY_LIMIT_OF_${limits.maxPerDay}`,
      );
  }

  // 3. velocity
  if (limits.maxTransfersPerHour > 0) {
    const velocityKey = getVelocityKey(userPublicId);

    // Warm the Redis key from MongoDB if missing (Redis was down)
    await redis.execute(
      async () => {
        await getVelocityCountWithRehydration(userPublicId);
      },
      async () => {}, // Redis still down — rehydration skipped, fallback handles it
      `rehydrate:velocity:${userPublicId}`,
    );

    const result = await redis.execute(
      async () => {
        const client = redis.getClient();
        const raw = await client.eval(
          CHECK_AND_INCREMENT_VELOCITY_SCRIPT,
          1,
          velocityKey,
          limits.maxTransfersPerHour.toString(),
          VELOCITY_TTL.toString(),
        );
        logger.info("Velocity Lua result");
        return raw as number;
      },
      async () => {
        const passed = await atomicIncrementVelocity(
          userPublicId,
          limits.maxTransfersPerHour,
        );
        return passed ? 1 : -1;
      },
      `enforce:velocity:${userPublicId}`,
    );

    logger.info("Velocity check final result", { result, userPublicId });
    if (result === -1)
      throw new BadRequestError(
        `TRANSFER_VELOCITY_LIMIT_EXCEEDED_MAX_${limits.maxTransfersPerHour}_PER_HOUR`,
      );
  }

  logger.info("All limit checks passed");
  return kycTier;
}

// ─────────────────────────────────────────────────────────────────────────────
// COMMIT
// Called AFTER session.commitTransaction() succeeds
// MongoDB first (source of truth), Redis second (best effort)
// ─────────────────────────────────────────────────────────────────────────────

// ─── enforce stays the same — Lua increments Redis (reservation) ──────────

// ─── commit only writes MongoDB — Redis already updated by Lua ───────────
export async function commitTransactionLimits({
  userPublicId,
  amount,
  currency,
}: {
  userPublicId: string;
  amount: number;
  currency: string;
}): Promise<void> {
  // Only MongoDB — Redis was already incremented by Lua during enforce
  await commitToDatabase(userPublicId, amount, currency);
}

// ─── rollback decrements Redis if transaction fails after enforce ─────────
export async function rollbackTransactionLimits({
  userPublicId,
  amount,
  currency,
}: {
  userPublicId: string;
  amount: number;
  currency: string;
}): Promise<void> {
  const dailyKey = getDailyKey(userPublicId, currency);
  const velocityKey = getVelocityKey(userPublicId);

  await redis.execute(
    async () => {
      const client = redis.getClient();
      await client
        .multi()
        .incrby(dailyKey, -amount) // undo daily reservation
        .incrby(velocityKey, -1) // undo velocity reservation
        .exec();
    },
    async () => {
      logger.warn(
        "Redis down during rollback — will self-correct on rehydration",
      );
    },
    `rollback:${userPublicId}`,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// RECEIVER CAP
// ─────────────────────────────────────────────────────────────────────────────

export async function enforceReceiverBalanceCap({
  receiverWallet,
  receiverKycTier,
  amount,
  currency,
}: {
  receiverWallet: WalletDocument;
  receiverKycTier: KycTier;
  amount: number;
  currency: string;
}): Promise<void> {
  const limits = await getLimitsForTier(receiverKycTier, currency);

  if (limits.maxWalletBalance === 0) return;

  const projectedBalance = receiverWallet.availableBalance + amount;
  if (projectedBalance > limits.maxWalletBalance) {
    throw new BadRequestError(
      `RECEIVER_WALLET_BALANCE_WOULD_EXCEED_TIER_LIMIT_OF_${limits.maxWalletBalance}`,
    );
  }
}
