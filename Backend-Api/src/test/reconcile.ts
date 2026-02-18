import mongoose from "mongoose";
import { LedgerAccount } from "@/modules/ledger/ledgerAccount.model";
import { Wallet } from "@/modules/wallet/wallet.model";
import { LedgerEntry, LedgerEntryNature } from "@/modules/ledger/ledger.entry.model";

const MONGO_URI =
  "mongodb://beejay:Makanaki_12345@127.0.0.1:27017/zely_app?authSource=zely_app&replicaSet=rs0";

async function checkWalletDiscrepancy(walletId: string) {
  const wallet = await Wallet.findById(walletId).lean();
  if (!wallet) return console.log("Wallet not found");

  const available = wallet.availableBalance ?? wallet.availableBalance;
  const locked = wallet.lockedBalance ?? wallet.lockedBalance;
  const walletTotal = available + locked;
  console.log("Wallet total:", walletTotal);

  const accounts = await LedgerAccount.find({ walletId: wallet._id }).lean();
  if (!accounts.length) return console.log("No ledger accounts found");

  let ledgerTotal = 0;

  for (const acc of accounts) {
    const agg = await LedgerEntry.aggregate([
      { $match: { ledgerAccountId: acc._id } },
      {
        $group: {
          _id: null,
          balance: {
            $sum: {
              $cond: [
                { $eq: ["$nature", LedgerEntryNature.CREDIT] },
                "$amount",
                { $multiply: ["$amount", -1] },
              ],
            },
          },
        },
      },
    ]);

    ledgerTotal += agg[0]?.balance?.toNumber?.() ?? agg[0]?.balance ?? 0;
  }

  console.log("Ledger total:", ledgerTotal);

  const discrepancy = walletTotal - ledgerTotal;
  if (discrepancy !== 0) {
    console.log(`⚠️ Discrepancy detected for wallet ${walletId}:`, discrepancy);
  } else {
    console.log(`✅ Wallet matches ledger`);
  }
}

async function main() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("✅ Connected to MongoDB");

    await checkWalletDiscrepancy("696380012de69b733ea49fb5");
  } catch (err) {
    console.error("Mongo connection error:", err);
  } finally {
    await mongoose.disconnect();
    console.log("Disconnected");
  }
}

main();
