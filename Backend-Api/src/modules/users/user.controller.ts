import { IAuthRequest } from "@/config/interfaces/request.interface";
import userService from "@/modules/users/user.service";
import BadRequestError from "@/shared/errors/badRequest";
import asyncWrapper from "@/shared/middleware/async.wrapper";
import { requireAuth } from "@/shared/middleware/auth.middleware";
import { getRequestContext } from "@/shared/middleware/request.context";
import { NextFunction, Request, Response, Router } from "express";

class UserController {
  public path = "/users";
  private userService = new userService();
  public route = Router();

  constructor() {
    this.initializeRoutes();
  }

  private initializeRoutes(): void {
    this.route.get(
      `${this.path}/provisioning-status`,
      requireAuth,
      this.getProvisioningStatus,
    );

    this.route.post(
      `${this.path}/retry-provisioning`,
      requireAuth,
      this.retryProvisioning,
    );

    this.route.get(
      `${this.path}/dashboard-summary`,
      requireAuth,
      this.getDashboardSummary,
    );

    this.route.get(`${this.path}/wallets`, requireAuth, this.getWallets);

    this.route.get(
      `${this.path}/transactions`,
      requireAuth,
      this.getTransactions,
    );
  }

  private getProvisioningStatus = asyncWrapper(
    async (req: IAuthRequest, res: Response): Promise<Response | void> => {
      const userSub = req.user?.sub;
      const context = getRequestContext(req);

      if (!userSub) {
        throw new BadRequestError("USER_SUB_MISSING");
      }

      const result = await this.userService.getProvisioningStatus(
        userSub,
        context,
      );

      res.status(200).json(result);
    },
  );

  private retryProvisioning = asyncWrapper(
    async (req: IAuthRequest, res: Response): Promise<Response | void> => {
      const userSub = req.user?.sub;
      const context = getRequestContext(req);

      if (!userSub) {
        throw new BadRequestError("USER_SUB_MISSING");
      }

      const result = await this.userService.retryProvisioning(userSub, context);

      res.status(200).json(result);
    },
  );

  private getDashboardSummary = asyncWrapper(
    async (req: IAuthRequest, res: Response): Promise<Response | void> => {
      const userPublicId = req.user?.userId;

      if (!userPublicId) {
        throw new BadRequestError("USER_PUBLIC_ID_MISSING");
      }

      const result = await this.userService.getDashboardSummary(userPublicId);
      res.status(200).json({ ok: true, data: result });
    },
  );

  private getWallets = asyncWrapper(
    async (req: IAuthRequest, res: Response): Promise<Response | void> => {
      const userPublicId = req.user?.userId;

      if (!userPublicId) {
        throw new BadRequestError("USER_PUBLIC_ID_MISSING");
      }

      const result = await this.userService.getWallets(userPublicId);
      res.status(200).json({ ok: true, data: result });
    },
  );

  private getTransactions = asyncWrapper(
    async (req: IAuthRequest, res: Response): Promise<Response | void> => {
      const userPublicId = req.user?.userId;
      const { limit, page, direction, walletType, status } = req.query;

      if (!userPublicId) {
        throw new BadRequestError("USER_PUBLIC_ID_MISSING");
      }

      const result = await this.userService.getTransactions(userPublicId, {
        limit: limit ? parseInt(limit as string) : undefined,
        page: page ? parseInt(page as string) : undefined,
        direction: direction as "debit" | "credit" | undefined,
        walletType: walletType as string | undefined,
        status: status as string | undefined,
      });

      res.status(200).json({ ok: true, ...result });
    },
  );
}

export default UserController;
