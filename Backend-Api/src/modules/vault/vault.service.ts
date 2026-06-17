import { IRequestContext } from "@/config/interfaces/request.interface";
import { emitOutboxEvent } from "@/infrastructure/helpers/emit.audit.helper";
import {
  extEnsureIdempotence,
  markCompleted,
} from "@/modules/helpers/ext.idempotence";
import {
  findVault,
  lockVaultToPreventConcurrency,
  mainWallet,
} from "@/modules/helpers/resolvers";
import {
  vaultCloseRequest,
  vaultWithrawalRequest,
} from "@/modules/transfer/transfer.interface";
import BadRequestError from "@/shared/errors/badRequest";
import { NotFoundError } from "@/shared/errors/notFoundError";
import { generateEventId, generateVaultId } from "@/shared/utils/id.generator";
import mongoose, { Types } from "mongoose";
import { AuditAction, AuditStatus } from "../audit/audit.interface";
import User from "../auth/authmodel";
import {
  LedgerAccount,
  LedgerAccountType,
  LedgerOwnerType,
} from "../ledger/ledger.account.model";
import TransactionBuilder from "../ledger/ledger.transaction.builder";
import { Wallet } from "../wallet/wallet.model";
import vaultModel from "./vault.model";

const DEFAULT_PENALTY_BASIS_POINTS = {
  FLEXIBLE: 0,
  LOCKED: 500, // 5%
  TARGET: 300, // 3%
};

class VaultService {
  // ─── Create vault ──────────────────────────────────────────────────────────
  public async createVault(params: {
    userId: string;
    title: string;
    vaultType: "FLEXIBLE" | "LOCKED" | "TARGET";
    targetAmountMinor?: number;
    lockedUntil?: Date;
    context: IRequestContext;
  }) {
    const {
      userId,
      title,
      vaultType,
      targetAmountMinor,
      lockedUntil,
      context,
    } = params;

    const vaultId = generateVaultId();
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const user = await User.findOne({ userId }).session(session);
      if (!user) throw new NotFoundError("User not found");

      // Check duplicate title
      const existing = await vaultModel
        .findOne({
          userId: user._id,
          title,
          status: "ACTIVE",
        })
        .session(session);

      if (existing) {
        throw new BadRequestError(
          "Active vault with this title already exists",
        );
      }

      // Resolve penalty rate
      const resolvedPenalty = DEFAULT_PENALTY_BASIS_POINTS[vaultType];

      // Build lock config based on type
      let lockConfig: any = { state: "UNLOCKED" };

      if (vaultType === "LOCKED" && lockedUntil) {
        lockConfig = {
          state: "LOCKED",
          lockedAt: new Date(),
          lockedUntil,
          penaltyBasisPoints: resolvedPenalty,
        };
      }

      if (vaultType === "TARGET") {
        lockConfig = {
          state: "LOCKED",
          lockedAt: new Date(),
          penaltyBasisPoints: resolvedPenalty,
        };
      }

      // Create ledger account for this vault
      const ledger = new LedgerAccount({
        ownerPublicId: vaultId,
        ownerId: new Types.ObjectId(),
        ownerType: LedgerOwnerType.VAULT,
        userPublicId: user.userId,
        userId: user._id,
        type: LedgerAccountType.VAULT,
        currency: "NGN",
      });

      await ledger.save({ session });

      // Create vault
      const vault = new vaultModel({
        userId: user._id,
        userPublicId: user.userId,
        vaultId,
        title,
        vaultType,
        currency: "NGN",
        targetAmountMinor: targetAmountMinor ?? 0,
        lockedUntil: vaultType === "LOCKED" ? lockedUntil : undefined,
        currentBalanceMinor: 0,
        lock: lockConfig,
        status: "ACTIVE",
        ledgerAccountId: ledger._id,
      });

      await vault.save({ session });

      await emitOutboxEvent(
        {
          topic: "vault.events",
          eventId: generateEventId(),
          eventType: AuditAction.VAULT_CREATED,
          action: AuditAction.VAULT_CREATED,
          status: AuditStatus.PENDING,
          payload: {
            vaultId: vault.vaultId,
            userId: user.userId,
            title: vault.title,
            vaultType,
            targetAmountMinor,
            ...(vaultType === "LOCKED" && lockedUntil ? { lockedUntil } : {}),
          },
          aggregateType: "VAULT",
          aggregateId: vault.vaultId,
          version: 1,
          context,
        },
        { session },
      );

      await session.commitTransaction();

      return vault;
    } catch (err) {
      if (session.inTransaction()) await session.abortTransaction();
      throw err;
    } finally {
      session.endSession();
    }
  }

  public async withdrawFromVault(
    dto: vaultWithrawalRequest,
    context: IRequestContext,
  ) {
    const { userId, vaultId, amount, idempotencyKey, currency } = dto;

    // Idempotency check
    const { alreadyCompleted, response } =
      await extEnsureIdempotence(idempotencyKey);
    if (alreadyCompleted) return response;

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // ─── Load user ───────────────────────────────────────────────────────
      const user = await User.findOne({ userId }).session(session);
      if (!user) throw new NotFoundError("User not found");

      // ─── Load vault ─────────────────────────────────────────────────────
      const vault = await findVault(vaultId, userId, currency, session);

      if (vault.status === "CANCELLED") {
        throw new BadRequestError("Cannot withdraw from a cancelled vault");
      }

      if (vault.currentBalanceMinor < amount) {
        throw new BadRequestError("Insufficient vault balance");
      }

      // ─── Lock vault for concurrency ───────────────────────────────────────
      const vaultLocked = await lockVaultToPreventConcurrency(
        vault._id,
        session,
      );
      if (!vaultLocked) throw new BadRequestError("Vault is busy, try again");

      // ─── Load user main wallet ────────────────────────────────────────────
      const mainWlt = await mainWallet(
        user.userId,
        vault.currency,
        LedgerAccountType.MAIN_CHECKINGS,
        session,
      );

      if (!mainWlt) throw new NotFoundError("Main wallet not found");

      // ─── Load ledger accounts ─────────────────────────────────────────────
      const vaultLedger = await LedgerAccount.findById(
        vault.ledgerAccountId,
      ).session(session);
      if (!vaultLedger) throw new NotFoundError("Vault ledger not found");

      const mainLedger = await LedgerAccount.findById(
        mainWlt.ledgerAccountId,
      ).session(session);
      if (!mainLedger) throw new NotFoundError("Main wallet ledger not found");

      // ─── Calculate penalty ────────────────────────────────────────────────
      const penaltyInfo = this.calculatePenalty(vault, amount);
      const userReceives = amount - penaltyInfo.penaltyAmount;
      const treasuryReceives = penaltyInfo.penaltyAmount;

      const transactionRef = `VAULT_WITHDRAW_${vaultId}_${generateEventId()}`;

      const builder = new TransactionBuilder("VAULT_WITHDRAWAL");

      // Always debit vault
      builder.addDebit({
        transactionRef,
        ledgerAccountId: vaultLedger._id,
        amount,
        currency: vault.currency,
        referenceId: vaultId,
        referenceType: "VAULT_WITHDRAWAL",
        nature: "DEBIT",
      });

      if (treasuryReceives > 0) {
        // ─── With penalty — three legs ──────────────────────────────────────
        const treasuryWallet = await Wallet.findOne({
          type: LedgerAccountType.SYSTEM_TREASURY,
          currency: vault.currency,
        }).session(session);

        if (!treasuryWallet)
          throw new NotFoundError("Treasury wallet not found");

        const treasuryLedger = await LedgerAccount.findById(
          treasuryWallet.ledgerAccountId,
        ).session(session);

        if (!treasuryLedger)
          throw new NotFoundError("Treasury ledger not found");

        // Credit user
        builder.addCredit({
          transactionRef,
          ledgerAccountId: mainLedger._id,
          amount: userReceives,
          currency: vault.currency,
          referenceId: vaultId,
          referenceType: "VAULT_WITHDRAWAL",
          nature: "CREDIT",
        });

        // Credit treasury (penalty)
        builder.addCredit({
          transactionRef,
          ledgerAccountId: treasuryLedger._id,
          amount: treasuryReceives,
          currency: vault.currency,
          referenceId: vaultId,
          referenceType: "VAULT_PENALTY",
          nature: "CREDIT",
        });

        await builder.commit(session);

        // Update treasury wallet balance
        await Wallet.findOneAndUpdate(
          { _id: treasuryWallet._id },
          { $inc: { availableBalance: treasuryReceives } },
          { session },
        );
      } else {
        // ─── No penalty — two legs ──────────────────────────────────────────
        builder.addCredit({
          transactionRef,
          ledgerAccountId: mainLedger._id,
          amount: userReceives,
          currency: vault.currency,
          referenceId: vaultId,
          referenceType: "VAULT_WITHDRAWAL",
          nature: "CREDIT",
        });

        await builder.commit(session);
      }

      // ─── Update wallet balance ────────────────────────────────────────────
      await Wallet.findOneAndUpdate(
        { _id: mainWlt._id },
        { $inc: { availableBalance: userReceives, version: 1 } },
        { session },
      );

      // ─── Update vault balance ─────────────────────────────────────────────
      await vaultModel.updateOne(
        { _id: vault._id },
        { $inc: { currentBalanceMinor: -amount } },
        { session },
      );

      // ─── Emit outbox event ────────────────────────────────────────────────
      await emitOutboxEvent(
        {
          topic: "vault.events",
          eventId: generateEventId(),
          eventType: AuditAction.VAULT_WITHDRAWAL,
          action: AuditAction.VAULT_WITHDRAWAL,
          status: AuditStatus.PENDING,
          payload: {
            vaultId,
            userId: user.userId,
            amount,
            userReceives,
            penaltyAmount: treasuryReceives,
            penaltyApplied: penaltyInfo.penaltyApplied,
            penaltyReason: penaltyInfo.reason,
            newBalance: vault.currentBalanceMinor - amount,
            currency: vault.currency,
            type: vault.vaultType,
          },
          aggregateType: "VAULT",
          aggregateId: vaultId,
          version: 1,
          context,
        },
        { session },
      );

      await session.commitTransaction();

      // 6. Mark idempotency completed — AFTER commit
      await markCompleted(dto.idempotencyKey, transactionRef, {
        transactionId: transactionRef,
        vaultId: dto.vaultId,
        amountWithdrawn: amount,
        amountReceived: userReceives,
        penaltyApplied: penaltyInfo.penaltyApplied,
      });

      return {
        vaultId,
        amountWithdrawn: amount,
        penaltyApplied: penaltyInfo.penaltyApplied,
        penaltyAmount: treasuryReceives,
        penaltyReason: penaltyInfo.reason,
        amountReceived: userReceives,
        newVaultBalance: vault.currentBalanceMinor - amount,
      };
    } catch (err) {
      if (session.inTransaction()) await session.abortTransaction();
      throw err;
    } finally {
      session.endSession();
    }
  }

  // // ─── Penalty calculator

  private calculatePenalty(
    vault: any,
    amount: number,
  ): {
    penaltyApplied: boolean;
    penaltyAmount: number;
    reason: string;
  } {
    const now = new Date();

    // FLEXIBLE — never any penalty
    if (vault.vaultType === "FLEXIBLE") {
      return {
        penaltyApplied: false,
        penaltyAmount: 0,
        reason: "FLEXIBLE_VAULT",
      };
    }

    // LOCKED — check maturity date
    if (vault.vaultType === "LOCKED") {
      const matured = vault.lock?.lockedUntil && vault.lock.lockedUntil <= now;

      if (matured || vault.lock?.state === "MATURED") {
        return {
          penaltyApplied: false,
          penaltyAmount: 0,
          reason: "VAULT_MATURED",
        };
      }

      const basisPoints =
        vault.lock?.penaltyBasisPoints ?? DEFAULT_PENALTY_BASIS_POINTS.LOCKED;
      const penaltyAmount = Math.floor((amount * basisPoints) / 10000);

      return {
        penaltyApplied: true,
        penaltyAmount,
        reason: "EARLY_WITHDRAWAL_BEFORE_MATURITY",
      };
    }

    // TARGET — check if target reached
    if (vault.vaultType === "TARGET") {
      const targetReached =
        vault.lock?.state === "MATURED" ||
        vault.status === "COMPLETED" ||
        (vault.targetAmountMinor > 0 &&
          vault.currentBalanceMinor >= vault.targetAmountMinor);

      if (targetReached) {
        return {
          penaltyApplied: false,
          penaltyAmount: 0,
          reason: "TARGET_REACHED",
        };
      }

      const basisPoints =
        vault.lock?.penaltyBasisPoints ?? DEFAULT_PENALTY_BASIS_POINTS.TARGET;
      const penaltyAmount = Math.floor((amount * basisPoints) / 10000);

      return {
        penaltyApplied: true,
        penaltyAmount,
        reason: "EARLY_WITHDRAWAL_BEFORE_TARGET",
      };
    }

    return { penaltyApplied: false, penaltyAmount: 0, reason: "UNKNOWN" };
  }

  // // ─── Get vault ─────────────────────────────────────────────────────────────
  public async getVault(userId: string, vaultId: string) {
    const user = await User.findOne({ userId });
    if (!user) throw new NotFoundError("User not found");

    const vault = await vaultModel
      .findOne({
        vaultId,
        userId: user._id,
      })
      .lean();

    if (!vault) throw new NotFoundError("Vault not found");

    return vault;
  }

  // // ─── List user vaults ──────────────────────────────────────────────────────
  public async getUserVaults(userId: string) {
    const user = await User.findOne({ userId });
    if (!user) throw new NotFoundError("User not found");

    return vaultModel.find({ userId: user._id }).sort({ createdAt: -1 }).lean();
  }

  // // ─── Close vault ───────────────────────────────────────────────────────────
  public async closeVault(params: {
    userId: string;
    vaultId: string;
    idempotencyKey: string;
    context: IRequestContext;
  }) {
    const { userId, vaultId, context, idempotencyKey } = params;

    // Withdraw everything (penalty applies if locked)
    const vault = await vaultModel.findOne({ vaultId });
    if (!vault) throw new NotFoundError("Vault not found");

    const dto: vaultCloseRequest = {
      userId,
      vaultId,
      amount: vault.currentBalanceMinor,
      currency: vault.currency,
      idempotencyKey: idempotencyKey,
    };

    let withdrawalResult = null;

    if (vault.currentBalanceMinor > 0) {
      withdrawalResult = await this.withdrawFromVault(dto, context);
    }

    await vaultModel.updateOne({ vaultId }, { $set: { status: "CANCELLED" } });

    await emitOutboxEvent({
      topic: "vault.events",
      eventId: generateEventId(),
      eventType: AuditAction.VAULT_CLOSED,
      action: AuditAction.VAULT_CLOSED,
      status: AuditStatus.PENDING,
      payload: {
        vaultId,
        userId,
        title: vault.title,
        vaultType: vault.vaultType,
        finalBalanceWithdrawn: vault.currentBalanceMinor,
        penaltyApplied: withdrawalResult?.penaltyApplied ?? false,
        penaltyAmount: withdrawalResult?.penaltyAmount ?? 0,
        closedAt: new Date(),
      },
      aggregateType: "VAULT",
      aggregateId: vaultId,
      version: 1,
      context,
    });

    return { vaultId, closed: true };
  }

  public async getWithdrawalPreview(
    userId: string,
    vaultId: string,
    amount: number,
  ) {
    const user = await User.findOne({ userId }).lean();

    if (!user) throw new NotFoundError("User not found");

    const vault = await vaultModel
      .findOne({
        vaultId,
        userId: user._id,
      })
      .lean();

    if (!vault) throw new NotFoundError("Vault not found");

    const penaltyInfo = this.calculatePenalty(vault, amount);

    return {
      amount,
      penalty: penaltyInfo.penaltyAmount,
      penaltyApplied: penaltyInfo.penaltyApplied,
      penaltyReason: penaltyInfo.reason,
      penaltyRate: vault.lock?.penaltyBasisPoints
        ? `${vault.lock.penaltyBasisPoints / 100}%`
        : "0%",
      netAmount: amount - penaltyInfo.penaltyAmount,
      vaultId,
    };
  }
}

export default new VaultService();
