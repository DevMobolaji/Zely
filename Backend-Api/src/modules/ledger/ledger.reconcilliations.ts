import { Wallet, WalletStatus } from "@/modules/wallet/wallet.model";
import { LedgerAccount, LedgerAccountType } from "@/modules/ledger/ledgerAccount.model";
import { LedgerEntry, LedgerEntryNature } from "@/modules/ledger/ledger.entry.model";
import { logger } from "@/shared/utils/logger";
import mongoose from "mongoose";
import { freezeWallet } from "../helpers/resolvers";
import { reconciliationQueue } from "@/workers/reconcileLedger.worker";



export class LedgerReconciliationService {
  static async reconcileWallet(walletId: string) {
    const session = await mongoose.startSession();

    try {
      session.startTransaction();

      const wallet = await Wallet.findOneAndUpdate(
        { _id: walletId, status: "ACTIVE" },
        { $set: { status: "RECONCILING" } },
        { session }
      );

      if (!wallet) {
        await session.abortTransaction();
        logger.error("Wallet not found", { walletId });
        return;
      }

      if (wallet.status !== WalletStatus.ACTIVE) {
        await session.abortTransaction();
        logger.error("Wallet not active", { walletId });
        return;
      }

      const [checkingLedger, savingsLedger] = await Promise.all([
        LedgerAccount.findOne({
          walletId: wallet._id,
          type: LedgerAccountType.MAIN_CHECKINGS,
        }).session(session),
        LedgerAccount.findOne({
          walletId: wallet._id,
          type: LedgerAccountType.SAVINGS,
        }).session(session),
      ]);

      if (!checkingLedger || !savingsLedger) {
        logger.error("Missing ledger accounts", { walletId });
        await freezeWallet(walletId, "Ledger account missing", null, session);
        await session.commitTransaction();
        return;
      }

      const aggregateBalance = async (ledgerAccountId: mongoose.Types.ObjectId) => {
        const res = await LedgerEntry.aggregate([
          { $match: { ledgerAccountId: ledgerAccountId } },
          {
            $group: {
              _id: null,
              balance: {
                $sum: {
                  $cond: [
                    { $eq: ["$type", LedgerEntryNature.CREDIT] },
                    "$amount",
                    { $multiply: ["$amount", -1] },
                  ],
                },
              },
            },
          },
        ]).session(session);

        return res[0]?.balance ?? 0;
      };

      console.log("Aggregate balance", await aggregateBalance(checkingLedger._id));
      console.log(checkingLedger)


      const [ledgerAvailable] = await Promise.all([
        aggregateBalance(checkingLedger._id),
      ])

      const ledgerTotal = ledgerAvailable;

      const walletTotal = wallet.availableBalance + wallet.lockedBalance;

      if (ledgerTotal !== walletTotal) {
        logger.error("Ledger mismatch detected", {
          walletId,
          ledgerAvailable,
        });

        await freezeWallet(walletId, "Ledger Mismatch detected", null, session);

        await session.commitTransaction();
        return;
      }

      await Wallet.updateOne(
        { _id: wallet._id },
        { $set: { status: "ACTIVE" } },
        { session }
      );

      await session.commitTransaction()

      //🔥 Option 1: Auto-heal (optional)
      await Wallet.updateOne(
        { _id: wallet._id },
        { $set: { availableBalance: ledgerAvailable } }
      );

      logger.warn("Wallet balance auto-healed", {
        walletId,
        correctedBalance: ledgerAvailable,
      });
    } catch (error) {
      if (session.inTransaction()) {
        await session.abortTransaction();
      }
      throw error;
    } finally {
      session.endSession();
    }
  }

  static async enqueueAllWallets(batchSize = 100) {
    let skip = 0;

    while (true) {
      const wallets = await Wallet.find()
        .skip(skip)
        .limit(batchSize)
        .select("_id")
        .lean();

      if (wallets.length === 0) break;

      for (const wallet of wallets) {
        await reconciliationQueue.add("reconcile-wallet", {
          walletId: wallet._id.toString(),
        });
      }

      skip += batchSize;
    }

    console.log("All wallets enqueued for reconciliation");
  }
}




