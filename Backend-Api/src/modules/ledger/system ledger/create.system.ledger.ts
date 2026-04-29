import { LedgerAccount, LedgerAccountType, LedgerOwnerType } from "@/modules/ledger/ledger.account.model";
import mongoose from "mongoose";
import { generateLedgerAccountId, generateWalletId } from "@/shared/utils/id.generator";
import { ensureSystemUser } from "@/infrastructure/helpers/systemUser.helper";
import { Wallet } from "@/modules/wallet/wallet.model";
import { config } from "@/config/index";
import { logger } from "@/shared/utils/logger";

// These ledger types need their own wallet
const WALLET_BACKED_TYPES = [
  LedgerAccountType.MAIN_CHECKINGS,
  LedgerAccountType.SYSTEM_TREASURY,
  LedgerAccountType.SYSTEM_REVENUE,
];

export default async function ensureSystemLedger(currency: string) {
  const systemUser = await ensureSystemUser();
  const systemUserId = systemUser._id as mongoose.Types.ObjectId;
  const ledgerTypes: LedgerAccountType[] = Object.values(LedgerAccountType);
  const accounts: Record<string, any> = {};

  // ─── Create all ledger accounts first ─────────────────────────────────────
  for (const type of ledgerTypes) {
    const account = await LedgerAccount.findOneAndUpdate(
      { userPublicId: 'SYSTEM_USER', type, currency },
      {
        $setOnInsert: {
          userId: systemUserId,
          userPublicId: 'SYSTEM_USER',
          ownerId: systemUserId,
          ownerType: LedgerOwnerType.SYSTEM,
          type,
          currency,
          ledgerAccountId: generateLedgerAccountId(),
        },
      },
      { upsert: true, new: true }
    );

    accounts[type] = account;
    //logger.info(`✅ System ledger account ensured: ${type} (${currency})`);
  }

  // ─── Create wallet for each wallet-backed ledger account ──────────────────
  for (const type of WALLET_BACKED_TYPES) {
    const ledgerAccount = accounts[type];

    const initialBalance = type === LedgerAccountType.MAIN_CHECKINGS
      ? config.app.env === 'production' ? 0 : 1_000_000
      : 0; // treasury and revenue always start at 0

    await Wallet.findOneAndUpdate(
      {
        userPublicId: 'SYSTEM_USER',
        type,
        currency,
      },
      {
        $setOnInsert: {
          userPublicId: 'SYSTEM_USER',
          type,
          currency,
          availableBalance: initialBalance,
          walletId: generateWalletId(),
          ledgerAccountId: ledgerAccount._id, // ← linked to ledger account
          status: 'ACTIVE',
          lockedBalance: 0,
          locked: false,
        }
      },
      { upsert: true, new: true }
    );

    //logger.info(`✅ System wallet ensured: ${type} (${currency})`);
  }

  return accounts;
}
