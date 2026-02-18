import { deductWalletFunds, ensureWalletsAreActive, findWalletByType, lockWalletFunds, lookUpAccounts, lookUpLedgerAccount, lookUpLedgerAccountByWalletId, lookUpPrimaryWallets, resolveAccountByUserId } from "../helpers/resolvers";
import BadRequestError from "@/shared/errors/badRequest";
import TransferEngine from "./transferEngine";
import { IRequestContext } from "@/config/interfaces/request.interface";
import { internalTransferRequest, TransferRequestInput } from "./transfer.interface";
import { generateIdempotencyKey } from "@/shared/utils/id.generator";
import mongoose, { Types } from "mongoose";
import { Wallet, WalletType } from "../wallet/wallet.model";


class TransferService {
  public async p2pTransfer(dto: TransferRequestInput, context: IRequestContext) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      /** -------------------------
       * RESOLVED ACCOUNTS
       * ------------------------- */

      const { senderAccount, receiverAccount } =
        await lookUpAccounts(
          { senderId: dto.senderId, toAccountNumber: dto.toAccountNumber },
          session
        );

      // Prevent same-user transfers here
      if (senderAccount.userId.equals(receiverAccount.userId)) {
        throw new BadRequestError("USE_INTERNAL_TRANSFER");
      }

      if (!dto.toAccountNumber || typeof dto.amount !== "number" || dto.amount <= 0) {
        throw new BadRequestError("Invalid transfer request");
      }

      /** -------------------------
       * WALLET RESOLUTION
       * ------------------------- */
      const senderWallet = await lookUpPrimaryWallets(
        senderAccount.walletId,
        dto.currency,
        session
      );

      const receiverWallet = await lookUpPrimaryWallets(
        receiverAccount.walletId,
        dto.currency,
        session
      );

      /**
       * --------------------------------
       * ENSURE ACTIVE WALLET AND LOCK FUNDS
       * --------------------------------
       */
      await ensureWalletsAreActive(
        senderWallet._id,
        receiverWallet._id,
        session
      );

      await lockWalletFunds(senderWallet._id, dto.amount, session);

      /** -------------------------
       * RESOLVE LEDGER ACCOUNTS
       * ------------------------- */

      const { senderLedgerId, receiverLedgerId } =
        await lookUpLedgerAccount(
          senderWallet._id,
          receiverWallet._id,
          session
        );

      /** -------------------------
       * TRANSFER ENGINE
         * ------------------------- */
      const result = await new TransferEngine(
        {
          senderAccount,
          receiverAccount,
          senderWallet,
          receiverWallet,
          senderLedgerId,
          receiverLedgerId,
          amount: dto.amount,
          currency: dto.currency,
          idempotencyKey: generateIdempotencyKey(),
        },
        "P2P_TRANSFER"
      ).transferEngines(context, session);

      await session.commitTransaction();
      return result;
    } catch (e) {
      await session.abortTransaction();
      throw e;
    } finally {
      session.endSession();
    }
  }

  public async transferBetweenWallet(
    dto: internalTransferRequest,
    context: IRequestContext
  ) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      /** -------------------------
       * RESOLVE ACCOUNTS
      * ------------------------- */

      const checking = await resolveAccountByUserId(
        dto.senderId,
        dto.fromType,
        dto.currency,
        session
      );


      const savings = await resolveAccountByUserId(
        dto.senderId,
        dto.toType,
        dto.currency,
        session
      );

      if (!checking || !savings) {
        throw new BadRequestError("ACCOUNT_NOT_FOUND");
      }

      if (!checking.userId.equals(savings.userId)) {
        throw new BadRequestError("CROSS_USER_INTERNAL_TRANSFER");
      }

      if(dto.fromType === dto.toType) {
        throw new BadRequestError("INVALID ACCOUNT TYPES")
      }
      
      /** -------------------------
       * WALLET LOAD
      * ------------------------- */
      const senderWallet = await findWalletByType(
        checking.walletId,
        dto.fromType as WalletType,
        dto.currency,
        session
      );

      const receiverWallet = await findWalletByType(
        savings.walletId,
        dto.toType as WalletType,
        dto.currency,
        session
      );


      /** -------------------------
       * LEDGER RESOLUTION
       * ------------------------- */
      const { senderLedgerId, receiverLedgerId } =
        await lookUpLedgerAccountByWalletId(
          senderWallet._id,
          receiverWallet._id,
          dto.fromType,
          dto.toType,
          session
        );

        
      /** -------------------------
       * TRANSFER ENGINE
         * ------------------------- */

      const result = await new TransferEngine(
        {
          senderAccount: checking,
          receiverAccount: savings,
          senderWallet,
          receiverWallet,
          senderLedgerId,
          receiverLedgerId,
          amount: dto.amount,
          currency: dto.currency,
          idempotencyKey: dto.idempotencyKey,
        },
        "INTERNAL_TRANSFER"
      ).transferEngines(context, session);

      await session.commitTransaction();
      return result;
    } catch (e) {
      await session.abortTransaction();
      throw e;
    } finally {
      session.endSession();
    }
  }


}

export default TransferService;


