import Controller from "@/config/interfaces/controller.interfaces";
import { IAuthRequest } from "@/config/interfaces/request.interface";
import asyncWrapper from "@/shared/middleware/async.wrapper";
import { getIdempotencyKey, getRequestContext } from "@/shared/middleware/request.context";
import { Router, Response } from "express";
import TransferService from "./transfer.service";
import { generateIdempotencyKey } from "@/shared/utils/id.generator";
import { requireAuth } from "@/shared/middleware/auth.middleware";

class TransferController implements Controller {
  public path = "/transfer";
  public route = Router();
  private transferService = new TransferService();

  constructor() {
    this.initializeRoutes();
  }

  private initializeRoutes(): void {
    this.route.post(`${this.path}/p2p`, requireAuth, this.p2pTransfer);
    this.route.post(`${this.path}/internal`, requireAuth, this.internalTransfer);
  }

  private p2pTransfer = asyncWrapper(async (req: IAuthRequest, res: Response): Promise<Response> => {
    const { amount, to: toAccountNumber, currency } = req.body;

    const senderId = req.user!.userId;

    const dto = {
      senderId,
      amount,
      toAccountNumber,
      currency,
      idempotencyKey: getIdempotencyKey(req) || generateIdempotencyKey()
    }

    const result = await this.transferService.p2pTransfer(dto, getRequestContext(req));

    return res.status(200).json({ ok: true, status: result });

  });


  private internalTransfer = asyncWrapper(async (req: IAuthRequest, res: Response): Promise<Response> => {
    const context = getRequestContext(req);
    const { amount, currency, fromType, toType } = req.body;
    const senderId = req.user!.userId;

    const dto = {
      senderId,
      amount,
      currency,
      fromType,
      toType,
      idempotencyKey: getIdempotencyKey(req) || generateIdempotencyKey()
    }
    const result = await this.transferService.transferBetweenWallet(dto, context);

    return res.status(200).send({
      ok: true,
      status: result
    });
  });
}

export default TransferController;
