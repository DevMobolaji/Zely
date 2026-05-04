import { Response, Router } from "express";
import { StatusCodes } from "http-status-codes";
import asyncWrapper from "@/shared/middleware/async.wrapper";
import validateRequest from "@/shared/middleware/validation.middleware";
import { isAdmin, requireAuth } from "@/shared/middleware/auth.middleware";
import { getRequestContext } from "@/shared/middleware/request.context";
import Controller from "@/config/interfaces/controller.interfaces";
import { IAuthRequest } from "@/config/interfaces/request.interface";
import FundingService, { FundingSource } from "./funding.service";
import { config } from "@/config/index";
import { generateEventId } from "@/shared/utils/id.generator";
import BadRequestError from "@/shared/errors/badRequest";
import { Wallet, WalletType } from "@/modules/wallet/wallet.model";
import fundingValidation from "./funding.validation";


class FundingController implements Controller {
  public path = "/admin/funding";
  public route = Router();
  private fundingService = new FundingService();

  constructor() {
    this.initializeRoutes();
  }

  private initializeRoutes(): void {
    this.route.post(
      `${this.path}/topup-treasury`,
      requireAuth,
      // isAdmin,
      validateRequest(fundingValidation.adminTopUp, "body"),
      this.adminTopUpTreasury
    );
  }

  private adminTopUpTreasury = asyncWrapper(async (req: IAuthRequest, res: Response) => {
    // SAFETY: only allow in non-production until Paystack is wired
    if (config.app.env === "production") {
      throw new BadRequestError("MANUAL_TOPUP_DISABLED_IN_PRODUCTION");
    }

    const { amount, currency, reason } = req.body;
    const ctx = getRequestContext(req);
    const adminId = (req as any).user?.sub;

    // Find treasury wallet for this currency
    const treasuryWallet = await Wallet.findOne({
      userPublicId: "SYSTEM_USER",
      type: WalletType.SYSTEM_TREASURY,  // adjust if your enum names differ — should be TREASURY
      currency,
    });

    if (!treasuryWallet) {
      throw new BadRequestError("TREASURY_WALLET_NOT_FOUND");
    }

    // Generate a deterministic-ish providerReference for this manual top-up
    const providerReference = `ADMIN_TOPUP_${Date.now()}_${generateEventId()}`;

    const result = await this.fundingService.creditFromExternalSource({
      targetWalletId: treasuryWallet.walletId,
      amount,
      currency,
      source: FundingSource.ADMIN_MANUAL,
      providerReference,
      initiatedByUserId: adminId,
      context: ctx,
      metadata: { reason },
    });

    return res.status(StatusCodes.OK).json({ ok: true, data: result });
  });
}

export default FundingController;