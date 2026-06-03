import {
  LedgerAccount,
  LedgerAccountType,
  LedgerOwnerType,
} from "@/modules/ledger/ledger.account.model";
import mongoose from "mongoose";
import {
  generateLedgerAccountId,
  generateWalletId,
} from "@/shared/utils/id.generator";
import { ensureSystemUser } from "@/infrastructure/helpers/systemUser.helper";
import { Wallet } from "@/modules/wallet/wallet.model";
import { config } from "@/config/index";
import { logger } from "@/shared/utils/logger";
import {
  LedgerEntry,
  LedgerEntryNature,
  LedgerEntryType,
} from "../ledger.entry.model";
import TransactionBuilder from "../ledger.transaction.builder";
import { LedgerTransactionModel } from "../ledger.transaction.model";

const WALLET_BACKED_TYPES = [
  LedgerAccountType.SYSTEM_TREASURY,
  LedgerAccountType.SYSTEM_REVENUE,
  // EXTERNAL_FUNDING is virtual — no wallet
  // MAIN_CHECKINGS removed — not needed at system level
];

const ALL_SYSTEM_LEDGER_TYPES = [
  LedgerAccountType.SYSTEM_TREASURY,
  LedgerAccountType.SYSTEM_REVENUE,
  LedgerAccountType.EXTERNAL_FUNDING,
];

export default async function ensureSystemLedger(currency: string) {
  const systemUser = await ensureSystemUser();
  const systemUserId = systemUser._id as mongoose.Types.ObjectId;
  const accounts: Record<string, any> = {};

  // ─── 1. Create ledger accounts ───────────────────────────────────────────
  for (const type of ALL_SYSTEM_LEDGER_TYPES) {
    const account = await LedgerAccount.findOneAndUpdate(
      { userPublicId: "SYSTEM_USER", type, currency },
      {
        $setOnInsert: {
          userId: systemUserId,
          userPublicId: "SYSTEM_USER",
          ownerId: systemUserId,
          ownerType: LedgerOwnerType.SYSTEM,
          type,
          currency,
          ledgerAccountId: generateLedgerAccountId(),
        },
      },
      { upsert: true, new: true },
    );
    accounts[type] = account;
  }

  // ─── 2. Create wallets for wallet-backed types only ──────────────────────
  for (const type of WALLET_BACKED_TYPES) {
    const ledgerAccount = accounts[type];

    await Wallet.findOneAndUpdate(
      {
        userPublicId: "SYSTEM_USER",
        type,
        currency,
      },
      {
        $setOnInsert: {
          userPublicId: "SYSTEM_USER",
          type,
          currency,
          availableBalance: 0, // ← always 0 — funds come via top-up
          walletId: generateWalletId(),
          ledgerAccountId: ledgerAccount._id,
          status: "ACTIVE",
          lockedBalance: 0,
          locked: false,
        },
      },
      { upsert: true, new: true },
    );
  }

  // ─── 3. Auto-fund treasury in dev (uses proper top-up flow) ──────────────
  if (config.app.env !== "production") {
    await autofundTreasuryForDev(currency, accounts);
  }

  return accounts;
}

async function autofundTreasuryForDev(
  currency: string,
  accounts: Record<string, any>,
) {
  const SEED_AMOUNT = 1_000_000;
  const seedRef = `SYSTEM_DEV_SEED_${currency}`;

  // Idempotency check — has this seed already happened?
  const existing = await LedgerTransactionModel.findOne({
    transactionRef: seedRef,
  }).lean();

  if (existing) {
    //logger.info(`✅ Treasury already dev-seeded for ${currency}`);
    return;
  }

  const treasuryLedger = accounts[LedgerAccountType.SYSTEM_TREASURY];
  const externalLedger = accounts[LedgerAccountType.EXTERNAL_FUNDING];

  const treasuryWallet = await Wallet.findOne({
    userPublicId: "SYSTEM_USER",
    type: LedgerAccountType.SYSTEM_TREASURY,
    currency,
  });

  if (!treasuryWallet) {
    throw new Error("TREASURY_WALLET_NOT_FOUND_AFTER_SEED");
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const builder = new TransactionBuilder("DEPOSIT");

    builder.addDebit({
      transactionRef: seedRef,
      ledgerAccountId: externalLedger._id,
      amount: SEED_AMOUNT,
      currency,
      referenceId: seedRef,
      referenceType: LedgerEntryType.DEPOSIT,
      nature: "DEBIT",
    });

    builder.addCredit({
      transactionRef: seedRef,
      ledgerAccountId: treasuryLedger._id,
      amount: SEED_AMOUNT,
      currency,
      referenceId: seedRef,
      referenceType: LedgerEntryType.DEPOSIT,
      nature: "CREDIT",
    });

    await builder.commit(session);

    // Update the treasury wallet's cached balance
    await Wallet.updateOne(
      { _id: treasuryWallet._id },
      { $inc: { availableBalance: SEED_AMOUNT } },
      { session },
    );

    await session.commitTransaction();

    // logger.info(`✅ Treasury dev-seeded with proper double-entry`, {
    //   currency,
    //   amount: SEED_AMOUNT,
    //   ref: seedRef,
    // });
  } catch (err: any) {
    if (session.inTransaction()) await session.abortTransaction();
    logger.error("❌ Treasury dev-seeding failed", { error: err.message });
    throw err;
  } finally {
    session.endSession();
  }
}
