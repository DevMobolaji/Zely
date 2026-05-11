// src/modules/payments/payment.service.ts
import mongoose, { Types } from "mongoose";
import {
  PaymentInitialization,
  PaymentInitializationDocument,
  PaymentInitializationStatus,
  PaymentPurpose,
} from "./payment.initialization.model";
import { Wallet } from "../wallet/wallet.model";
import { LedgerAccountType } from "@/modules/ledger/ledger.account.model";
import BadRequestError from "@/shared/errors/badRequest";
import { NotFoundError } from "@/shared/errors/notFoundError";
import { IRequestContext } from "@/config/interfaces/request.interface";
import { logger } from "@/shared/utils/logger";
import { config } from "@/config/index";


import UserModel from "../auth/authmodel";
import FundingService, { FundingSource } from "../fee/funding/funding.service";
import { emitOutboxEvent } from "@/infrastructure/helpers/emit.audit.helper";
import { AuditAction, AuditStatus } from "../audit/audit.interface";
import { generateEventId } from "@/shared/utils/id.generator";
import { KycTier, TransactionLimitConfig } from "../transactionLimit/transaction.limit.model";
import { ParsedWebhookEvent, PaymentProvider } from "./payment.provider.interface";
import { getActivePaymentProvider } from "./payment.provider.factory";

interface InitializePaymentParams {
  userId: string;                    // user's _id from JWT
  userSub: string;              // user's public ID from JWT
  amount: number;                    // minor units (kobo)
  currency: string;
  purpose: PaymentPurpose;
  targetWalletId: string;
  clientIdempotencyKey: string;      // from request body
  context: IRequestContext;
}

// Wallet types that can be funded directly via payment (mirror FundingService whitelist)
const FUNDABLE_WALLET_TYPES = [
  LedgerAccountType.SYSTEM_TREASURY,
  LedgerAccountType.MAIN_CHECKINGS,
];

class PaymentService {
  private fundingService = new FundingService();
  private provider: PaymentProvider = getActivePaymentProvider();

  // ─── Initialize a payment ──────────────────────────────────────────────────
  public async initializePayment(params: InitializePaymentParams) {
    const {
      userSub,
      userId: userPublicId,
      amount,
      currency,
      purpose,
      targetWalletId,
      clientIdempotencyKey,
      context,
    } = params;

    console.log(userSub, userPublicId);

    // ─── 1. Basic validation ──────────────────────────────────────────────
    if (!Number.isInteger(amount) || amount <= 0) {
      throw new BadRequestError("AMOUNT_MUST_BE_POSITIVE_INTEGER_KOBO");
    }
    if (amount < config.payment.minAmount) {
      throw new BadRequestError(`AMOUNT_BELOW_MINIMUM_${config.payment.minAmount}`);
    }
    if (amount > config.payment.maxAmount) {
      throw new BadRequestError(`AMOUNT_ABOVE_MAXIMUM_${config.payment.maxAmount}`);
    }
    if (!clientIdempotencyKey || clientIdempotencyKey.length < 10) {
      throw new BadRequestError("CLIENT_IDEMPOTENCY_KEY_REQUIRED");
    }

    // ─── 2. Idempotency check ─────────────────────────────────────────────
    // Same user + same key = return existing initialization
    const existing = await PaymentInitialization.findOne({
      initiatedByUserId: mongoose.Types.ObjectId.createFromHexString(userSub),
      clientIdempotencyKey,
    });

    if (existing) {
      logger.info("Payment initialization already exists (idempotent)", {
        reference: existing.reference,
        status: existing.status,
      });

      return {
        alreadyExists: true,
        reference: existing.reference,
        authorizationUrl: existing.providerAuthorizationUrl,
        status: existing.status,
      };
    }

    // ===========3. Look up user ==================
    const user = await UserModel.findById(userSub).lean();

    if (!user) throw new NotFoundError("USER_NOT_FOUND");

    // ─── 4. Look up target wallet ─────────────────────────────────────────
    const targetWallet = await Wallet.findOne({ walletId: targetWalletId }).lean();
    if (!targetWallet) throw new NotFoundError("TARGET_WALLET_NOT_FOUND");

    if (!FUNDABLE_WALLET_TYPES.includes(targetWallet.type)) {
      throw new BadRequestError(`WALLET_TYPE_NOT_FUNDABLE_${targetWallet.type}`);
    }
    if (targetWallet.currency !== currency) {
      throw new BadRequestError("CURRENCY_MISMATCH");
    }
    if (targetWallet.status !== "ACTIVE") {
      throw new BadRequestError(`WALLET_NOT_ACTIVE_${targetWallet.status}`);
    }
    // Authorization: user-funding requires ownership of target wallet

    if (purpose === PaymentPurpose.USER_WALLET_FUNDING) {
      if (targetWallet.userPublicId !== userPublicId) {
        throw new BadRequestError("CANNOT_FUND_OTHER_USER_WALLET");
      }
    }

    // ─── 5. Tier-based limit check (for user funding) ─────────────────────
    if (purpose === PaymentPurpose.USER_WALLET_FUNDING) {
      const userTier = user.kycTier ?? KycTier.TIER_1;
      const tierConfig = await TransactionLimitConfig.findOne({
        tier: userTier,
        currency,
        isActive: true,
      }).lean();

      if (tierConfig && tierConfig.maxWalletBalance > 0) {
        const projectedBalance = targetWallet.availableBalance + amount;
        if (projectedBalance > tierConfig.maxWalletBalance) {
          throw new BadRequestError(
            `FUNDING_WOULD_EXCEED_TIER_WALLET_CAP_${tierConfig.maxWalletBalance}`
          );
        }
      }
    }

    // ─── 6. Create initialization record (PENDING) ────────────────────────
    const initialization = await PaymentInitialization.create({
      purpose,
      initiatedByUserId: user._id,
      initiatedByUserPublicId: userPublicId,
      targetWalletId: targetWallet.walletId,
      targetWalletType: targetWallet.type,
      amount,
      currency,
      providerName: this.provider.providerName,
      status: PaymentInitializationStatus.PENDING,
      clientIdempotencyKey,
      initiatedAt: new Date(),
    });

    // ─── 7. Call provider to initialize ──────────────────────────────────
    let providerResult;
    try {
      providerResult = await this.provider.initializeTransaction({
        amount,
        currency,
        customerEmail: user.email,
        reference: initialization.reference,
        callbackUrl: config.payment.callbackUrl,
        metadata: {
          purpose,
          userPublicId,
          targetWalletId,
        },
      });
    } catch (err: any) {
      // Provider failed — mark initialization as FAILED, return error
      logger.error("Payment provider initialization failed", {
        reference: initialization.reference,
        error: err.message,
      });

      await PaymentInitialization.updateOne(
        { _id: initialization._id },
        {
          $set: {
            status: PaymentInitializationStatus.FAILED,
            failureReason: `PROVIDER_INIT_FAILED: ${err.message}`,
            completedAt: new Date(),
          },
        }
      );

      throw new BadRequestError(`PAYMENT_PROVIDER_UNAVAILABLE: ${err.message}`);
    }

    // ─── 8. Save provider response ────────────────────────────────────────
    await PaymentInitialization.updateOne(
      { _id: initialization._id },
      {
        $set: {
          providerReference: providerResult.providerReference,
          providerAuthorizationUrl: providerResult.authorizationUrl,
          providerInitResponse: providerResult.rawResponse,
        },
      }
    );

    // ─── 9. Emit outbox event ─────────────────────────────────────────────
    await emitOutboxEvent({
      topic: "payment.events",
      eventId: generateEventId(),
      eventType: AuditAction.PAYMENT_INITIATED,
      action: AuditAction.PAYMENT_INITIATED,
      status: AuditStatus.PENDING,
      payload: {
        reference: initialization.reference,
        providerName: this.provider.providerName,
        providerReference: providerResult.providerReference,
        amount,
        currency,
        purpose,
        targetWalletId: targetWallet.walletId,
        targetWalletType: targetWallet.type,
        userPublicId,
        userEmail: user.email,
      },
      aggregateType: "PAYMENT_INITIATION",
      aggregateId: initialization.reference,
      version: 1,
      context,
    });

    logger.info("✅ Payment initialized", {
      reference: initialization.reference,
      providerReference: providerResult.providerReference,
      amount,
      currency,
    });

    return {
      alreadyExists: false,
      reference: initialization.reference,
      authorizationUrl: providerResult.authorizationUrl,
      status: PaymentInitializationStatus.PENDING,
    };
  }

  // ─── Process incoming webhook ──────────────────────────────────────────────
  public async processWebhook(params: {
    rawBody: string;
    signature: string;
    context: IRequestContext;
  }): Promise<{ acknowledged: boolean; reason?: string }> {
    const { rawBody, signature, context } = params;

    // ─── 1. Verify signature ──
    const isValidSignature = this.provider.verifyWebhookSignature(rawBody, signature);
    if (!isValidSignature) {
      logger.warn("Webhook signature verification failed");
      throw new BadRequestError("INVALID_WEBHOOK_SIGNATURE");
    }

    // ─── 2. Parse the payload ─────────────────────────────────────────────
    let parsedEvent: ParsedWebhookEvent;
    try {
      const payload = JSON.parse(rawBody);
      parsedEvent = this.provider.parseWebhookEvent(payload);
    } catch (err: any) {
      logger.error("Failed to parse webhook payload", { error: err.message });
      // Return 200 — we got it, we just can't use it. Don't make Paystack retry.
      return { acknowledged: true, reason: "UNPARSEABLE_PAYLOAD" };
    }

    if (parsedEvent.type === "UNKNOWN") {
      logger.info("Webhook event type not handled", {
        rawPayload: parsedEvent.rawPayload,
      });
      return { acknowledged: true, reason: "UNHANDLED_EVENT_TYPE" };
    }

    // ─── 3. Look up initialization ────────────────────────────────────────
    const initialization = await PaymentInitialization.findOne({
      reference: parsedEvent.reference,
    });

    if (!initialization) {
      // Webhook references a payment we don't know about.
      // Either: malformed reference, or webhook from a different env (e.g. test webhook in prod).
      logger.warn("Webhook for unknown reference", {
        reference: parsedEvent.reference,
        eventType: parsedEvent.type,
      });
      return { acknowledged: true, reason: "REFERENCE_NOT_FOUND" };
    }

    // ─── 4. Idempotency: skip if already terminal ─────────────────────────
    if (initialization.status !== PaymentInitializationStatus.PENDING) {
      logger.info("Webhook for already-processed initialization (idempotent)", {
        reference: initialization.reference,
        currentStatus: initialization.status,
        webhookEventType: parsedEvent.type,
      });
      return { acknowledged: true, reason: "ALREADY_PROCESSED" };
    }

    // ─── 5. Validate amounts match ────────────────────────────────────────
    // Critical security check — webhook claims user paid X, our record says Y.
    // Mismatch could indicate tampering or bug. Refuse to credit.
    if (parsedEvent.amount !== initialization.amount) {
      logger.error("Webhook amount mismatch", {
        reference: initialization.reference,
        expectedAmount: initialization.amount,
        webhookAmount: parsedEvent.amount,
      });

      await this.markInitializationFailed(
        initialization,
        `AMOUNT_MISMATCH_EXPECTED_${initialization.amount}_GOT_${parsedEvent.amount}`,
        parsedEvent.rawPayload
      );

      return { acknowledged: true, reason: "AMOUNT_MISMATCH" };
    }

    // ─── 6. Branch by event type ──────────────────────────────────────────
    switch (parsedEvent.type) {
      case "PAYMENT_SUCCESS":
        await this.handleSuccessfulPayment(initialization, parsedEvent, context);
        return { acknowledged: true };

      case "PAYMENT_FAILED":
        await this.markInitializationFailed(
          initialization,
          `PROVIDER_REPORTED_FAILURE`,
          parsedEvent.rawPayload
        );
        return { acknowledged: true };

      case "REFUND":
        // Phase 8 — handled by reversal engine
        logger.info("Refund webhook received — deferring to reversal engine", {
          reference: initialization.reference,
        });
        return { acknowledged: true, reason: "REFUND_DEFERRED" };

      case "DISPUTE":
        // Phase 8 — handled by reversal engine
        logger.info("Dispute webhook received — deferring to reversal engine", {
          reference: initialization.reference,
        });
        return { acknowledged: true, reason: "DISPUTE_DEFERRED" };

      default:
        return { acknowledged: true, reason: "UNHANDLED_TYPE" };
    }
  }

  // ─── Handle successful payment ─────────────────────────────────────────────
  private async handleSuccessfulPayment(
    initialization: PaymentInitializationDocument,
    parsedEvent: ParsedWebhookEvent,
    context: IRequestContext
  ): Promise<void> {
    try {
      // Credit the wallet via FundingService — already idempotent
      const fundingResult = await this.fundingService.creditFromExternalSource({
        targetWalletId: initialization.targetWalletId,
        amount: initialization.amount,
        currency: initialization.currency,
        source: FundingSource.PAYSTACK_WEBHOOK,
        providerReference: initialization.reference,
        initiatedByUserId: initialization.initiatedByUserId.toString(),
        context,
        metadata: {
          paymentInitializationId: initialization._id.toString(),
          providerName: initialization.providerName,
          providerReference: initialization.providerReference,
          channel: parsedEvent.channel,
          paidAt: parsedEvent.paidAt,
        },
      });

      // Mark initialization as SUCCESS
      await PaymentInitialization.updateOne(
        {
          _id: initialization._id,
          status: PaymentInitializationStatus.PENDING, // optimistic lock on status
        },
        {
          $set: {
            status: PaymentInitializationStatus.SUCCESS,
            completedAt: new Date(),
            providerWebhookPayload: parsedEvent.rawPayload,
          },
        }
      );

      // Emit success event for downstream consumers (email confirmation, etc.)
      await emitOutboxEvent({
        topic: "payment.events",
        eventId: generateEventId(),
        eventType: AuditAction.PAYMENT_SUCCEEDED,
        action: AuditAction.PAYMENT_SUCCEEDED,
        status: AuditStatus.PENDING,
        payload: {
          reference: initialization.reference,
          providerReference: initialization.providerReference,
          amount: initialization.amount,
          currency: initialization.currency,
          purpose: initialization.purpose,
          targetWalletId: initialization.targetWalletId,
          userPublicId: initialization.initiatedByUserPublicId,
          fundingTransactionRef: fundingResult.transactionRef,
          previousBalance: fundingResult.previousBalance,
          currentBalance: fundingResult.currentBalance,
        },
        aggregateType: "PAYMENT_SUCCESS",
        aggregateId: initialization.reference,
        version: 1,
        context,
      });

      logger.info("✅ Payment processed successfully", {
        reference: initialization.reference,
        amount: initialization.amount,
      });
    } catch (err: any) {
      // FundingService threw (wallet not found, db error, etc.)
      // Mark initialization as FAILED with details, log, but don't crash the webhook.
      // If err is transient (db error), the webhook can retry; idempotency protects us.
      logger.error("Failed to credit wallet on payment success", {
        reference: initialization.reference,
        error: err.message,
      });

      // Re-throw so the controller returns 500 and Paystack retries.
      // FundingService is idempotent — retry is safe.
      throw err;
    }
  }

  // ─── Mark initialization as FAILED ─────────────────────────────────────────
  private async markInitializationFailed(
    initialization: PaymentInitializationDocument,
    reason: string,
    webhookPayload?: any
  ): Promise<void> {
    await PaymentInitialization.updateOne(
      {
        _id: initialization._id,
        status: PaymentInitializationStatus.PENDING,
      },
      {
        $set: {
          status: PaymentInitializationStatus.FAILED,
          failureReason: reason,
          completedAt: new Date(),
          providerWebhookPayload: webhookPayload,
        },
      }
    );

    logger.warn("Payment initialization marked FAILED", {
      reference: initialization.reference,
      reason,
    });
  }

  // ─── Lookup endpoints (for user/admin) ─────────────────────────────────────
  public async getInitializationByReference(reference: string) {
    const init = await PaymentInitialization.findOne({ reference }).lean();
    if (!init) throw new NotFoundError("PAYMENT_INITIALIZATION_NOT_FOUND");
    return init;
  }

  public async listUserInitializations(
    userPublicId: string,
    filters: { status?: PaymentInitializationStatus; limit?: number; skip?: number } = {}
  ) {
    const query: any = { initiatedByUserPublicId: userPublicId };
    if (filters.status) query.status = filters.status;

    return PaymentInitialization.find(query)
      .sort({ createdAt: -1 })
      .limit(filters.limit ?? 20)
      .skip(filters.skip ?? 0)
      .lean();
  }
}

export default PaymentService;