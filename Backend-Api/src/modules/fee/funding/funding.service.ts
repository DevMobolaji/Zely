// src/modules/funding/funding.service.ts
import mongoose, { Types } from "mongoose";

import BadRequestError from "@/shared/errors/badRequest";
import { NotFoundError } from "@/shared/errors/notFoundError";
import { IRequestContext } from "@/config/interfaces/request.interface";
import { emitOutboxEvent } from "@/infrastructure/helpers/emit.audit.helper";
import { generateEventId } from "@/shared/utils/id.generator";
import { logger } from "@/shared/utils/logger";
import { LedgerEntryType } from "@/modules/ledger/ledger.entry.model";
import { Wallet } from "@/modules/wallet/wallet.model";
import { LedgerAccount, LedgerAccountType, LedgerOwnerType } from "@/modules/ledger/ledger.account.model";
import { AuditAction, AuditStatus } from "@/modules/audit/audit.interface";
import { LedgerTransactionModel } from "@/modules/ledger/ledger.transaction.model";
import TransactionBuilder from "@/modules/ledger/ledger.transaction.builder";

export enum FundingSource {
  PAYSTACK_WEBHOOK = "PAYSTACK_WEBHOOK",
  ADMIN_MANUAL = "ADMIN_MANUAL",
  DEV_SEED = "DEV_SEED",
  BANK_TRANSFER = "BANK_TRANSFER",
}

// Only these wallet types can be funded from external sources
const FUNDABLE_WALLET_TYPES = [
  LedgerAccountType.SYSTEM_TREASURY,
  LedgerAccountType.MAIN_CHECKINGS,  // user wallets via Paystack later
];

interface CreditFromExternalParams {
  targetWalletId: string;          // wallet to credit
  amount: number;                   // amount in minor units (kobo)
  currency: string;
  source: FundingSource;
  providerReference: string;        // Paystack ref / admin request ID — idempotency key
  initiatedByUserId: string;        // who triggered (admin sub for manual, user sub for Paystack)
  context: IRequestContext;
  metadata?: Record<string, any>;   // extra info — Paystack response, admin reason, etc.
}

class FundingService {
  /**
   * Credits a wallet from an external source via proper double-entry ledger.
   * 
   * Used by:
   * - Paystack webhook (user wallet funding)
   * - Admin manual top-up (treasury funding)
   * - Dev seeder (treasury bootstrap)
   * - Future: bank transfer webhook
   * 
   * Idempotent on (source, providerReference) — same key returns the same result.
   */

  public async creditFromExternalSource(params: CreditFromExternalParams) {
    const {
      targetWalletId, amount, currency, source,
      providerReference, initiatedByUserId, context, metadata,
    } = params;

    // 1. Validation
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestError("FUNDING_AMOUNT_MUST_BE_POSITIVE");
    }
    if (!Number.isInteger(amount)) {
      throw new BadRequestError("FUNDING_AMOUNT_MUST_BE_INTEGER_MINOR_UNITS");
    }

    const idempotencyRef = `${source}_${providerReference}`;

    // 2. Idempotency check — has this transaction already been posted?
    const existing = await LedgerTransactionModel.findOne({
      transactionRef: idempotencyRef,
    }).lean();

    if (existing) {
      logger.info("Funding request already processed (idempotent)", {
        ref: idempotencyRef,
      });
      return { alreadyProcessed: true, transactionRef: idempotencyRef };
    }

    // 3. Look up target wallet
    const targetWallet = await Wallet.findOne({ walletId: targetWalletId });

    if (!targetWallet) throw new NotFoundError("TARGET_WALLET_NOT_FOUND");

    if (!FUNDABLE_WALLET_TYPES.includes(targetWallet.type)) {
      throw new BadRequestError(`WALLET_TYPE_NOT_FUNDABLE_${targetWallet.type}`);
    }
    if (targetWallet.currency !== currency) throw new BadRequestError("CURRENCY_MISMATCH");

    if (targetWallet.status !== "ACTIVE") {
      throw new BadRequestError(`TARGET_WALLET_NOT_ACTIVE_${targetWallet.status}`);
    }

    // 4. Look up EXTERNAL_FUNDING ledger
    const externalLedger = await LedgerAccount.findOne({
      ownerType: LedgerOwnerType.SYSTEM,
      type: LedgerAccountType.EXTERNAL_FUNDING,
      currency,
    });

    if (!externalLedger) {
      throw new Error("EXTERNAL_FUNDING_LEDGER_NOT_FOUND");
    }

    // 5. Execute via TransactionBuilder
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const previousBalance = targetWallet.availableBalance;

      const builder = new TransactionBuilder('DEPOSIT');

      builder.addDebit({
        transactionRef: idempotencyRef,
        ledgerAccountId: externalLedger._id,
        amount,
        currency,
        referenceId: providerReference,
        referenceType: LedgerEntryType.DEPOSIT,
        nature: "DEBIT"
      });

      builder.addCredit({
        transactionRef: idempotencyRef,
        ledgerAccountId: targetWallet.ledgerAccountId,
        amount,
        currency,
        referenceId: providerReference,
        referenceType: LedgerEntryType.DEPOSIT,
        nature: "CREDIT"
      });

      await builder.commit(session);

      // Update wallet with optimistic concurrency
      const updatedWallet = await Wallet.findOneAndUpdate(
        { _id: targetWallet._id, version: targetWallet.version },
        { $inc: { availableBalance: amount } },
        { session, new: true }
      );

      if (!updatedWallet) {
        throw new BadRequestError("WALLET_VERSION_CONFLICT_RETRY");
      }

      // Emit funding event
      await emitOutboxEvent(
        {
          topic: "funding.events",
          eventId: generateEventId(),
          eventType: AuditAction.FUNDING_CREDITED,
          action: AuditAction.FUNDING_CREDITED,
          status: AuditStatus.PENDING,
          payload: {
            transactionRef: idempotencyRef,
            source,
            providerReference,
            amount,
            currency,
            targetWalletId: targetWallet.walletId,
            targetWalletType: targetWallet.type,
            targetUserPublicId: targetWallet.userPublicId,
            previousBalance,
            currentBalance: updatedWallet.availableBalance,
            initiatedByUserId,
            metadata,
          },
          aggregateType: "FUNDING",
          aggregateId: idempotencyRef,
          version: 1,
          context,
        },
        { session }
      );

      await session.commitTransaction();

      logger.info("✅ External funding credited", {
        ref: idempotencyRef,
        source, amount, currency,
        targetWalletType: targetWallet.type,
      });

      return {
        alreadyProcessed: false,
        transactionRef: idempotencyRef,
        previousBalance,
        currentBalance: updatedWallet.availableBalance,
        amount,
      };
    } catch (err: any) {
      if (session.inTransaction()) await session.abortTransaction();
      logger.error("❌ External funding failed", {
        ref: idempotencyRef,
        error: err.message,
      });
      throw err;
    } finally {
      session.endSession();
    }
  }
}

export default FundingService;