import Controller from "@/config/interfaces/controller.interfaces";
import { IAuthRequest } from "@/config/interfaces/request.interface";
import BadRequestError from "@/shared/errors/badRequest";
import asyncWrapper from "@/shared/middleware/async.wrapper";
import { requireAuth } from "@/shared/middleware/auth.middleware";
import { requireConsumerReady } from "@/shared/middleware/consumer.ready";
import {
  getIdempotencyKey,
  getRequestContext,
} from "@/shared/middleware/request.context";
import { generateIdempotencyKey } from "@/shared/utils/id.generator";
import { Response, Router } from "express";
import { calculateFeeBreakdown } from "../fee/transfer.fee.engine";
import TransferService from "./transfer.service";

class TransferController implements Controller {
  public path = "/transfer";
  public route = Router();
  private transferService = new TransferService();

  constructor() {
    this.initializeRoutes();
  }

  private initializeRoutes(): void {
    this.route.post(
      `${this.path}/p2p`,
      requireConsumerReady,
      requireAuth,
      this.p2pTransfer,
    );
    this.route.post(
      `${this.path}/internal`,
      requireConsumerReady,
      requireAuth,
      this.internalTransfer,
    );
    this.route.post(
      `${this.path}/:vaultId/deposit`,
      requireConsumerReady,
      requireAuth,
      this.saveToVault,
    );
    // In your router setup
    this.route.get(`${this.path}/fee`, this.getTransferFee);
    this.route.get(`${this.path}/lookup`, requireAuth, this.lookupAccount);
  }

  private p2pTransfer = asyncWrapper(
    async (req: IAuthRequest, res: Response): Promise<Response> => {
      const { amount, to: toAccountNumber, currency } = req.body;

      const senderId = req.user!.userId;

      const dto = {
        senderId,
        amount,
        toAccountNumber,
        currency,
        idempotencyKey: getIdempotencyKey(req) || generateIdempotencyKey(),
      };

      const { result, senderNewBalance } =
        await this.transferService.p2pTransfer(dto, getRequestContext(req));

      if (!result) {
        return res.status(200).json({
          ok: true,
          isDuplicate: true,
          message: "Duplicate request — original transfer already processed",
        });
      }

      return res.status(200).json({
        ok: true,
        status: {
          ...result,
          senderNewBalance,
        },
      });
    },
  );

  private getTransferFee = asyncWrapper(
    async (req: IAuthRequest, res: Response): Promise<Response> => {
      const { amount, currency } = req.query;

      if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
        throw new BadRequestError("Invalid amount");
      }

      const breakdown = await calculateFeeBreakdown(
        Number(amount),
        String(currency || "NGN"),
        "P2P_TRANSFER",
      );

      return res.status(200).json({
        ok: true,
        data: {
          amount: Number(amount),
          fee: breakdown.fee,
          totalDeducted: breakdown.totalDeducted,
          currency: breakdown.currency,
          message: `You will be charged ₦${breakdown.fee} fee for this transfer`,
        },
      });
    },
  );

  private internalTransfer = asyncWrapper(
    async (req: IAuthRequest, res: Response): Promise<Response> => {
      const context = getRequestContext(req);
      const { amount, currency, fromType, toType } = req.body;
      const senderId = req.user!.userId;

      const dto = {
        senderId,
        amount,
        currency,
        fromType,
        toType,
        idempotencyKey: getIdempotencyKey(req) || generateIdempotencyKey(),
      };
      const result = await this.transferService.transferBetweenWallet(
        dto,
        context,
      );

      return res.status(200).send({
        ok: true,
        status: result,
      });
    },
  );

  private saveToVault = asyncWrapper(
    async (req: IAuthRequest, res: Response): Promise<Response> => {
      const context = getRequestContext(req);
      const { amount, currency, fromType, toType } = req.body;
      const { vaultId } = req.params;
      const senderId = req.user!.userId;

      console.log(req.params);
      console.log(req.body);

      const dto = {
        senderId,
        amount,
        currency,
        vaultId,
        fromType,
        toType,
        idempotencyKey: getIdempotencyKey(req) || generateIdempotencyKey(),
      };
      const result = await this.transferService.transferToVault(dto, context);

      return res.status(200).send({
        ok: true,
        status: result,
      });
    },
  );

  private lookupAccount = asyncWrapper(
    async (req: IAuthRequest, res: Response): Promise<Response> => {
      const { accountNumber } = req.query;

      if (!accountNumber || typeof accountNumber !== "string") {
        throw new BadRequestError("ACCOUNT_NUMBER_REQUIRED");
      }

      const result = await this.transferService.lookupAccount(accountNumber);

      return res.status(200).json({
        ok: true,
        data: result,
      });
    },
  );
}

export default TransferController;
