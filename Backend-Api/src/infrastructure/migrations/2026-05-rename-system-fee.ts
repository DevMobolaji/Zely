// src/infrastructure/migrations/2026-05-rename-system-fee.ts
import mongoose from "mongoose";
import { logger } from "@/shared/utils/logger";

/**
 * Migration: SYSTEM_FEE → SYSTEM_TREASURY
 * 
 * Reason: We unified WalletType and LedgerAccountType into a single enum.
 * The legacy "SYSTEM_FEE" wallet type didn't exist in LedgerAccountType,
 * which used "SYSTEM_TREASURY". This migration renames the wallet type
 * to match.
 * 
 * Idempotent — safe to run multiple times.
 */
export async function migrateSystemFeeToTreasury() {
  const result = await mongoose.connection
    .collection("wallets")
    .updateMany(
      { type: "SYSTEM_FEE" },
      { $set: { type: "SYSTEM_TREASURY" } }
    );

  logger.info("✅ Migration complete: SYSTEM_FEE → SYSTEM_TREASURY", {
    matched: result.matchedCount,
    modified: result.modifiedCount,
  });

  return result;
}