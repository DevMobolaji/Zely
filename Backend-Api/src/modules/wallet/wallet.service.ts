// src/modules/wallet/admin/wallet.admin.service.ts
import mongoose, { Types } from "mongoose";
import { Wallet, WalletStatus } from "./wallet.model";
import BadRequestError from "@/shared/errors/badRequest";
import { NotFoundError } from "@/shared/errors/notFoundError";
import { IRequestContext } from "@/config/interfaces/request.interface";
import { emitOutboxEvent } from "@/infrastructure/helpers/emit.audit.helper";
import { AuditAction, AuditStatus } from "@/modules/audit/audit.interface";
import { generateEventId } from "@/shared/utils/id.generator";
import { logger } from "@/shared/utils/logger";
import ReconciliationService from "@/modules/reconciliation/reconciliation.service";
import { DriftSeverity } from "@/modules/reconciliation/reconciliation.model";

interface UnfreezeWalletParams {
  walletId: string;
  reason: string;
  adminUserId: string;
  verifyReconciliation: boolean;
  context: IRequestContext;
}

class WalletAdminService {
  private reconciliationService = new ReconciliationService();


  public async unfreezeWallet(params: UnfreezeWalletParams) {
    const { walletId, reason, adminUserId, verifyReconciliation, context } = params;

    // ─── 1. Validation ────────────────────────────────────────────────────
    if (!reason || reason.trim().length < 10) {
      throw new BadRequestError("UNFREEZE_REASON_REQUIRED_MIN_10_CHARS");
    }

    const wallet = await Wallet.findOne({ walletId });
    if (!wallet) throw new NotFoundError("WALLET_NOT_FOUND");

    const FROZEN_STATUSES = [WalletStatus.FROZEN, WalletStatus.RECONCILING];
    if (!FROZEN_STATUSES.includes(wallet.status as WalletStatus)) {
      throw new BadRequestError(`WALLET_NOT_FROZEN_CURRENT_STATUS_${wallet.status}`);
    }

    if (wallet.status === WalletStatus.CLOSED) {
      throw new BadRequestError("CANNOT_UNFREEZE_CLOSED_WALLET");
    }

    // ─── 2. Verify reconciliation if requested ────────────────────────────
    if (verifyReconciliation) {
      logger.info("Running pre-unfreeze reconciliation check", { walletId });

      const verificationReport = await this.reconciliationService.reconcileSingleAccount(
        wallet.ledgerAccountId.toString(),
        context,
        {
          freezeOnDrift: false,  // critical — don't re-freeze during verification
          triggeredByUserId: adminUserId,
        }
      );

      const verificationDrift = verificationReport.drifts[0];
      if (verificationDrift && verificationDrift.severity !== DriftSeverity.IN_SYNC) {
        throw new BadRequestError(
          `CANNOT_UNFREEZE_DRIFT_STILL_EXISTS: drift=${verificationDrift.drift}, ` +
          `severity=${verificationDrift.severity}. Resolve underlying issue before unfreezing.`
        );
      }

      logger.info("✅ Pre-unfreeze reconciliation passed", { walletId });
    }

    // ─── 3. Execute unfreeze in transaction ───────────────────────────────
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const adminObjectId = mongoose.Types.ObjectId.createFromHexString(adminUserId);
      const now = new Date();

      // Find the most recent unresolved freeze entry to update with unfreeze details
      const lastFreezeIndex = wallet.freezeHistory.length - 1;
      const hasOpenFreezeEntry =
        lastFreezeIndex >= 0 &&
        !wallet.freezeHistory[lastFreezeIndex].unfrozenAt;

      const updateOps: any = {
        $set: {
          status: WalletStatus.ACTIVE,
          freezeReason: null,
          freezeUntil: null,
          unfrozenBy: adminObjectId,
          unfrozenAt: now,
          unfreezeReason: reason,
        },
      };

      // Update the latest open freeze entry to record the unfreeze details
      if (hasOpenFreezeEntry) {
        updateOps.$set[`freezeHistory.${lastFreezeIndex}.unfrozenAt`] = now;
        updateOps.$set[`freezeHistory.${lastFreezeIndex}.unfrozenBy`] = adminObjectId;
        updateOps.$set[`freezeHistory.${lastFreezeIndex}.unfreezeReason`] = reason;
      } else {
        // Edge case: wallet was frozen before history tracking existed
        // Push a synthetic history entry so the audit trail is complete
        updateOps.$push = {
          freezeHistory: {
            frozenAt: wallet.createdAt || now,
            freezeReason: wallet.freezeReason || "UNKNOWN_LEGACY_FREEZE",
            frozenBy: null,
            unfrozenAt: now,
            unfrozenBy: adminObjectId,
            unfreezeReason: reason,
          },
        };
      }

      const updated = await Wallet.findOneAndUpdate(
        { _id: wallet._id, version: wallet.version },
        updateOps,
        { session, new: true }
      );

      if (!updated) {
        throw new BadRequestError("WALLET_VERSION_CONFLICT_RETRY");
      }

      // ─── 4. Emit unfreeze event ─────────────────────────────────────────
      await emitOutboxEvent(
        {
          topic: "wallet.events",
          eventId: generateEventId(),
          eventType: AuditAction.WALLET_UNFROZEN,
          action: AuditAction.WALLET_UNFROZEN,
          status: AuditStatus.PENDING,
          payload: {
            walletId: updated.walletId,
            walletInternalId: updated._id.toString(),
            userPublicId: updated.userPublicId,
            previousStatus: wallet.status,
            currentStatus: updated.status,
            unfrozenBy: adminUserId,
            unfreezeReason: reason,
            verificationRan: verifyReconciliation,
          },
          aggregateType: "WALLET_UNFREEZE",
          aggregateId: updated.walletId,
          version: 1,
          context,
        },
        { session }
      );

      await session.commitTransaction();

      logger.info("✅ Wallet unfrozen", {
        walletId: updated.walletId,
        previousStatus: wallet.status,
        adminUserId,
      });

      return {
        walletId: updated.walletId,
        previousStatus: wallet.status,
        currentStatus: updated.status,
        unfrozenBy: adminUserId,
        unfrozenAt: now,
        unfreezeReason: reason,
        verificationRan: verifyReconciliation,
      };
    } catch (err: any) {
      if (session.inTransaction()) await session.abortTransaction();
      logger.error("❌ Wallet unfreeze failed", { walletId, error: err.message });
      throw err;
    } finally {
      session.endSession();
    }
  }
}

export default WalletAdminService;