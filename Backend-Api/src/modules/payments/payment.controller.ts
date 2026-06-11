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
import {
  paymentInitLimiters,
  paymentReferenceLimiter,
} from "@/infrastructure/helpers/ratelimiter";

class PaymentController implements Controller {
  public path = "/payments";
  public route = Router();
  private paymentService = new PaymentService();

  constructor() {
    this.initializeRoutes();
  }

  private initializeRoutes(): void {
    this.route.get(`${this.path}/callback`, this.handleCallback);

    this.route.post(
      `${this.path}/initialize`,
      requireAuth,
      //...paymentInitLimiters, // ← add after auth, before validation
      validateRequest(paymentValidation.initialize, "body"),
      this.initializePayment,
    );

    this.route.get(
      `${this.path}/:reference`,
      requireAuth,
      paymentReferenceLimiter, // ← add after auth, before validation
      this.getPaymentByReference,
    );

    this.route.get(
      `${this.path}`,
      requireAuth,
      paymentReferenceLimiter,
      this.listMyPayments,
    );
  }

  private handleCallback = asyncWrapper(
    async (req: IAuthRequest, res: Response) => {
      const { trxref, reference } = req.query;
      return res.redirect(
        `http://localhost:3002/?trxref=${trxref}&reference=${reference}#/dashboard`,
      );
    },
  );

  private initializePayment = asyncWrapper(
    async (req: IAuthRequest, res: Response) => {
      const ctx = getRequestContext(req);
      const userSub = req.user?.sub;
      const userId = req.user?.userId;

      const result = await this.paymentService.initializePayment({
        userSub,
        userId,
        ...req.body,
        context: ctx,
      });

      return res.status(StatusCodes.OK).json({ ok: true, data: result });
    },
  );

  private getPaymentByReference = asyncWrapper(
    async (req: IAuthRequest, res: Response) => {
      const userPublicId = req.user?.userPublicId;
      const payment = await this.paymentService.getInitializationByReference(
        req.params.reference,
      );

      // Authorization: user can only see their own payments
      if (payment.initiatedByUserPublicId !== userPublicId) {
        return res.status(StatusCodes.FORBIDDEN).json({ error: "FORBIDDEN" });
      }

      return res.status(StatusCodes.OK).json({ ok: true, data: payment });
    },
  );

  private listMyPayments = asyncWrapper(
    async (req: IAuthRequest, res: Response) => {
      const userPublicId = req.user?.userPublicId || req.user?.userId;
      const { status, limit, skip } = req.query;

      // Validate and parse limit
      let parsedLimit: number | undefined = undefined;
      if (limit !== undefined) {
        const limitNum = parseInt(limit as string, 10);
        if (!Number.isInteger(limitNum) || limitNum < 0) {
          return res.status(StatusCodes.BAD_REQUEST).json({
            error: "INVALID_LIMIT_PARAMETER",
            message: "limit must be a non-negative integer",
          });
        }
        parsedLimit = limitNum;
      }

      // Validate and parse skip
      let parsedSkip: number | undefined = undefined;
      if (skip !== undefined) {
        const skipNum = parseInt(skip as string, 10);
        if (!Number.isInteger(skipNum) || skipNum < 0) {
          return res.status(StatusCodes.BAD_REQUEST).json({
            error: "INVALID_SKIP_PARAMETER",
            message: "skip must be a non-negative integer",
          });
        }
        parsedSkip = skipNum;
      }

      const payments = await this.paymentService.listUserInitializations(
        userPublicId!,
        {
          status: status as PaymentInitializationStatus | undefined,
          limit: parsedLimit,
          skip: parsedSkip,
        },
      );

      return res.status(StatusCodes.OK).json({ ok: true, data: payments });
    },
  );
}

export default PaymentController;
