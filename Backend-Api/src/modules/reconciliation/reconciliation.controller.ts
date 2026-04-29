// src/modules/reconciliation/reconciliation.controller.ts
import { Response, Router } from "express";
import { StatusCodes } from "http-status-codes";
import asyncWrapper from "@/shared/middleware/async.wrapper";
import { requireAuth } from "@/shared/middleware/auth.middleware";
import { getRequestContext } from "@/shared/middleware/request.context";
import Controller from "@/config/interfaces/controller.interfaces";
import { IAuthRequest } from "@/config/interfaces/request.interface";
import ReconciliationService from "./reconciliation.service";
import { UserRole } from "@/modules/auth/authinterface";
import { ReconciliationStatus } from "./reconciliation.model";

class ReconciliationController implements Controller {
  public path = "/admin/reconciliation";
  public route = Router();
  private reconciliationService = new ReconciliationService();

  constructor() {
    this.initializeRoutes();
  }

  private initializeRoutes(): void {
    this.route.post(
      `${this.path}/run`,
      requireAuth,
      this.requireAdmin,
      this.runFullReconciliation
    );
    this.route.post(
      `${this.path}/account/:ledgerAccountId`,
      requireAuth,
      this.requireAdmin,
      this.runSingleAccount
    );
    this.route.get(
      `${this.path}/reports`,
      requireAuth,
      this.requireAdmin,
      this.listReports
    );
    this.route.get(
      `${this.path}/reports/:runId`,
      requireAuth,
      this.requireAdmin,
      this.getReport
    );
  }

  private requireAdmin = (req: IAuthRequest, res: Response, next: any) => {
    const role = (req as any).user?.role;
    if (role !== UserRole.ADMIN) {
      return res.status(StatusCodes.FORBIDDEN).json({ error: "ADMIN_ONLY" });
    }
    next();
  };

  private runFullReconciliation = asyncWrapper(async (req: IAuthRequest, res: Response) => {
    const ctx = getRequestContext(req);
    const result = await this.reconciliationService.reconcileAllAccounts(ctx, {
      triggeredBy: "MANUAL",
      freezeOnDrift: true,
    });
    return res.status(StatusCodes.OK).json({ ok: true, data: result });
  });

  private runSingleAccount = asyncWrapper(async (req: IAuthRequest, res: Response) => {
    const ctx = getRequestContext(req);
    const adminId = (req as any).user?.sub;
    const result = await this.reconciliationService.reconcileSingleAccount(
      req.params.ledgerAccountId,
      ctx,
      { triggeredByUserId: adminId, freezeOnDrift: true }
    );
    return res.status(StatusCodes.OK).json({ ok: true, data: result });
  });

  private listReports = asyncWrapper(async (req: IAuthRequest, res: Response) => {
    const { status, triggeredBy, onlyWithDrifts, limit, skip } = req.query;
    const reports = await this.reconciliationService.getReports({
      status: status as ReconciliationStatus | undefined,
      triggeredBy: triggeredBy as "SCHEDULED" | "MANUAL" | undefined,
      onlyWithDrifts: onlyWithDrifts === "true",
      limit: limit ? parseInt(limit as string, 10) : undefined,
      skip: skip ? parseInt(skip as string, 10) : undefined,
    });
    return res.status(StatusCodes.OK).json({ ok: true, data: reports });
  });

  private getReport = asyncWrapper(async (req: IAuthRequest, res: Response) => {
    const result = await this.reconciliationService.getReportById(req.params.runId);
    return res.status(StatusCodes.OK).json({ ok: true, data: result });
  });
}

export default ReconciliationController;