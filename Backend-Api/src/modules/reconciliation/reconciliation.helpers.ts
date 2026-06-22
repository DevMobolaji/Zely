import { IRequestContext } from "@/config/interfaces/request.interface";
import { emitOutboxEvent } from "@/infrastructure/helpers/emit.audit.helper";
import { AuditAction, AuditStatus } from "@/modules/audit/audit.interface";
import {
  LedgerAccount,
  LedgerAccountType,
  LedgerOwnerType,
} from "@/modules/ledger/ledger.account.model";
import {
  LedgerEntry,
  LedgerEntryNature,
} from "@/modules/ledger/ledger.entry.model";
import { PaymentInitialization } from "@/modules/payments/payment.initialization.model";
import {
  PaymentDriftRecord,
  PaystackTransaction,
  PaystackTransactionResponse,
  SystemInvariantResult,
  WalletDrift,
} from "@/modules/reconciliation/interfaces";
import {
  DriftAction,
  DriftCategory,
  DriftSeverity,
  IDriftRecord,
  PaymentDriftCategory,
  ReconciliationReport,
  ReconciliationStatus,
} from "@/modules/reconciliation/reconciliation.model";
import vaultModel from "@/modules/vault/vault.model";
import {
  FreezeReason,
  Wallet,
  WalletStatus,
} from "@/modules/wallet/wallet.model";
import { generateEventId } from "@/shared/utils/id.generator";
import { logger } from "@/shared/utils/logger";
import { ClientSession } from "mongoose";
import { Types } from "mongoose";

const DRIFT_THRESHOLD = 0;

// Get cached balance /  user facing balance based on owner type
export async function getCachedBalance(
  _ownerId: Types.ObjectId,
  ownerType: LedgerOwnerType,
  ledgerAccountId: Types.ObjectId,
): Promise<{ balance: number; ownerPublicId: string; sourceDoc: any | null }> {
  if (
    ownerType === LedgerOwnerType.WALLET ||
    ownerType === LedgerOwnerType.SYSTEM ||
    ownerType === LedgerOwnerType.USER
  ) {
    // SYSTEM and USER owner types resolve to a wallet
    const wallet = await Wallet.findOne({ ledgerAccountId }).lean();
    if (!wallet)
      return { balance: 0, ownerPublicId: "UNKNOWN", sourceDoc: null };
    return {
      balance: wallet.availableBalance,
      ownerPublicId: wallet.userPublicId,
      sourceDoc: wallet,
    };
  }

  if (ownerType === LedgerOwnerType.VAULT) {
    let vault = await vaultModel.findOne({ ledgerAccountId }).lean();

    // Fallback — use ownerId (vault's _id stored on LedgerAccount)
    if (!vault) {
      vault = await vaultModel.findById(_ownerId).lean();
    }

    if (!vault) {
      return { balance: 0, ownerPublicId: "UNKNOWN", sourceDoc: null };
    }

    return {
      balance: vault.currentBalanceMinor ?? 0,
      ownerPublicId: vault.userPublicId,
      sourceDoc: vault,
    };
  }

  return { balance: 0, ownerPublicId: "UNKNOWN", sourceDoc: null };
}

export function classifyDrift(
  cached: number,
  trueBalance: number,
): {
  drift: number;
  severity: DriftSeverity;
} {
  const drift = cached - trueBalance;
  let severity: DriftSeverity;

  if (Math.abs(drift) <= DRIFT_THRESHOLD) {
    severity = DriftSeverity.IN_SYNC;
  } else if (drift > 0) {
    severity = DriftSeverity.OVERSTATED; // cached > true → DANGEROUS
  } else {
    severity = DriftSeverity.UNDERSTATED; // cached < true → less risky
  }

  return { drift, severity };
}

export function categorizeDrift(
  drift: number,
  severity: DriftSeverity,
): DriftCategory {
  if (severity === DriftSeverity.IN_SYNC) return DriftCategory.NORMAL;

  const absDrift = Math.abs(drift);

  // Rounding error — very small drift (1-2 kobo)
  if (absDrift <= 2) return DriftCategory.ROUNDING_ERROR;

  // Cached is higher than true balance
  // → wallet was credited but ledger entry is missing
  if (severity === DriftSeverity.OVERSTATED) {
    return DriftCategory.MISSING_DEBIT;
  }

  // Cached is lower than true balance
  // → ledger entry exists but wallet was never updated
  if (severity === DriftSeverity.UNDERSTATED) {
    return DriftCategory.MISSING_CREDIT;
  }

  return DriftCategory.NORMAL;
}

export function decideAction(
  severity: DriftSeverity,
  ownerType: LedgerOwnerType,
): DriftAction {
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

// ─── Compute true balance from ledger entries
export async function computeTrueBalance(
  ledgerAccountId: Types.ObjectId,
  session?: ClientSession,
): Promise<number> {
  const result = await LedgerEntry.aggregate([
    {
      $match: {
        ledgerAccountId,
      },
    },
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
  ]).session(session);

  if (result.length === 0) {
    return 0;
  }

  const { totalCredits, totalDebits } = result[0];

  return totalCredits - totalDebits;
}
//Reconcile ledger account
export async function reconcileLedgerAccount(
  ledgerAccount: any,
  context: IRequestContext,
  options: { freezeOnDrift: boolean },
): Promise<IDriftRecord> {
  const ledgerAccountId = ledgerAccount._id;

  const VIRTUAL_LEDGER_TYPES = [
    LedgerAccountType.EXTERNAL_FUNDING,
    LedgerAccountType.RECONCILIATION_ADJUSTMENTS,
  ];
  if (VIRTUAL_LEDGER_TYPES.includes(ledgerAccount.type)) {
    const trueBalance = await computeTrueBalance(ledgerAccountId);
    return {
      ledgerAccountId,
      ledgerAccountPublicId: ledgerAccount.ledgerAccountId,
      ownerId: ledgerAccount.ownerId,
      ownerType: ledgerAccount.ownerType,
      ownerPublicId: "VIRTUAL",
      currency: ledgerAccount.currency,
      cachedBalance: trueBalance,
      trueBalance,
      drift: 0,
      severity: DriftSeverity.IN_SYNC,
      action: DriftAction.NONE,
      detectedAt: new Date(),
      notes: "VIRTUAL_ACCOUNT_NOT_RECONCILED",
      category: DriftCategory.NORMAL,
    };
  }

  // 1. Get true balance from entries
  const trueBalance = await computeTrueBalance(ledgerAccountId);

  // 2. Get cached balance from owner doc
  const {
    balance: cachedBalance,
    ownerPublicId,
    sourceDoc,
  } = await getCachedBalance(
    ledgerAccount.ownerId,
    ledgerAccount.ownerType,
    ledgerAccountId,
  );

  // 3. Classify drift
  const { drift, severity } = classifyDrift(cachedBalance, trueBalance);
  const action = decideAction(severity, ledgerAccount.ownerType);
  const category = categorizeDrift(drift, severity);

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
    category,
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
  if (
    action === DriftAction.ALERT_AND_FREEZE &&
    options.freezeOnDrift &&
    sourceDoc
  ) {
    if (
      ledgerAccount.ownerType === LedgerOwnerType.WALLET ||
      ledgerAccount.ownerType === LedgerOwnerType.USER
    ) {
      // Freeze wallet only if not already frozen
      if (
        sourceDoc.status !== WalletStatus.FROZEN &&
        sourceDoc.status !== WalletStatus.RECONCILING
      ) {
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
                frozenBy: null, // system-initiated
              },
            },
          },
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

export async function checkSystemBalanceInvariant(): Promise<SystemInvariantResult> {
  const checkedAt = new Date();

  // 1. Stored balance per wallet, keyed by the wallet's ledgerAccountId
  const wallets = await Wallet.aggregate([
    {
      $project: {
        walletId: "$_id",
        ledgerAccountId: 1,
        storedBalance: {
          $add: [
            { $ifNull: ["$availableBalance", 0] },
            { $ifNull: ["$lockedBalance", 0] },
          ],
        },
      },
    },
  ]);

  // 2. Net credits/debits per LedgerAccount (this is the direct join key)
  const ledgerNetByAccount = await LedgerEntry.aggregate([
    {
      $group: {
        _id: "$ledgerAccountId",
        net: {
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
  ]);

  const ledgerNetMap = new Map(
    ledgerNetByAccount.map((row) => [String(row._id), row.net]),
  );

  // 3. Diff each wallet's stored balance vs its own ledger account's net
  const driftedWallets: WalletDrift[] = wallets
    .map((w) => {
      const walletId = String(w.walletId);
      const ledgerNet = ledgerNetMap.get(String(w.ledgerAccountId)) ?? 0;
      const drift = w.storedBalance - ledgerNet;
      return {
        walletId,
        storedBalance: w.storedBalance,
        ledgerNet,
        drift,
        isBalanced: Math.abs(drift) <= 0,
      };
    })
    .filter((w) => !w.isBalanced);

  const isBalanced = driftedWallets.length === 0;

  const totalWalletBalance = wallets.reduce((s, w) => s + w.storedBalance, 0);
  const totalLedgerNet = wallets.reduce(
    (s, w) => s + (ledgerNetMap.get(String(w.ledgerAccountId)) ?? 0),
    0,
  );
  const invariantDrift = totalWalletBalance - totalLedgerNet;

  const globalAgg = await LedgerEntry.aggregate([
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
  const totalLedgerCredits = globalAgg[0]?.totalCredits ?? 0;
  const totalLedgerDebits = globalAgg[0]?.totalDebits ?? 0;

  if (!isBalanced) {
    logger.error("🚨 CRITICAL — System balance invariant violated", {
      driftedWalletCount: driftedWallets.length,
      driftedWallets,
      totalWalletBalance,
      totalLedgerNet,
      invariantDrift,
      checkedAt,
    });
  } else {
    logger.info("✅ System balance invariant holds", {
      walletsChecked: wallets.length,
      totalWalletBalance,
      totalLedgerNet,
      checkedAt,
    });
  }

  return {
    totalWalletBalance,
    totalLedgerNet,
    totalLedgerCredits,
    totalLedgerDebits,
    invariantDrift,
    isBalanced,
    driftedWallets,
    checkedAt,
  };
}

//Reconcile paystack against our db
export async function reconcilePaystackSettlements(
  startDate: Date,
  endDate: Date,
  paystackSecretKey: string,
): Promise<{
  totalChecked: number;
  driftsFound: number;
  drifts: PaymentDriftRecord[];
}> {
  // 1. Fetch our payment records for the period
  const ourPayments = await PaymentInitialization.find({
    providerName: "PAYSTACK",
    createdAt: { $gte: startDate, $lte: endDate },
    status: { $in: ["SUCCESS", "FAILED"] },
  }).lean();

  // 2. Fetch Paystack transactions for the same period
  const { transactions, apiHealthy } = await fetchPaystackTransactions(
    startDate,
    endDate,
    paystackSecretKey,
  );

  const drifts: PaymentDriftRecord[] = [];

  // 3. Build lookup maps
  const ourPaymentMap = new Map(
    ourPayments.map((p) => [p.providerReference, p]),
  );
  const paystackMap = new Map<string, PaystackTransaction>(
    transactions.map((t) => [t.reference, t]),
  );
  // 4. Check every Paystack transaction against our records
  for (const [ref, paystackTxn] of paystackMap) {
    const ourRecord = ourPaymentMap.get(ref);

    const paystackAmountNaira = paystackTxn.amount / 100;

    if (!ourRecord) {
      // Paystack charged user but we have no record
      drifts.push({
        reference: ref,
        providerReference: ref,
        category: PaymentDriftCategory.MISSING_IN_OUR_SYSTEM,
        providerAmount: paystackAmountNaira,
        providerStatus: paystackTxn.status,
        detectedAt: new Date(),
        requiresManualReview: true,
      });
      continue;
    }

    // Amount mismatch
    if (ourRecord.amount !== paystackAmountNaira) {
      drifts.push({
        reference: ourRecord.reference,
        providerReference: ref,
        category: PaymentDriftCategory.AMOUNT_MISMATCH,
        ourAmount: ourRecord.amount,
        providerAmount: paystackAmountNaira,
        detectedAt: new Date(),
        requiresManualReview: true,
      });
      continue;
    }

    // Status mismatch — Paystack says success but we say failed
    const paystackSuccess = paystackTxn.status === "success";
    const ourSuccess = ourRecord.status === "SUCCESS";

    if (paystackSuccess !== ourSuccess) {
      drifts.push({
        reference: ourRecord.reference,
        providerReference: ref,
        category: PaymentDriftCategory.STATUS_MISMATCH,
        ourStatus: ourRecord.status,
        providerStatus: paystackTxn.status,
        detectedAt: new Date(),
        requiresManualReview: true,
      });
    }
  }

  // 5. Check our records against Paystack — find payments we have but Paystack doesn't
  for (const [ref, ourRecord] of ourPaymentMap) {
    if (ref && !paystackMap.has(ref)) {
      drifts.push({
        reference: ourRecord.reference,
        providerReference: ref ?? "UNKNOWN",
        category: PaymentDriftCategory.MISSING_IN_PAYSTACK,
        ourAmount: ourRecord.amount,
        ourStatus: ourRecord.status,
        detectedAt: new Date(),
        requiresManualReview: false, // Could be a test or abandoned payment
      });
    }
  }

  return {
    totalChecked: Math.max(ourPaymentMap.size, paystackMap.size),
    driftsFound: drifts.length,
    drifts,
  };
}

// ─── Fetch Paystack transactions for a date range
async function fetchPaystackTransactions(
  startDate: Date,
  endDate: Date,
  secretKey: string,
): Promise<{ transactions: PaystackTransaction[]; apiHealthy: boolean }> {
  let page = 1;
  const perPage = 100;

  while (true) {
    try {
      const response = await fetch(
        `https://api.paystack.co/transaction?` +
          new URLSearchParams({
            from: startDate.toISOString(),
            to: endDate.toISOString(),
            perPage: perPage.toString(),
            page: page.toString(),
            status: "success",
          }),
        {
          headers: {
            Authorization: `Bearer ${secretKey}`,
            "Content-Type": "application/json",
          },
        },
      );

      if (!response.ok) {
        logger.error("Paystack API returned error", {
          status: response.status,
        });
        return { transactions: [], apiHealthy: false };
      }
      const data = (await response.json()) as PaystackTransactionResponse;
      return { transactions: data.data ?? [], apiHealthy: true };
    } catch (err: any) {
      logger.error("Paystack API unreachable", { error: err.message });
      return { transactions: [], apiHealthy: false };
    }
  }
}

export async function escalateUnresolvedDrifts(context: IRequestContext) {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  // Find reports older than 7 days with unresolved drifts
  const staleReports = await ReconciliationReport.find({
    status: ReconciliationStatus.COMPLETED,
    driftsFound: { $gt: 0 },
    createdAt: { $lte: sevenDaysAgo },
    "drifts.resolvedAt": { $exists: false },
  }).lean();

  if (staleReports.length === 0) {
    logger.info("No unresolved drifts older than 7 days");
    return;
  }

  logger.warn("⚠️ Unresolved drifts older than 7 days detected", {
    reportCount: staleReports.length,
  });

  // Emit escalation alert for each stale report
  for (const report of staleReports) {
    const unresolvedDrifts = report.drifts.filter((d) => !d.resolvedAt);

    await emitOutboxEvent({
      topic: "reconciliation.events",
      eventId: generateEventId(),
      eventType: AuditAction.RECONCILIATION_DRIFT_DETECTED,
      action: AuditAction.RECONCILIATION_DRIFT_DETECTED,
      status: AuditStatus.PENDING,
      payload: {
        type: "DRIFT_ESCALATION",
        runId: report.runId,
        unresolvedCount: unresolvedDrifts.length,
        oldestDetectedAt: unresolvedDrifts[0]?.detectedAt,
        severity: "HIGH",
        message: `${unresolvedDrifts.length} drift(s) from run ${report.runId} unresolved for 7+ days`,
      },
      aggregateType: "RECONCILIATION_ESCALATION",
      aggregateId: report.runId,
      version: 1,
      context,
    });
  }
}
