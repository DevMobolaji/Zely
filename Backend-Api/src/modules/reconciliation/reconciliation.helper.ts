import { Types } from "mongoose";
import { LedgerAccountType, LedgerOwnerType } from "../ledger/ledger.account.model";
import vaultModel from "../vault/vault.model";
import { IRequestContext } from "@/config/interfaces/request.interface";
import { DriftAction, DriftSeverity, IDriftRecord } from "./reconciliation.model";
import { FreezeReason, Wallet, WalletStatus } from "../wallet/wallet.model";
import { logger } from "@/shared/utils/logger";
import { emitOutboxEvent } from "@/infrastructure/helpers/emit.audit.helper";
import { AuditAction, AuditStatus } from "../audit/audit.interface";
import { generateEventId } from "@/shared/utils/id.generator";
import { LedgerEntry, LedgerEntryNature } from "../ledger/ledger.entry.model";

const DRIFT_THRESHOLD = 0;
const BATCH_SIZE = 100;


// ─── Get cached balance based on owner type ───────────────────────────────
async function getCachedBalance(
  _ownerId: Types.ObjectId,
  ownerType: LedgerOwnerType,
  ledgerAccountId: Types.ObjectId
): Promise<{ balance: number; ownerPublicId: string; sourceDoc: any | null }> {
  if (ownerType === LedgerOwnerType.WALLET || ownerType === LedgerOwnerType.SYSTEM || ownerType === LedgerOwnerType.USER) {
    // SYSTEM and USER owner types resolve to a wallet
    const wallet = await Wallet.findOne({ ledgerAccountId }).lean();
    if (!wallet) return { balance: 0, ownerPublicId: "UNKNOWN", sourceDoc: null };
    return {
      balance: wallet.availableBalance,
      ownerPublicId: wallet.userPublicId,
      sourceDoc: wallet,
    };
  }

  if (ownerType === LedgerOwnerType.VAULT) {
    const vault = await vaultModel.findOne({ ledgerAccountId }).lean();
    if (!vault) return { balance: 0, ownerPublicId: "UNKNOWN", sourceDoc: null };
    return {
      balance: vault.currentBalanceMinor ?? 0,
      ownerPublicId: vault.userPublicId,
      sourceDoc: vault,
    };
  }

  return { balance: 0, ownerPublicId: "UNKNOWN", sourceDoc: null };
}

// ─── Reconcile a single ledger account ───────────────────────────────────
export async function reconcileLedgerAccount(
  ledgerAccount: any,
  context: IRequestContext,
  options: { freezeOnDrift: boolean }
): Promise<IDriftRecord> {
  const ledgerAccountId = ledgerAccount._id;

  // ─── Virtual accounts have no cached balance — always in sync ──────────
  const VIRTUAL_LEDGER_TYPES = [LedgerAccountType.EXTERNAL_FUNDING];
  if (VIRTUAL_LEDGER_TYPES.includes(ledgerAccount.type)) {
    const trueBalance = await computeTrueBalance(ledgerAccountId);
    return {
      ledgerAccountId,
      ledgerAccountPublicId: ledgerAccount.ledgerAccountId,
      ownerId: ledgerAccount.ownerId,
      ownerType: ledgerAccount.ownerType,
      ownerPublicId: "VIRTUAL",
      currency: ledgerAccount.currency,
      cachedBalance: trueBalance,    // virtual accounts: cached = true by definition
      trueBalance,
      drift: 0,
      severity: DriftSeverity.IN_SYNC,
      action: DriftAction.NONE,
      detectedAt: new Date(),
      notes: "VIRTUAL_ACCOUNT_NOT_RECONCILED",
    };
  }

  // 1. Get true balance from entries
  const trueBalance = await computeTrueBalance(ledgerAccountId);

  // 2. Get cached balance from owner doc
  const { balance: cachedBalance, ownerPublicId, sourceDoc } = await getCachedBalance(
    ledgerAccount.ownerId,
    ledgerAccount.ownerType,
    ledgerAccountId
  );

  // 3. Classify drift
  const { drift, severity } = classifyDrift(cachedBalance, trueBalance);
  const action = decideAction(severity, ledgerAccount.ownerType);

  // 4. Build drift record (always — even for IN_SYNC, we record the check)
  const driftRecord: IDriftRecord = {
    ledgerAccountId,
    ledgerAccountPublicId: ledgerAccount.ledgerAccountId,
    ownerId: ledgerAccount.ownerId,
    ownerType: ledgerAccount.ownerType,
    ownerPublicId,
    currency: ledgerAccount.currency,
    cachedBalance,
    trueBalance,
    drift,
    severity,
    action,
    detectedAt: new Date(),
  };

  // 5. If in sync, we're done
  if (severity === DriftSeverity.IN_SYNC) return driftRecord;

  // 6. Drift detected — log loudly
  logger.error("⚠️ Ledger drift detected", {
    ledgerAccountId: ledgerAccount.ledgerAccountId,
    ownerType: ledgerAccount.ownerType,
    ownerPublicId,
    cachedBalance,
    trueBalance,
    drift,
    severity,
    action,
  });

  // 7. Take action based on severity
  if (action === DriftAction.ALERT_AND_FREEZE && options.freezeOnDrift && sourceDoc) {
    if (ledgerAccount.ownerType === LedgerOwnerType.WALLET || ledgerAccount.ownerType === LedgerOwnerType.USER) {
      // Freeze wallet only if not already frozen      
      if (sourceDoc.status !== WalletStatus.FROZEN && sourceDoc.status !== WalletStatus.RECONCILING) {
        await Wallet.updateOne(
          { _id: sourceDoc._id },
          {
            $set: {
              status: WalletStatus.RECONCILING,
              freezeReason: FreezeReason.SUSPICIOUS,
              freezeUntil: null,
            },
            $push: {
              freezeHistory: {
                frozenAt: new Date(),
                freezeReason: `RECONCILIATION_DRIFT_DETECTED: drift=${drift}, severity=${severity}`,
                frozenBy: null,  // system-initiated
              }
            }
          }
        );
        logger.warn("🔒 Wallet frozen due to overstatement drift", {
          walletId: sourceDoc.walletId,
          ownerPublicId,
          drift,
        });

        driftRecord.notes = "WALLET_AUTO_FROZEN";
      } else {
        driftRecord.notes = "ALREADY_FROZEN";
      }
    }
  }

  // 8. Emit drift event for admin alerting
  await emitOutboxEvent({
    topic: "reconciliation.events",
    eventId: generateEventId(),
    eventType: AuditAction.RECONCILIATION_DRIFT_DETECTED,
    action: AuditAction.RECONCILIATION_DRIFT_DETECTED,
    status: AuditStatus.PENDING,
    payload: {
      ledgerAccountPublicId: ledgerAccount.ledgerAccountId,
      ownerType: ledgerAccount.ownerType,
      ownerPublicId,
      currency: ledgerAccount.currency,
      cachedBalance,
      trueBalance,
      drift,
      severity,
      action,
      autoFrozen: driftRecord.notes === "WALLET_AUTO_FROZEN",
    },
    aggregateType: "RECONCILIATION_DRIFT",
    aggregateId: ledgerAccount.ledgerAccountId,
    version: 1,
    context,
  });

  return driftRecord;
}

// ─── Helpers 
function classifyDrift(cached: number, trueBalance: number): {
  drift: number;
  severity: DriftSeverity;
} {
  const drift = cached - trueBalance;
  let severity: DriftSeverity;

  if (Math.abs(drift) <= DRIFT_THRESHOLD) {
    severity = DriftSeverity.IN_SYNC;
  } else if (drift > 0) {
    severity = DriftSeverity.OVERSTATED;  // cached > true → DANGEROUS
  } else {
    severity = DriftSeverity.UNDERSTATED; // cached < true → less risky
  }

  return { drift, severity };
}

function decideAction(severity: DriftSeverity, ownerType: LedgerOwnerType): DriftAction {
  if (severity === DriftSeverity.IN_SYNC) return DriftAction.NONE;

  // System accounts (treasury, revenue) — alert only, never freeze
  if (ownerType === LedgerOwnerType.SYSTEM) {
    return DriftAction.ALERT_ONLY;
  }

  // Vaults — alert only, don't freeze (no freeze concept on vault model)
  if (ownerType === LedgerOwnerType.VAULT) {
    return DriftAction.ALERT_ONLY;
  }

  // Wallets — overstated = dangerous, freeze it
  if (severity === DriftSeverity.OVERSTATED) {
    return DriftAction.ALERT_AND_FREEZE;
  }

  // Wallets understated — alert but don't freeze (user is locked out otherwise)
  return DriftAction.ALERT_ONLY;
}

// ─── Compute true balance from ledger entries ─────────────────────────────
async function computeTrueBalance(ledgerAccountId: Types.ObjectId): Promise<number> {
  const result = await LedgerEntry.aggregate([
    { $match: { ledgerAccountId } },
    {
      $group: {
        _id: null,
        totalCredits: {
          $sum: {
            $cond: [{ $eq: ["$type", LedgerEntryNature.CREDIT] }, "$amount", 0],
          },
        },
        totalDebits: {
          $sum: {
            $cond: [{ $eq: ["$type", LedgerEntryNature.DEBIT] }, "$amount", 0],
          },
        },
      },
    },
  ]);

  if (result.length === 0) return 0; // no entries, balance is 0
  const { totalCredits, totalDebits } = result[0];
  return totalCredits - totalDebits;
}