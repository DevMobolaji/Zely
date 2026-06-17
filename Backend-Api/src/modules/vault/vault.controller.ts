import Controller from "@/config/interfaces/controller.interfaces";
import { IAuthRequest } from "@/config/interfaces/request.interface";
import BadRequestError from "@/shared/errors/badRequest";
import {
  getIdempotencyKey,
  getRequestContext,
} from "@/shared/middleware/request.context";
import { generateIdempotencyKey } from "@/shared/utils/id.generator";
import { Response, Router } from "express";
import { StatusCodes } from "http-status-codes";
import asyncWrapper from "shared/middleware/async.wrapper";
import { requireAuth } from "shared/middleware/auth.middleware";
import vaultService from "./vault.service";

class VaultController implements Controller {
  public path = "/vault";
  public route = Router();
  private vaultService = vaultService;

  constructor() {
    this.initializeRoutes();
  }

  private initializeRoutes(): void {
    this.route.post(
      `${this.path}/create`,
      requireAuth,
      //validateRequest(createVaultSchema, "body"),
      this.createVault,
    );
    this.route.get(
      `${this.path}/:vaultId/withdrawal-preview`,
      requireAuth,
      this.getWithdrawalPreview,
    );
    this.route.post(
      `${this.path}/:vaultId/withdraw`,
      requireAuth,
      this.withdraw,
    );
    this.route.get(`${this.path}`, requireAuth, this.listVaults);
    this.route.get(`${this.path}/:vaultId`, requireAuth, this.getVault);
    this.route.delete(`${this.path}/:vaultId`, requireAuth, this.closeVault);
  }

  private createVault = asyncWrapper(
    async (req: IAuthRequest, res: Response) => {
      const context = getRequestContext(req);
      const userId = req.user?.userId;
      if (!userId) throw new BadRequestError("User not authenticated");

      const { title, vaultType, targetAmountMinor, lockedUntil } = req.body;

      const vault = await this.vaultService.createVault({
        userId,
        title,
        vaultType,
        targetAmountMinor,
        lockedUntil,
        context,
      });

      return res.status(StatusCodes.CREATED).json({ ok: true, data: vault });
    },
  );

  private getWithdrawalPreview = asyncWrapper(
    async (req: IAuthRequest, res: Response) => {
      const userId = req.user?.userId;
      const { vaultId } = req.params;
      const amount = Number(req.query.amount);

      if (!userId) throw new BadRequestError("User not authenticated");
      if (!amount || amount <= 0) throw new BadRequestError("Invalid amount");

      const result = await this.vaultService.getWithdrawalPreview(
        userId,
        vaultId,
        amount,
      );

      return res.status(StatusCodes.OK).json({ ok: true, data: result });
    },
  );

  private withdraw = asyncWrapper(async (req: IAuthRequest, res: Response) => {
    const context = getRequestContext(req);
    const userId = req.user?.userId;
    const { vaultId } = req.params;
    const { amount, currency } = req.body;

    if (!userId) throw new BadRequestError("User not authenticated");

    const dto = {
      userId,
      amount,
      currency,
      vaultId,
      idempotencyKey: getIdempotencyKey(req) || generateIdempotencyKey(),
    };

    const result = await this.vaultService.withdrawFromVault(dto, context);

    return res.status(StatusCodes.OK).json({ ok: true, data: result });
  });

  private listVaults = asyncWrapper(
    async (req: IAuthRequest, res: Response) => {
      const userId = req.user?.userId;
      if (!userId) throw new BadRequestError("User not authenticated");

      const vaults = await this.vaultService.getUserVaults(userId);

      return res.status(StatusCodes.OK).json({ ok: true, data: vaults });
    },
  );

  private getVault = asyncWrapper(async (req: IAuthRequest, res: Response) => {
    const userId = req.user?.userId;
    const { vaultId } = req.params;
    if (!userId) throw new BadRequestError("User not authenticated");

    const vault = await this.vaultService.getVault(userId, vaultId);

    return res.status(StatusCodes.OK).json({ ok: true, data: vault });
  });

  private closeVault = asyncWrapper(
    async (req: IAuthRequest, res: Response) => {
      const context = getRequestContext(req);
      const userId = req.user?.userId;
      const { vaultId } = req.params;
      if (!userId) throw new BadRequestError("User not authenticated");

      const result = await this.vaultService.closeVault({
        userId,
        vaultId,
        context,
        idempotencyKey: getIdempotencyKey(req) || generateIdempotencyKey(),
      });

      return res.status(StatusCodes.OK).json({ ok: true, data: result });
    },
  );
}

export default VaultController;
