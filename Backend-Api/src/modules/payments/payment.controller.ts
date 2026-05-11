// src/modules/payments/payment.controller.ts
import { Response, Router } from "express";
import { StatusCodes } from "http-status-codes";
import asyncWrapper from "@/shared/middleware/async.wrapper";
import validateRequest from "@/shared/middleware/validation.middleware";
import { requireAuth } from "@/shared/middleware/auth.middleware";
import { getRequestContext } from "@/shared/middleware/request.context";
import Controller from "@/config/interfaces/controller.interfaces";
import { IAuthRequest } from "@/config/interfaces/request.interface";
import PaymentService from "./payment.service";
import paymentValidation from "./payment.validation";
import { PaymentInitializationStatus } from "./payment.initialization.model";

class PaymentController implements Controller {
  public path = "/payments";
  public route = Router();
  private paymentService = new PaymentService();

  constructor() {
    this.initializeRoutes();
  }

  private initializeRoutes(): void {
    this.route.post(
      `${this.path}/initialize`,
      requireAuth,
      validateRequest(paymentValidation.initialize, "body"),
      this.initializePayment
    );

    this.route.get(
      `${this.path}/:reference`,
      requireAuth,
      this.getPaymentByReference
    );

    this.route.get(
      `${this.path}`,
      requireAuth,
      this.listMyPayments
    );
  }

  private initializePayment = asyncWrapper(async (req: IAuthRequest, res: Response) => {
    const ctx = getRequestContext(req);
    const userSub = (req as any).user?.sub;
    const userId = (req as any).user?.userId;

    const result = await this.paymentService.initializePayment({
      userSub,
      userId,
      ...req.body,
      context: ctx,
    });

    return res.status(StatusCodes.OK).json({ ok: true, data: result });
  });

  private getPaymentByReference = asyncWrapper(async (req: IAuthRequest, res: Response) => {
    const userPublicId = (req as any).user?.userPublicId;
    const payment = await this.paymentService.getInitializationByReference(req.params.reference);

    // Authorization: user can only see their own payments
    if (payment.initiatedByUserPublicId !== userPublicId) {
      return res.status(StatusCodes.FORBIDDEN).json({ error: "FORBIDDEN" });
    }

    return res.status(StatusCodes.OK).json({ ok: true, data: payment });
  });

  private listMyPayments = asyncWrapper(async (req: IAuthRequest, res: Response) => {
    const userPublicId = (req as any).user?.userPublicId;
    const { status, limit, skip } = req.query;

    const payments = await this.paymentService.listUserInitializations(userPublicId, {
      status: status as PaymentInitializationStatus | undefined,
      limit: limit ? parseInt(limit as string, 10) : undefined,
      skip: skip ? parseInt(skip as string, 10) : undefined,
    });

    return res.status(StatusCodes.OK).json({ ok: true, data: payments });
  });
}

export default PaymentController;