// src/modules/reconciliation/reconciliation.service.ts
import mongoose, { Types } from "mongoose";
import { LedgerAccount } from "@/modules/ledger/ledger.account.model"
import {
  ReconciliationReport,
  ReconciliationStatus,
  DriftSeverity,
  IDriftRecord,
} from "./reconciliation.model";
import { logger } from "@/shared/utils/logger";
import { emitOutboxEvent } from "@/infrastructure/helpers/emit.audit.helper";
import { AuditAction, AuditStatus } from "../audit/audit.interface";
import { generateEventId } from "@/shared/utils/id.generator";
import { IRequestContext } from "@/config/interfaces/request.interface";
import { reconcileLedgerAccount } from "./reconciliation.helper";

const BATCH_SIZE = 100;


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
    options: { freezeOnDrift?: boolean; triggeredBy?: "SCHEDULED" | "MANUAL", triggeredByUserId?: string } = {}
  ) {
    const triggeredBy = options.triggeredBy ?? "SCHEDULED";


    const report = await ReconciliationReport.create({
      status: ReconciliationStatus.RUNNING,
      startedAt: new Date(),
      accountsChecked: 0,
      driftsFound: 0,
      drifts: [],
      triggeredBy,
      triggeredByUserId: options.triggeredByUserId
        ? mongoose.Types.ObjectId.createFromHexString(options.triggeredByUserId) as any
        : undefined,
    });

    logger.info("🔍 Reconciliation run started", { runId: report.runId, triggeredBy });

    try {
      //const totalAccounts = await LedgerAccount.countDocuments({});
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