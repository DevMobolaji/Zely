// src/modules/reconciliation/reconciliation.service.ts
import mongoose, { Types } from "mongoose";
import { LedgerAccount, LedgerOwnerType, LedgerAccountType } from "@/modules/ledger/ledger.account.model"
import { LedgerEntry, LedgerEntryNature } from "@/modules/ledger/ledger.entry.model"
import { Wallet, WalletStatus, FreezeReason } from "../wallet/wallet.model";
import vaultModel from "../vault/vault.model";
import {
  ReconciliationReport,
  ReconciliationStatus,
  DriftSeverity,
  DriftAction,
  IDriftRecord,
} from "./reconciliation.model";
import { logger } from "@/shared/utils/logger";
import { emitOutboxEvent } from "@/infrastructure/helpers/emit.audit.helper";
import { AuditAction, AuditStatus } from "../audit/audit.interface";
import { generateEventId } from "@/shared/utils/id.generator";
import { IRequestContext } from "@/config/interfaces/request.interface";

const DRIFT_THRESHOLD = 0;
const BATCH_SIZE = 100;

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

// ─── Get cached balance based on owner type ───────────────────────────────
async function getCachedBalance(
  ownerId: Types.ObjectId,
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
async function reconcileLedgerAccount(
  ledgerAccount: any,
  context: IRequestContext,
  options: { freezeOnDrift: boolean }
): Promise<IDriftRecord> {
  const ledgerAccountId = ledgerAccount._id;

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
      if (sourceDoc.status !== WalletStatus.FROZEN) {
        await Wallet.updateOne(
          { _id: sourceDoc._id },
          {
            $set: {
              status: WalletStatus.RECONCILING,
              freezeReason: FreezeReason.SUSPICIOUS,
              freezeUntil: null, // indefinite until admin investigates
            },
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


class ReconciliationService {
  public async reconcileSingleAccount(
    ledgerAccountId: string,
    context: IRequestContext,
    options: { freezeOnDrift?: boolean; triggeredByUserId?: string } = {}
  ) {
    const ledgerAccount = await LedgerAccount.findById(ledgerAccountId).lean();
    if (!ledgerAccount) throw new Error("LEDGER_ACCOUNT_NOT_FOUND");

    const report = await ReconciliationReport.create({
      status: ReconciliationStatus.RUNNING,
      startedAt: new Date(),
      accountsChecked: 0,
      driftsFound: 0,
      drifts: [],
      triggeredBy: "MANUAL",
      triggeredByUserId: options.triggeredByUserId
        ? mongoose.Types.ObjectId.createFromHexString(options.triggeredByUserId) as any
        : undefined,
    });

    try {
      const driftRecord = await reconcileLedgerAccount(ledgerAccount, context, {
        freezeOnDrift: options.freezeOnDrift ?? true,
      });

      const driftsFound = driftRecord.severity !== DriftSeverity.IN_SYNC ? 1 : 0;
      const finishedAt = new Date();

      report.status = ReconciliationStatus.COMPLETED;
      report.finishedAt = finishedAt;
      report.durationMs = finishedAt.getTime() - report.startedAt.getTime();
      report.accountsChecked = 1;
      report.driftsFound = driftsFound;
      report.drifts = [driftRecord];
      await report.save();

      return report.toJSON();
    } catch (err: any) {
      report.status = ReconciliationStatus.FAILED;
      report.finishedAt = new Date();
      report.errorMessage = err.message;
      await report.save();
      throw err;
    }
  }

  // ─── Public API: reconcile every active ledger account ───────────────
  public async reconcileAllAccounts(
    context: IRequestContext,
    options: { freezeOnDrift?: boolean; triggeredBy?: "SCHEDULED" | "MANUAL" } = {}
  ) {
    const triggeredBy = options.triggeredBy ?? "SCHEDULED";

    const report = await ReconciliationReport.create({
      status: ReconciliationStatus.RUNNING,
      startedAt: new Date(),
      accountsChecked: 0,
      driftsFound: 0,
      drifts: [],
      triggeredBy,
    });

    logger.info("🔍 Reconciliation run started", { runId: report.runId, triggeredBy });

    try {
      const totalAccounts = await LedgerAccount.countDocuments({});
      let accountsChecked = 0;
      let driftsFound = 0;
      const drifts: IDriftRecord[] = [];

      // Stream-process in batches to avoid loading everything in memory
      const cursor = LedgerAccount.find({}).lean().cursor();

      let batch: any[] = [];

      for await (const account of cursor) {
        batch.push(account);

        if (batch.length >= BATCH_SIZE) {
          const batchDrifts = await Promise.all(
            batch.map((acc) =>
              reconcileLedgerAccount(acc, context, {
                freezeOnDrift: options.freezeOnDrift ?? true,
              })
            )
          );

          for (const d of batchDrifts) {
            accountsChecked++;
            if (d.severity !== DriftSeverity.IN_SYNC) {
              driftsFound++;
              drifts.push(d); // only persist actual drifts (not in-sync records, to keep report small)
            }
          }

          batch = [];
        }
      }

      // Process remaining items in the last partial batch
      if (batch.length > 0) {
        const batchDrifts = await Promise.all(
          batch.map((acc) =>
            reconcileLedgerAccount(acc, context, {
              freezeOnDrift: options.freezeOnDrift ?? true,
            })
          )
        );

        for (const d of batchDrifts) {
          accountsChecked++;
          if (d.severity !== DriftSeverity.IN_SYNC) {
            driftsFound++;
            drifts.push(d);
          }
        }
      }

      const finishedAt = new Date();
      report.status = ReconciliationStatus.COMPLETED;
      report.finishedAt = finishedAt;
      report.durationMs = finishedAt.getTime() - report.startedAt.getTime();
      report.accountsChecked = accountsChecked;
      report.driftsFound = driftsFound;
      report.drifts = drifts;
      await report.save();

      logger.info("✅ Reconciliation run completed", {
        runId: report.runId,
        accountsChecked,
        driftsFound,
        durationMs: report.durationMs,
      });

      // Emit summary event for admin dashboard
      await emitOutboxEvent({
        topic: "reconciliation.events",
        eventId: generateEventId(),
        eventType: AuditAction.RECONCILIATION_RUN_COMPLETED,
        action: AuditAction.RECONCILIATION_RUN_COMPLETED,
        status: AuditStatus.PENDING,
        payload: {
          runId: report.runId,
          accountsChecked,
          driftsFound,
          durationMs: report.durationMs,
          triggeredBy,
        },
        aggregateType: "RECONCILIATION_RUN",
        aggregateId: report.runId,
        version: 1,
        context,
      });

      return report.toJSON();
    } catch (err: any) {
      report.status = ReconciliationStatus.FAILED;
      report.finishedAt = new Date();
      report.errorMessage = err.message;
      await report.save();

      logger.error("❌ Reconciliation run failed", {
        runId: report.runId,
        error: err.message,
      });

      throw err;
    }
  }

  // ─── Public API: list past reports (admin dashboard) ─────────────────
  public async getReports(filters: {
    status?: ReconciliationStatus;
    triggeredBy?: "SCHEDULED" | "MANUAL";
    onlyWithDrifts?: boolean;
    limit?: number;
    skip?: number;
  } = {}) {
    const query: any = {};
    if (filters.status) query.status = filters.status;
    if (filters.triggeredBy) query.triggeredBy = filters.triggeredBy;
    if (filters.onlyWithDrifts) query.driftsFound = { $gt: 0 };

    return ReconciliationReport.find(query)
      .sort({ createdAt: -1 })
      .limit(filters.limit ?? 50)
      .skip(filters.skip ?? 0)
      .lean();
  }

  // ─── Public API: get one report by runId ─────────────────────────────
  public async getReportById(runId: string) {
    const report = await ReconciliationReport.findOne({ runId }).lean();
    if (!report) throw new Error("REPORT_NOT_FOUND");
    return report;
  }
}

export default ReconciliationService;