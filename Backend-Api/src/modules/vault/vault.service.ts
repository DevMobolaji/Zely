import { IRequestContext } from "@/config/interfaces/request.interface";
import { emitOutboxEvent } from "@/infrastructure/helpers/emit.audit.helper";
import BadRequestError from "@/shared/errors/badRequest";
import { NotFoundError } from "@/shared/errors/notFoundError";
import { generateEventId, generateVaultId } from "@/shared/utils/id.generator";
import { logger } from "@/shared/utils/logger";
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
    penaltyBasisPoints?: number;
    context: IRequestContext;
  }) {
    const {
      userId,
      title,
      vaultType,
      targetAmountMinor,
      lockedUntil,
      penaltyBasisPoints,
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
      const resolvedPenalty =
        penaltyBasisPoints ?? DEFAULT_PENALTY_BASIS_POINTS[vaultType];

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
            lockedUntil,
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

  // ─── Deposit into vault ────────────────────────────────────────────────────
  // public async depositIntoVault(params: {
  //   userId: string;
  //   vaultId: string;
  //   amount: number;
  //   context: IRequestContext;
  // }) {
  //   const { userId, vaultId, amount, context } = params;

  //   if (!Number.isInteger(amount) || amount <= 0) {
  //     throw new BadRequestError("Amount must be a positive integer in kobo");
  //   }

  //   const session = await mongoose.startSession();
  //   session.startTransaction();

  //   try {
  //     const user = await User.findOne({ userId }).session(session);
  //     if (!user) throw new NotFoundError("User not found");

  //     // Find vault and verify ownership

  //     const vault = await findVault(vaultId, userId, session);

  //     // Find user's MAIN_CHECKINGS wallet
  //     const mainVaultWallet = await mainChecking(
  //       user.userId,
  //       vault.currency,
  //       LedgerAccountType.MAIN_CHECKINGS,
  //       session,
  //     );

  //     if (mainVaultWallet?.availableBalance < amount) {
  //       throw new BadRequestError("Insufficient balance");
  //     }

  //     // Find vault ledger account
  //     const findFaultLedger = await findVaultLedger(
  //       vault.ledgerAccountId,
  //       session,
  //     );

  //     // Find main checkings ledger account
  //     const mainLedger = await LedgerAccount.findById(
  //       mainWallet.ledgerAccountId,
  //     ).session(session);
  //     if (!mainLedger) throw new NotFoundError("Main ledger not found");

  //     const transactionRef = `VAULT_DEPOSIT_${vaultId}_${generateEventId()}`;

  //     const result = await new TransferEngine({
  //       transactionRef,
  //       ledgerAccountId: mainLedger._id,
  //       amount,
  //       currency: vault.currency,
  //       referenceId: vaultId,
  //       referenceType: "VAULT_DEPOSIT",
  //     }).transferEngines(context, session);

  //     builder.addCredit({
  //       transactionRef,
  //       ledgerAccountId: vaultLedger._id,
  //       amount,
  //       currency: vault.currency,
  //       referenceId: vaultId,
  //       referenceType: "VAULT_DEPOSIT",
  //     });

  //     await builder.commit(session);

  //     // Update main wallet balance
  //     await Wallet.findOneAndUpdate(
  //       { _id: mainWallet._id, version: mainWallet.version },
  //       { $inc: { availableBalance: -amount } },
  //       { session },
  //     );

  //     // Update vault balance
  //     const newVaultBalance = vault.currentBalanceMinor + amount;

  //     // Check if TARGET vault reached its goal
  //     let vaultUpdate: any = {
  //       $inc: { currentBalanceMinor: amount },
  //       $set: { version: (vault as any).version + 1 },
  //     };

  //     if (
  //       vault.vaultType === "TARGET" &&
  //       vault.targetAmountMinor > 0 &&
  //       newVaultBalance >= vault.targetAmountMinor
  //     ) {
  //       vaultUpdate.$set = {
  //         ...vaultUpdate.$set,
  //         "lock.state": "MATURED",
  //         status: "COMPLETED",
  //       };

  //       logger.info("Target vault goal reached", {
  //         vaultId,
  //         targetAmountMinor: vault.targetAmountMinor,
  //         currentBalance: newVaultBalance,
  //       });
  //     }

  //     await vaultModel.updateOne({ _id: vault._id }, vaultUpdate, { session });

  //     await emitOutboxEvent(
  //       {
  //         topic: "vault.events",
  //         eventId: generateEventId(),
  //         eventType: AuditAction.VAULT_DEPOSIT,
  //         action: AuditAction.VAULT_DEPOSIT,
  //         status: AuditStatus.PENDING,
  //         payload: {
  //           vaultId,
  //           userId: user.userId,
  //           amount,
  //           newBalance: newVaultBalance,
  //           currency: vault.currency,
  //         },
  //         aggregateType: "VAULT",
  //         aggregateId: vaultId,
  //         version: 1,
  //         context,
  //       },
  //       { session },
  //     );

  //     await session.commitTransaction();

  //     return {
  //       vaultId,
  //       amount,
  //       newBalance: newVaultBalance,
  //       targetReached:
  //         vault.vaultType === "TARGET" &&
  //         newVaultBalance >= vault.targetAmountMinor,
  //     };
  //   } catch (err) {
  //     if (session.inTransaction()) await session.abortTransaction();
  //     throw err;
  //   } finally {
  //     session.endSession();
  //   }
  // }

  // // ─── Withdraw from vault ───────────────────────────────────────────────────
  // public async withdrawFromVault(params: {
  //   userId: string;
  //   vaultId: string;
  //   amount: number;
  //   context: IRequestContext;
  // }) {
  //   const { userId, vaultId, amount, context } = params;

  //   if (!Number.isInteger(amount) || amount <= 0) {
  //     throw new BadRequestError("Amount must be a positive integer in kobo");
  //   }

  //   const session = await mongoose.startSession();
  //   session.startTransaction();

  //   try {
  //     const user = await User.findOne({ userId }).session(session);
  //     if (!user) throw new NotFoundError("User not found");

  //     const vault = await vaultModel
  //       .findOne({
  //         vaultId,
  //         userId: user._id,
  //       })
  //       .session(session);

  //     if (!vault) throw new NotFoundError("Vault not found");

  //     if (vault.status === "CANCELLED") {
  //       throw new BadRequestError("Cannot withdraw from a cancelled vault");
  //     }

  //     if (vault.currentBalanceMinor < amount) {
  //       throw new BadRequestError("Insufficient vault balance");
  //     }

  //     // Determine if penalty applies
  //     const penaltyInfo = this.calculatePenalty(vault, amount);

  //     const userReceives = amount - penaltyInfo.penaltyAmount;
  //     const treasuryReceives = penaltyInfo.penaltyAmount;

  //     // Get wallets and ledger accounts
  //     const mainWallet = await Wallet.findOne({
  //       userPublicId: user.userId,
  //       type: LedgerAccountType.MAIN_CHECKINGS,
  //       currency: vault.currency,
  //     }).session(session);

  //     if (!mainWallet) throw new NotFoundError("Main wallet not found");

  //     const vaultLedger = await LedgerAccount.findById(
  //       vault.ledgerAccountId,
  //     ).session(session);
  //     if (!vaultLedger) throw new NotFoundError("Vault ledger not found");

  //     const mainLedger = await LedgerAccount.findById(
  //       mainWallet.ledgerAccountId,
  //     ).session(session);
  //     if (!mainLedger) throw new NotFoundError("Main ledger not found");

  //     const transactionRef = `VAULT_WITHDRAW_${vaultId}_${generateEventId()}`;

  //     const builder = new TransactionBuilder("VAULT_TRANSFER");

  //     // Always debit vault
  //     builder.addDebit({
  //       transactionRef,
  //       ledgerAccountId: vaultLedger._id,
  //       amount,
  //       currency: vault.currency,
  //       referenceId: vaultId,
  //       referenceType: "VAULT_WITHDRAWAL",
  //     });

  //     if (treasuryReceives > 0) {
  //       // With penalty — split credit between user and treasury
  //       const treasuryLedger = await LedgerAccount.findOne({
  //         ownerType: LedgerOwnerType.SYSTEM,
  //         type: LedgerAccountType.SYSTEM_TREASURY,
  //         currency: vault.currency,
  //       }).session(session);

  //       if (!treasuryLedger)
  //         throw new NotFoundError("Treasury ledger not found");

  //       const treasuryWallet = await Wallet.findOne({
  //         userPublicId: "SYSTEM_USER",
  //         type: LedgerAccountType.SYSTEM_TREASURY,
  //         currency: vault.currency,
  //       }).session(session);

  //       if (!treasuryWallet)
  //         throw new NotFoundError("Treasury wallet not found");

  //       builder.addCredit({
  //         transactionRef,
  //         ledgerAccountId: mainLedger._id,
  //         amount: userReceives,
  //         currency: vault.currency,
  //         referenceId: vaultId,
  //         referenceType: "VAULT_WITHDRAWAL",
  //       });

  //       builder.addCredit({
  //         transactionRef,
  //         ledgerAccountId: treasuryLedger._id,
  //         amount: treasuryReceives,
  //         currency: vault.currency,
  //         referenceId: vaultId,
  //         referenceType: "VAULT_PENALTY",
  //       });

  //       await builder.commit(session);

  //       // Update treasury wallet
  //       await Wallet.findOneAndUpdate(
  //         { _id: treasuryWallet._id },
  //         { $inc: { availableBalance: treasuryReceives } },
  //         { session },
  //       );
  //     } else {
  //       // No penalty — full amount to user
  //       builder.addCredit({
  //         transactionRef,
  //         ledgerAccountId: mainLedger._id,
  //         amount: userReceives,
  //         currency: vault.currency,
  //         referenceId: vaultId,
  //         referenceType: "VAULT_WITHDRAWAL",
  //       });

  //       await builder.commit(session);
  //     }

  //     // Update main wallet
  //     await Wallet.findOneAndUpdate(
  //       { _id: mainWallet._id, version: mainWallet.version },
  //       { $inc: { availableBalance: userReceives } },
  //       { session },
  //     );

  //     // Update vault balance
  //     const newVaultBalance = vault.currentBalanceMinor - amount;

  //     await vaultModel.updateOne(
  //       { _id: vault._id },
  //       { $inc: { currentBalanceMinor: -amount } },
  //       { session },
  //     );

  //     await emitOutboxEvent(
  //       {
  //         topic: "vault.events",
  //         eventId: generateEventId(),
  //         eventType: AuditAction.VAULT_WITHDRAWAL,
  //         action: AuditAction.VAULT_WITHDRAWAL,
  //         status: AuditStatus.PENDING,
  //         payload: {
  //           vaultId,
  //           userId: user.userId,
  //           amount,
  //           userReceives,
  //           penaltyAmount: treasuryReceives,
  //           penaltyApplied: penaltyInfo.penaltyApplied,
  //           penaltyReason: penaltyInfo.reason,
  //           newBalance: newVaultBalance,
  //           currency: vault.currency,
  //         },
  //         aggregateType: "VAULT",
  //         aggregateId: vaultId,
  //         version: 1,
  //         context,
  //       },
  //       { session },
  //     );

  //     await session.commitTransaction();

  //     return {
  //       vaultId,
  //       amountWithdrawn: amount,
  //       penaltyApplied: penaltyInfo.penaltyApplied,
  //       penaltyAmount: treasuryReceives,
  //       penaltyReason: penaltyInfo.reason,
  //       amountReceived: userReceives,
  //       newVaultBalance,
  //     };
  //   } catch (err) {
  //     if (session.inTransaction()) await session.abortTransaction();
  //     throw err;
  //   } finally {
  //     session.endSession();
  //   }
  // }

  // // ─── Penalty calculator ────────────────────────────────────────────────────
  // private calculatePenalty(
  //   vault: any,
  //   amount: number,
  // ): {
  //   penaltyApplied: boolean;
  //   penaltyAmount: number;
  //   reason: string;
  // } {
  //   const now = new Date();

  //   // FLEXIBLE — never any penalty
  //   if (vault.vaultType === "FLEXIBLE") {
  //     return {
  //       penaltyApplied: false,
  //       penaltyAmount: 0,
  //       reason: "FLEXIBLE_VAULT",
  //     };
  //   }

  //   // LOCKED — check maturity date
  //   if (vault.vaultType === "LOCKED") {
  //     const matured = vault.lock?.lockedUntil && vault.lock.lockedUntil <= now;

  //     if (matured || vault.lock?.state === "MATURED") {
  //       return {
  //         penaltyApplied: false,
  //         penaltyAmount: 0,
  //         reason: "VAULT_MATURED",
  //       };
  //     }

  //     const basisPoints =
  //       vault.lock?.penaltyBasisPoints ?? DEFAULT_PENALTY_BASIS_POINTS.LOCKED;
  //     const penaltyAmount = Math.floor((amount * basisPoints) / 10000);

  //     return {
  //       penaltyApplied: true,
  //       penaltyAmount,
  //       reason: "EARLY_WITHDRAWAL_BEFORE_MATURITY",
  //     };
  //   }

  //   // TARGET — check if target reached
  //   if (vault.vaultType === "TARGET") {
  //     const targetReached =
  //       vault.lock?.state === "MATURED" ||
  //       vault.status === "COMPLETED" ||
  //       (vault.targetAmountMinor > 0 &&
  //         vault.currentBalanceMinor >= vault.targetAmountMinor);

  //     if (targetReached) {
  //       return {
  //         penaltyApplied: false,
  //         penaltyAmount: 0,
  //         reason: "TARGET_REACHED",
  //       };
  //     }

  //     const basisPoints =
  //       vault.lock?.penaltyBasisPoints ?? DEFAULT_PENALTY_BASIS_POINTS.TARGET;
  //     const penaltyAmount = Math.floor((amount * basisPoints) / 10000);

  //     return {
  //       penaltyApplied: true,
  //       penaltyAmount,
  //       reason: "EARLY_WITHDRAWAL_BEFORE_TARGET",
  //     };
  //   }

  //   return { penaltyApplied: false, penaltyAmount: 0, reason: "UNKNOWN" };
  // }

  // // ─── Get vault ─────────────────────────────────────────────────────────────
  // public async getVault(userId: string, vaultId: string) {
  //   const user = await User.findOne({ userId });
  //   if (!user) throw new NotFoundError("User not found");

  //   const vault = await vaultModel
  //     .findOne({
  //       vaultId,
  //       userId: user._id,
  //     })
  //     .lean();

  //   if (!vault) throw new NotFoundError("Vault not found");

  //   return vault;
  // }

  // // ─── List user vaults ──────────────────────────────────────────────────────
  // public async getUserVaults(userId: string) {
  //   const user = await User.findOne({ userId });
  //   if (!user) throw new NotFoundError("User not found");

  //   return vaultModel.find({ userId: user._id }).sort({ createdAt: -1 }).lean();
  // }

  // // ─── Close vault ───────────────────────────────────────────────────────────
  // public async closeVault(params: {
  //   userId: string;
  //   vaultId: string;
  //   context: IRequestContext;
  // }) {
  //   const { userId, vaultId, context } = params;

  //   // Withdraw everything (penalty applies if locked)
  //   const vault = await vaultModel.findOne({ vaultId });
  //   if (!vault) throw new NotFoundError("Vault not found");

  //   if (vault.currentBalanceMinor > 0) {
  //     await this.withdrawFromVault({
  //       userId,
  //       vaultId,
  //       amount: vault.currentBalanceMinor,
  //       context,
  //     });
  //   }

  //   await vaultModel.updateOne({ vaultId }, { $set: { status: "CANCELLED" } });

  //   return { vaultId, closed: true };
  // }
}

export default new VaultService();
