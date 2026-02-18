import { LedgerAccount, LedgerAccountType } from "@/modules/ledger/ledgerAccount.model";
import mongoose, { Types } from "mongoose";
import { generateLedgerAccountId } from "@/shared/utils/id.generator";
import { ensureSystemUser } from "@/infrastructure/helpers/systemUser.helper";
import {Wallet} from "@/modules/wallet/wallet.model";

export default async function ensureSystemLedger(currency: string) {

  const systemUser = await ensureSystemUser();
  const systemUserId = systemUser._id as mongoose.Types.ObjectId;
  const ledgerTypes: LedgerAccountType[] = Object.values(LedgerAccountType);

  const accounts: Record<string, any> = {};

  const systemWallet = await Wallet.findOneAndUpdate(
    { userPublicId: "SYSTEM_USER", currency },
    { $setOnInsert: { userPublicId: "SYSTEM_USER", currency, availableBalance: 1000000, } },
    { upsert: true, new: true }
  );
  

  for (const type of ledgerTypes) {
    const account = await LedgerAccount.findOneAndUpdate(
      { walletId: systemWallet._id, type, currency },
      {
        $setOnInsert: {
          userId: systemUserId,
          userPublicId: "SYSTEM_USER",
          walletId: systemWallet._id, // assuming system has a wallet with same ID
          type,
          currency,
          ledgerAccountId: generateLedgerAccountId(),
        },
      },
      { upsert: true, new: true } // create if not exist
    );

    accounts[type] = account;
  }

  return accounts;
}
