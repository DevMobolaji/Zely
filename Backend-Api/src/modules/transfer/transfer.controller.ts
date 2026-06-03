import Controller from "@/config/interfaces/controller.interfaces";
import { IAuthRequest } from "@/config/interfaces/request.interface";
import asyncWrapper from "@/shared/middleware/async.wrapper";
import {
  getIdempotencyKey,
  getRequestContext,
} from "@/shared/middleware/request.context";
import { Router, Response } from "express";
import TransferService from "./transfer.service";
import { generateIdempotencyKey } from "@/shared/utils/id.generator";
import { requireAuth } from "@/shared/middleware/auth.middleware";
import { requireConsumerReady } from "@/shared/middleware/consumer.ready";
import { calculateFeeBreakdown } from "../fee/transfer.fee.engine";
import BadRequestError from "@/shared/errors/badRequest";

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
      `${this.path}/to-vault`,
      requireConsumerReady,
      requireAuth,
      this.saveToVault,
    );
    // In your router setup
    this.route.get(`${this.path}/fee`, this.getTransferFee);
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

      const result = await this.transferService.p2pTransfer(
        dto,
        getRequestContext(req),
      );

      console.log("P2P Transfer result:", result);

      return res.status(200).json({ ok: true, status: result });
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
      const { amount, currency, vaultId, fromType, toType } = req.body;
      const senderId = req.user!.userId;

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
}

export default TransferController;
