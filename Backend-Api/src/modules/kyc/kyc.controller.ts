// src/modules/kyc/kyc.controller.ts
import { Response, Router } from "express";
import { StatusCodes } from "http-status-codes";
import asyncWrapper from "@/shared/middleware/async.wrapper";
import validateRequest from "@/shared/middleware/validation.middleware";
import { requireAuth } from "@/shared/middleware/auth.middleware";
import { getRequestContext } from "@/shared/middleware/request.context";
import Controller from "@/config/interfaces/controller.interfaces";
import { IAuthRequest } from "@/config/interfaces/request.interface";
import KycService from "./kyc.service";
import kycValidation from "./kyc.validation";
import { UserRole } from "../auth/authinterface";
import BadRequestError from "@/shared/errors/badRequest";

class KycController implements Controller {
  public path = "/kyc";
  public route = Router();
  private kycService = new KycService();

  constructor() {
    this.initializeRoutes();
  }

  private initializeRoutes(): void {
    // User endpoints
    this.route.post(
      `${this.path}/upgrade-to-tier-2`,
      requireAuth,
      validateRequest(kycValidation.submitTier2, "body"),
      this.submitTier2
    );
    this.route.post(
      `${this.path}/upgrade-to-tier-3`,
      requireAuth,
      validateRequest(kycValidation.submitTier3, "body"),
      this.submitTier3
    );
    this.route.get(`${this.path}/my-status`, requireAuth, this.getMyStatus);

    // Admin endpoints
    this.route.get(
      `/admin${this.path}/pending`,
      requireAuth,
      this.requireAdmin,
      this.listPending
    );
    this.route.get(
      `/admin${this.path}/:submissionId`,
      requireAuth,
      this.requireAdmin,
      this.getSubmission
    );
    this.route.post(
      `/admin${this.path}/:submissionId/approve`,
      requireAuth,
      this.requireAdmin,
      this.adminApprove
    );
    this.route.post(
      `/admin${this.path}/:submissionId/reject`,
      requireAuth,
      this.requireAdmin,
      validateRequest(kycValidation.adminReject, "body"),
      this.adminReject
    );
  }

  private requireAdmin = (req: IAuthRequest, res: Response, next: any) => {
    const role = (req as any).user?.role;
    if (role !== UserRole.ADMIN) {
      return res.status(StatusCodes.FORBIDDEN).json({ error: "ADMIN_ONLY" });
    }
    next();
  };

  private submitTier2 = asyncWrapper(async (req: IAuthRequest, res: Response) => {
    const ctx = getRequestContext(req);
    if (!ctx.userId) throw new BadRequestError("USER_NOT_AUTHENTICATED");
    const result = await this.kycService.submitForTier2(ctx.userId, req.body, ctx);
    return res.status(StatusCodes.CREATED).json({ ok: true, data: result });
  });

  private submitTier3 = asyncWrapper(async (req: IAuthRequest, res: Response) => {
    const ctx = getRequestContext(req);
    if (!ctx.userId) throw new BadRequestError("USER_NOT_AUTHENTICATED");
    const result = await this.kycService.submitForTier3(ctx.userId, req.body, ctx);
    return res.status(StatusCodes.CREATED).json({ ok: true, data: result });
  });

  private getMyStatus = asyncWrapper(async (req: IAuthRequest, res: Response) => {
    const ctx = getRequestContext(req);
    if (!ctx.userId) throw new BadRequestError("USER_NOT_AUTHENTICATED");
    const result = await this.kycService.getMyStatus(ctx.userId);
    return res.status(StatusCodes.OK).json({ ok: true, data: result });
  });

  private listPending = asyncWrapper(async (_req: IAuthRequest, res: Response) => {
    const result = await this.kycService.listPending();
    return res.status(StatusCodes.OK).json({ ok: true, data: result });
  });

  private getSubmission = asyncWrapper(async (req: IAuthRequest, res: Response) => {
    const result = await this.kycService.getSubmissionById(req.params.submissionId);
    return res.status(StatusCodes.OK).json({ ok: true, data: result });
  });

  private adminApprove = asyncWrapper(async (req: IAuthRequest, res: Response) => {
    const ctx = getRequestContext(req);
    const adminId = (req as any).user?.sub;
    const result = await this.kycService.adminApprove(req.params.submissionId, adminId, ctx);
    return res.status(StatusCodes.OK).json({ ok: true, data: result });
  });

  private adminReject = asyncWrapper(async (req: IAuthRequest, res: Response) => {
    const ctx = getRequestContext(req);
    const adminId = (req as any).user?.sub;
    const { reason } = req.body;
    const result = await this.kycService.adminReject(
      req.params.submissionId,
      adminId,
      reason,
      ctx
    );
    return res.status(StatusCodes.OK).json({ ok: true, data: result });
  });
}

export default KycController;