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
}

export default UserController;
