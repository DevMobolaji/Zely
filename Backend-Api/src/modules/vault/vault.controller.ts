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

class vaultController implements Controller {
  public path = "/vault";
  public route = Router();
  private vaultService = vaultService;

  constructor() {
    this.initializeRoutes();
  }

  private initializeRoutes(): void {
    this.route.post(`${this.path}/create`, validateRequest(createVaultSchema, 'body'), requireAuth, this.createVault);
  }

  private createVault = asyncWrapper(async (req: IAuthRequest, res: Response): Promise<Response | void> => {
    const context = getRequestContext(req);
    const userId = req.user?.userId;


    if (!userId) {
      throw new BadRequestError("User not authenticated")
    }

    const { title, targetAmountMinor, targetDeadline, autoSave } = req.body;

    const vault = await this.vaultService.createVault(userId, title, targetAmountMinor, targetDeadline, autoSave, context);

    return res.status(StatusCodes.CREATED).send({ data: vault });
  })
}

export default vaultController