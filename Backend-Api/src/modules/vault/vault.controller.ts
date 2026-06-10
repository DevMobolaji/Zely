import { Router, Response } from "express";
import Controller from "@/config/interfaces/controller.interfaces";
import asyncWrapper from "shared/middleware/async.wrapper";
import { requireAuth } from "shared/middleware/auth.middleware";
import { IAuthRequest } from "@/config/interfaces/request.interface";
import { getRequestContext } from "@/shared/middleware/request.context";
import { StatusCodes } from "http-status-codes";
import BadRequestError from "@/shared/errors/badRequest";
import vaultService from "./vault.service";
import validateRequest from "@/shared/middleware/validation.middleware";
import createVaultSchema from "./vault.validation";

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
    // this.route.post(`${this.path}/:vaultId/deposit`, requireAuth, this.deposit);
    // this.route.post(
    //   `${this.path}/:vaultId/withdraw`,
    //   requireAuth,
    //   this.withdraw,
    // );
    // this.route.get(`${this.path}`, requireAuth, this.listVaults);
    // this.route.get(`${this.path}/:vaultId`, requireAuth, this.getVault);
    // this.route.delete(`${this.path}/:vaultId`, requireAuth, this.closeVault);
  }

  private createVault = asyncWrapper(
    async (req: IAuthRequest, res: Response) => {
      const context = getRequestContext(req);
      const userId = req.user?.userId;
      if (!userId) throw new BadRequestError("User not authenticated");

      console.log(req.body);

      const {
        title,
        vaultType,
        targetAmountMinor,
        lockedUntil,
        penaltyBasisPoints,
      } = req.body;

      const vault = await this.vaultService.createVault({
        userId,
        title,
        vaultType,
        targetAmountMinor,
        lockedUntil,
        penaltyBasisPoints,
        context,
      });

      return res.status(StatusCodes.CREATED).json({ ok: true, data: vault });
    },
  );

  // private deposit = asyncWrapper(async (req: IAuthRequest, res: Response) => {
  //   const context = getRequestContext(req);
  //   const userId = req.user?.userId;
  //   const { vaultId } = req.params;
  //   const { amount } = req.body;

  //   if (!userId) throw new BadRequestError("User not authenticated");

  //   const result = await this.vaultService.depositIntoVault({
  //     userId,
  //     vaultId,
  //     amount,
  //     context,
  //   });

  //   return res.status(StatusCodes.OK).json({ ok: true, data: result });
  // });

  // private withdraw = asyncWrapper(async (req: IAuthRequest, res: Response) => {
  //   const context = getRequestContext(req);
  //   const userId = req.user?.userId;
  //   const { vaultId } = req.params;
  //   const { amount } = req.body;

  //   if (!userId) throw new BadRequestError("User not authenticated");

  //   const result = await this.vaultService.withdrawFromVault({
  //     userId,
  //     vaultId,
  //     amount,
  //     context,
  //   });

  //   return res.status(StatusCodes.OK).json({ ok: true, data: result });
  // });

  // private listVaults = asyncWrapper(
  //   async (req: IAuthRequest, res: Response) => {
  //     const userId = req.user?.userId;
  //     if (!userId) throw new BadRequestError("User not authenticated");

  //     const vaults = await this.vaultService.getUserVaults(userId);

  //     return res.status(StatusCodes.OK).json({ ok: true, data: vaults });
  //   },
  // );

  // private getVault = asyncWrapper(async (req: IAuthRequest, res: Response) => {
  //   const userId = req.user?.userId;
  //   const { vaultId } = req.params;
  //   if (!userId) throw new BadRequestError("User not authenticated");

  //   const vault = await this.vaultService.getVault(userId, vaultId);

  //   return res.status(StatusCodes.OK).json({ ok: true, data: vault });
  // });

  // private closeVault = asyncWrapper(
  //   async (req: IAuthRequest, res: Response) => {
  //     const context = getRequestContext(req);
  //     const userId = req.user?.userId;
  //     const { vaultId } = req.params;
  //     if (!userId) throw new BadRequestError("User not authenticated");

  //     const result = await this.vaultService.closeVault({
  //       userId,
  //       vaultId,
  //       context,
  //     });

  //     return res.status(StatusCodes.OK).json({ ok: true, data: result });
  //   },
  // );
}

export default VaultController;
