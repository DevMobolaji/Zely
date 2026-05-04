import { Response, Router } from "express";
import { StatusCodes } from "http-status-codes";
import asyncWrapper from "@/shared/middleware/async.wrapper";
import validateRequest from "@/shared/middleware/validation.middleware";
import { isAdmin, requireAuth } from "@/shared/middleware/auth.middleware";
import { getRequestContext } from "@/shared/middleware/request.context";
import Controller from "@/config/interfaces/controller.interfaces";
import { IAuthRequest } from "@/config/interfaces/request.interface";
import WalletAdminService from "./wallet.service";
import walletAdminValidation from "./wallet.validation";


class WalletAdminController implements Controller {
  public path = "/admin/wallets";
  public route = Router();
  private walletAdminService = new WalletAdminService();

  constructor() {
    this.initializeRoutes();
  }

  private initializeRoutes(): void {
    this.route.post(
      `${this.path}/:walletId/unfreeze`,
      requireAuth,
      // isAdmin,
      validateRequest(walletAdminValidation.unfreeze, "body"),
      this.unfreezeWallet
    );
  }

  private unfreezeWallet = asyncWrapper(async (req: IAuthRequest, res: Response) => {
    const ctx = getRequestContext(req);
    const adminId = (req as any).user?.sub;
    const { reason, verifyReconciliation } = req.body;

    const result = await this.walletAdminService.unfreezeWallet({
      walletId: req.params.walletId,
      reason,
      adminUserId: adminId,
      verifyReconciliation,
      context: ctx,
    });

    return res.status(StatusCodes.OK).json({ ok: true, data: result });
  });
}

export default WalletAdminController;