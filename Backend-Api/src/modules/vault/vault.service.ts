import { LedgerAccount, LedgerAccountType, LedgerOwnerType } from "../ledger/ledger.account.model";
import vaultModel from "./vault.model";
import mongoose from "mongoose";
import User from "../auth/authmodel";
import { emitOutboxEvent } from "@/infrastructure/helpers/emit.audit.helper";
import { AuditAction, AuditStatus } from "../audit/audit.interface";
import { IRequestContext } from "@/config/interfaces/request.interface";
import BadRequestError from "@/shared/errors/badRequest";
import { generateVaultId } from "@/shared/utils/id.generator";

class vaultService {
  private vaultModel = vaultModel;

  public async createVault(userId: string, title: string, targetAmountMinor: number, targetDeadline: Date, autoSave: boolean, context: IRequestContext) {

    const vaultId = generateVaultId();
    const session = await mongoose.startSession();

    session.startTransaction();

    try {

      const user = await User.findOne({ userId }).session(session);

      if (!user) {
        throw new Error("User not found");
      }

      const existingVault = await this.vaultModel.findOne({
        userId: user._id,
        title,
        status: "ACTIVE",
      }).session(session);

      if (existingVault) {
        throw new BadRequestError("Active vault with this title already exists");
      }

      // 1. Create vault object
      let vault = new this.vaultModel({
        userId: user._id,
        userPublicId: user.userId,
        vaultId,
        title,
        currency: "NGN",
        targetAmountMinor,
        targetDeadline,
        autoSave: { enabled: autoSave },
        status: "ACTIVE",
        lock: { state: "UNLOCKED" },
      });

      // 2. Create ledger object
      const ledger = new LedgerAccount({
        ownerPublicId: vault.vaultId,
        ownerId: vault._id,
        ownerType: LedgerOwnerType.VAULT,
        userPublicId: user.userId,
        type: LedgerAccountType.VAULT,
        currency: "NGN",
      });

      vault.ledgerAccountId = ledger._id;
      await ledger.save({ session });
      await vault.save({ session });


      await emitOutboxEvent({
        topic: "vault.events",
        eventId: vault.vaultId,
        eventType: AuditAction.VAULT_CREATED,
        action: AuditAction.VAULT_CREATED,
        status: AuditStatus.PENDING,
        payload: {
          vaultId: vault.vaultId,
          userId: user.userId,
          title: vault.title,
          targetAmountMinor: vault.targetAmountMinor,
          targetDeadline: vault.targetDeadline,
          autoSave: vault.autoSave,
          lock: vault.lock,
        },
        aggregateType: "VAULT",
        aggregateId: vault.vaultId,
        version: 1,
        context,
      }, { session });

      await session.commitTransaction();

      return vault;
    } catch (error) {
      if (session.inTransaction()) {
        await session.abortTransaction();
      }
      throw error;
    } finally {
      session.endSession();
    }

  }
}

export default new vaultService()