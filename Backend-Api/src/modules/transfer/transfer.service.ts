import { deductWalletFunds, ensureWalletsAreActive, findVault, findWalletByType, lockVaultToPreventConcurrency, lockWalletFunds, lookUpAccounts, lookUpLedgerAccount, lookUpLedgerAccountForP2p, lookUpPrimaryWallets, LookUpVaultLedger, lookupVaultLedger, resolveAccountByUserId, unlockVault, unlockWalletFunds } from "../helpers/resolvers";
import BadRequestError from "@/shared/errors/badRequest";
import TransferEngine from "./transferEngine";
import { IRequestContext } from "@/config/interfaces/request.interface";
import { internalTransferRequest, TransferRequestInput, vaultTransferRequest } from "./transfer.interface";
import { generateIdempotencyKey } from "@/shared/utils/id.generator";
import mongoose, { Types } from "mongoose";
import { Wallet, WalletDocument, WalletType } from "../wallet/wallet.model";
import vaultModel, { VaultDocument } from "../vault/vault.model";
import { LedgerAccount, LedgerOwnerType } from "../ledger/ledgerAccount.model";
import { NotFoundError } from "@/shared/errors/notFoundError";
import { AuditAction, AuditStatus } from "../audit/audit.interface";
import { emitOutboxEvent } from "@/infrastructure/helpers/emit.audit.helper";
import { logger } from "@/shared/utils/logger";
import { extEnsureIdempotence } from "../helpers/ext.idempotence";
import { calculateFeeBreakdown } from "../fee/transfer.fee.engine";


class TransferService {
  public async p2pTransfer(
    dto: TransferRequestInput,
    context: IRequestContext) {

    // ✅ Idempotency check BEFORE any session/transaction
    const { alreadyCompleted, response } = await extEnsureIdempotence(dto.idempotencyKey)

    if (alreadyCompleted) return response;

    const session = await mongoose.startSession();
    session.startTransaction();
    let committed = false;

    let senderWallet: WalletDocument | null = null;
    let receiverWallet: WalletDocument | null = null;


    try {
      /** -------------------------
       * RESOLVE ACCOUNTS
       * ------------------------- */
      const { senderAccount, receiverAccount } = await lookUpAccounts(
        { senderId: dto.senderId, toAccountNumber: dto.toAccountNumber },
        session
      );

      if (!senderAccount || !receiverAccount) {
        throw new BadRequestError("ACCOUNTS_NOT_FOUND");
      }

      if (senderAccount.userId.equals(receiverAccount.userId)) {
        throw new BadRequestError("USE_INTERNAL_TRANSFER");
      }

      if (!dto.toAccountNumber || typeof dto.amount !== "number" || dto.amount <= 0) {
        throw new BadRequestError("INVALID_TRANSFER_REQUEST");
      }

      /** -------------------------
       * LOAD WALLETS
       * ------------------------- */
      senderWallet = await lookUpPrimaryWallets(senderAccount.walletId, dto.currency, session);
      receiverWallet = await lookUpPrimaryWallets(receiverAccount.walletId, dto.currency, session);

      if (!senderWallet || !receiverWallet) {
        throw new BadRequestError("WALLETS_NOT_FOUND");
      }

      /** -------------------------
       * ENSURE ACTIVE WALLETS
       * ------------------------- */
      await ensureWalletsAreActive(senderWallet._id, receiverWallet._id, session);

      /** -------------------------
       * BALANCE SNAPSHOT
       * ------------------------- */
      const prevSenderBalance = senderWallet.availableBalance;
      const prevReceiverBalance = receiverWallet.availableBalance;

      /** -------------------------
       * LOCK SENDER WALLET
       * ------------------------- */
      const { fee, totalDeducted } = await calculateFeeBreakdown(
        dto.amount,
        dto.currency,
        'P2P_TRANSFER'
      );

      const senderWalletLocked = await lockWalletFunds(senderWallet._id, totalDeducted, session);

      if (!senderWalletLocked) {
        throw new BadRequestError("SENDER_WALLET_LOCK_FAILED");
      }

      /** -------------------------
       * TRANSFER ENGINE
       * ------------------------- */
      const { senderLedgerId, receiverLedgerId } = await lookUpLedgerAccount(
        senderAccount.userId,
        LedgerOwnerType.USER,
        receiverAccount.userId,
        LedgerOwnerType.USER,
        dto.currency,
        session
      );

      const result = await new TransferEngine({
        transferType: "P2P_TRANSFER",
        senderAccount,
        receiverAccount,
        senderWallet,
        receiverWallet,
        senderLedgerId,
        receiverLedgerId,
        fee,
        totalDeducted,
        amount: dto.amount,
        currency: dto.currency,
        idempotencyKey: dto.idempotencyKey,
      }).transferEngines(context, session);

      /** -------------------------
       * APPLY BALANCE MUTATION
       * ------------------------- */
      const updatedSenderWallet = await deductWalletFunds(senderWallet._id, totalDeducted, session);

      const updatedReceiverWallet = await Wallet.findOneAndUpdate(
        { _id: receiverWallet._id },
        { $inc: { availableBalance: dto.amount } },
        { session, new: true }
      );

      /** -------------------------
       * OUTBOX EVENT
       * ------------------------- */
      await emitOutboxEvent(
        {
          topic: "transaction.events",
          eventId: result.transactionRef,
          eventType: AuditAction.TRANSACTION_COMPLETED,
          action: AuditAction.TRANSACTION_COMPLETED,
          status: AuditStatus.PENDING,
          payload: {
            sender: {
              walletId: senderWallet.walletId,
              userId: senderWallet.userPublicId,
              name: senderWallet.userId.name,
              email: senderWallet.userId.email,
              accountType: senderAccount.type,
              accountNumber: senderAccount.accountNumber,
              previousBalance: prevSenderBalance,
              currentBalance: updatedSenderWallet?.availableBalance
            },
            receiver: {
              walletId: receiverWallet.walletId,
              userId: receiverWallet.userPublicId,
              name: receiverWallet.userId.name,
              email: receiverWallet.userId.email,
              accountType: receiverAccount.type,
              accountNumber: receiverAccount.accountNumber,
              previousBalance: prevReceiverBalance,
              currentBalance: updatedReceiverWallet?.availableBalance,
            },
            amount: dto.amount,
            fee: result.fee,           // ← add
            totalDeducted: result.totalDeducted,
            currency: dto.currency,
            referenceId: result.referenceId,
            transactionRef: result.transactionRef,
            transferType: "P2P_TRANSFER",
          },
          aggregateType: "TRANSFER",
          aggregateId: result.transactionRef,
          version: 1,
          context,
        },
        { session }
      );

      await session.commitTransaction();
      return result;

    } catch (e) {
      if (!committed) {
        try {
          // The session/transaction may have already been closed by the driver
          if (session.inTransaction()) {
            await session.abortTransaction();
          }
        } catch (abortErr) {
          // Log but don't rethrow — the original error is what matters
          logger.warn("Failed to abort transaction (may already be closed)", {
            abortErr,
          });
        }
      }
      throw e;
    } finally {
      session.endSession();
    }
  }

  public async transferBetweenWallet(
    dto: internalTransferRequest,
    context: IRequestContext
  ) {
    // ✅ Idempotency check BEFORE any session/transaction
    const { alreadyCompleted, response } = await extEnsureIdempotence(dto.idempotencyKey)

    if (alreadyCompleted) return response;

    const session = await mongoose.startSession();
    session.startTransaction();
    let committed = false;

    let senderWalletLocked: WalletDocument | null = null;
    let senderWallet: WalletDocument | null = null;
    let receiverWallet: WalletDocument | null = null;

    try {
      /** -------------------------
       * RESOLVE ACCOUNTS
      * ------------------------- */

      const checkingAccount = await resolveAccountByUserId(
        dto.senderId,
        dto.fromType,
        dto.currency,
        session
      );

      const savingsAccount = await resolveAccountByUserId(
        dto.senderId,
        dto.toType,
        dto.currency,
        session
      );

      if (!checkingAccount || !savingsAccount) {
        throw new BadRequestError("ACCOUNT_NOT_FOUND");
      }

      if (!checkingAccount.userId.equals(savingsAccount.userId)) {
        throw new BadRequestError("CROSS_USER_INTERNAL_TRANSFER");
      }

      if (dto.fromType === dto.toType) {
        throw new BadRequestError("INVALID ACCOUNT TYPES")
      }

      /** -------------------------
       * WALLET LOAD
      * ------------------------- */
      senderWallet = await findWalletByType(
        checkingAccount.walletId,
        dto.fromType as WalletType,
        dto.currency,
        session
      );

      receiverWallet = await findWalletByType(
        savingsAccount.walletId,
        dto.toType as WalletType,
        dto.currency,
        session
      );

      const prevSenderBalance = senderWallet.availableBalance;
      const prevReceiverBalance = receiverWallet?.availableBalance;

      /** -------------------------
     * LOCK SENDER WALLET
    * ------------------------- */
      senderWalletLocked = await lockWalletFunds(senderWallet._id, dto.amount, session);
      if (!senderWalletLocked) {
        throw new BadRequestError("SENDER_WALLET_LOCK_FAILED");
      }

      /** -------------------------
       * LEDGER RESOLUTION
       * ------------------------- */
      const { senderLedger, receiverLedger } =
        await lookUpLedgerAccountForP2p(
          checkingAccount.ledgerAccountId,
          savingsAccount.ledgerAccountId,
          dto.fromType,
          dto.toType,
          session
        );


      /** -------------------------
       * TRANSFER ENGINE
      * ------------------------- */

      const result = await new TransferEngine(
        {
          transferType: "INTERNAL_TRANSFER",
          senderAccount: checkingAccount,
          receiverAccount: savingsAccount,
          senderWallet,
          receiverWallet,
          senderLedgerId: senderLedger._id,
          receiverLedgerId: receiverLedger._id,
          amount: dto.amount,
          currency: dto.currency,
          idempotencyKey: dto.idempotencyKey,
        }
      ).transferEngines(context, session);

      /** -------------------------
     * DEDUCT FUNDS
    * ------------------------- */
      const updatedSenderWallet = await deductWalletFunds(senderWallet._id, dto.amount, session);
      const updatedReceiverWallet = await Wallet.findOneAndUpdate(
        { _id: receiverWallet._id },
        { $inc: { availableBalance: dto.amount } },
        { session, new: true }
      );

      /** -------------------------
       * OUTBOX EVENT
       * ------------------------- */
      await emitOutboxEvent(
        {
          topic: "transaction.events",
          eventId: result.transactionRef,
          eventType: AuditAction.TRANSACTION_COMPLETED,
          action: AuditAction.TRANSACTION_COMPLETED,
          status: AuditStatus.PENDING,
          payload: {
            sender: {
              walletId: senderWallet.walletId,
              userId: senderWallet.userPublicId,
              name: senderWallet.userId.name,
              email: senderWallet.userId.email,
              accountType: checkingAccount.type,
              accountNumber: checkingAccount.accountNumber,
              previousBalance: prevSenderBalance,
              currentBalance: updatedSenderWallet?.availableBalance,
            },
            receiver: {
              walletId: receiverWallet.walletId,
              userId: receiverWallet?.userPublicId,
              name: receiverWallet?.userId.name,
              email: receiverWallet?.userId.email,
              accountType: savingsAccount.type,
              accountNumber: savingsAccount.accountNumber,
              previousBalance: prevReceiverBalance,
              currentBalance: updatedReceiverWallet?.availableBalance,
            },
            amount: dto.amount,
            currency: dto.currency,
            referenceId: result.referenceId,
            transactionRef: result.transactionRef,
            transferType: "INTERNAL_TRANSFER",
          },
          aggregateType: "TRANSFER",
          aggregateId: result.transactionRef,
          version: 1,
          context,
        },
        { session }
      );

      await session.commitTransaction();
      committed = true;
      return result;
    } catch (e) {
      if (!committed) {
        try {
          // The session/transaction may have already been closed by the driver
          if (session.inTransaction()) {
            await session.abortTransaction();
          }
        } catch (abortErr) {
          // Log but don't rethrow — the original error is what matters
          logger.warn("Failed to abort transaction (may already be closed)", {
            abortErr,
          });
        }
      }
      throw e;
    } finally {
      await session.endSession();
    }
  }

  public async transferToVault(
    dto: vaultTransferRequest,
    context: IRequestContext
  ) {
    // ✅ Idempotency check BEFORE any session/transaction
    const { alreadyCompleted, response } = await extEnsureIdempotence(dto.idempotencyKey)

    if (alreadyCompleted) return response;

    const session = await mongoose.startSession();
    session.startTransaction();
    let committed = false;

    let senderWalletLocked: WalletDocument | null = null;
    let senderWallet: WalletDocument | null = null;
    let vault: VaultDocument | null = null;

    try {
      /** -------------------------
       * RESOLVE SENDER ACCOUNT
       * ------------------------- */
      const senderAccount = await resolveAccountByUserId(
        dto.senderId,
        dto.fromType,
        dto.currency,
        session
      );

      if (!senderAccount) {
        throw new BadRequestError("ACCOUNT_NOT_FOUND");
      }

      if (senderAccount.userPublicId !== dto.senderId) {
        throw new BadRequestError("UNAUTHORIZED_TO_TRANSFER_FROM_ACCOUNT");
      }

      /** -------------------------
       * RESOLVE VAULT
       * ------------------------- */
      vault = await findVault(
        dto.vaultId,
        dto.currency,
        dto.senderId,
        session
      );

      if (vault.userPublicId !== context.userId) {
        throw new BadRequestError("UNAUTHORIZED_TO_TRANSFER_TO_VAULT");
      }

      if (vault.currency !== dto.currency) {
        throw new BadRequestError("VAULT_CURRENCY_MISMATCH");
      }

      if (dto.amount <= 0) {
        throw new BadRequestError("INVALID_AMOUNT");
      }

      /** -------------------------
       * LOCK VAULT FOR CONCURRENCY
       * ------------------------- */
      const vaultLocked = await lockVaultToPreventConcurrency(vault._id, session);

      if (!vaultLocked) {
        throw new BadRequestError("VAULT_LOCK_FAILED");
      }

      /** -------------------------
       * LOAD AND LOCK SENDER WALLET
       * ------------------------- */
      senderWallet = await findWalletByType(
        senderAccount.walletId,
        dto.fromType as WalletType,
        dto.currency,
        session
      );

      senderWalletLocked = await lockWalletFunds(senderWallet._id, dto.amount, session);

      if (!senderWalletLocked) {
        throw new BadRequestError("SENDER_WALLET_LOCK_FAILED");
      }

      /** -------------------------
       * LEDGER RESOLUTION
       * ------------------------- */
      const { senderLedgerId, receiverLedgerId } =
        await LookUpVaultLedger(
          senderAccount.ledgerAccountId,
          vault.ledgerAccountId,
          dto.fromType,
          dto.toType,
          session
        );

      if (!senderLedgerId || !receiverLedgerId) {
        throw new NotFoundError("SENDER_LEDGER_NOT_FOUND");
      }

      /** -------------------------
       * TRANSFER ENGINE
       * ------------------------- */
      const result = await new TransferEngine({
        transferType: "VAULT_TRANSFER",
        senderAccount,
        receiverAccount: vault,
        senderWallet,
        senderLedgerId: senderLedgerId._id,
        receiverLedgerId: vault.ledgerAccountId,
        amount: dto.amount,
        currency: dto.currency,
        idempotencyKey: dto.idempotencyKey
      }).transferEngines(context, session);

      /** -------------------------
       * APPLY BALANCES
       * ------------------------- */
      const updatedSenderWallet = await deductWalletFunds(senderWallet._id, dto.amount, session);
      const updatedVault = await vaultModel.findOneAndUpdate(
        { _id: vault._id },
        { $inc: { currentBalanceMinor: dto.amount } },
        { session, new: true }
      );

      await unlockVault(vault._id, session);

      /** -------------------------
     * OUTBOX / EVENT EMISSION
     * ------------------------- */
      await emitOutboxEvent({
        topic: "vault.events",
        eventId: result.transactionRef,
        eventType: AuditAction.VAULT_TRANSFER_COMPLETED,
        action: AuditAction.VAULT_TRANSFER_COMPLETED,
        status: AuditStatus.PENDING,
        payload: {
          sender: {
            walletId: senderWallet.walletId,
            userId: senderWallet.userPublicId,
            name: senderWallet.userId.name,
            accountType: senderAccount.type,
            accountNumber: senderAccount.accountNumber,
            previousBalance: senderWallet.availableBalance,
            currentBalance: updatedSenderWallet?.availableBalance,
          },
          receiver: {
            accountType: "VAULT",
            walletId: vault.vaultId,
            userId: vault.userPublicId,
            vaultId: vault.vaultId,
            previousBalance: vault.currentBalanceMinor,
            currentBalance: updatedVault?.currentBalanceMinor,
          },
          amount: dto.amount,
          currency: dto.currency,
          referenceId: result.referenceId,
          transactionRef: result.transactionRef,
          transferType: "VAULT_TRANSFER",
        },
        aggregateType: "VAULT_TRANSFER",
        aggregateId: result.transactionRef,
        version: 1,
        context,
      }, { session });

      /** -------------------------
       * COMMIT TRANSACTION
       * ------------------------- */
      await session.commitTransaction();
      return result;

    } catch (e) {
      if (!committed) {
        try {
          // The session/transaction may have already been closed by the driver
          if (session.inTransaction()) {
            await session.abortTransaction();
          }
        } catch (abortErr) {
          // Log but don't rethrow — the original error is what matters
          logger.warn("Failed to abort transaction (may already be closed)", {
            abortErr,
          });
        }
      }
      throw e;
    } finally {
      session.endSession();
    }
  }

}

export default TransferService;


