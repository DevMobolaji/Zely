// src/shared/middleware/requireMinimumTier.ts
import { Response, NextFunction } from "express";
import { IAuthRequest } from "@/config/interfaces/request.interface";
import { KycTier } from "@/modules/transactionLimit/transaction.limit.model";
import User from "@/modules/auth/authmodel"
import { StatusCodes } from "http-status-codes";

const TIER_RANK: Record<KycTier, number> = {
  [KycTier.TIER_1]: 1,
  [KycTier.TIER_2]: 2,
  [KycTier.TIER_3]: 3,
};

export function requireMinimumTier(minTier: KycTier) {
  return async (req: IAuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).user?.userId ?? req.context?.userId;
      if (!userId) {
        return res.status(StatusCodes.UNAUTHORIZED).json({ error: "UNAUTHENTICATED" });
      }

      const user = await User.findOne({ userId }, { kycTier: 1 }).lean();
      if (!user) return res.status(StatusCodes.UNAUTHORIZED).json({ error: "USER_NOT_FOUND" });

      const currentTier = user.kycTier as KycTier | undefined;

      const userRank = currentTier ? TIER_RANK[currentTier] : TIER_RANK[KycTier.TIER_1];

      const requiredRank = TIER_RANK[minTier];

      if (!userRank) {
        return res.status(StatusCodes.FORBIDDEN).json({
          error: "INVALID_KYC_TIER",
        });
      }
      //const requiredRank = TIER_RANK[minTier];

      if (userRank < requiredRank) {
        return res.status(StatusCodes.FORBIDDEN).json({
          error: "INSUFFICIENT_KYC_TIER",
          requiredTier: minTier,
          currentTier: user.kycTier ?? KycTier.TIER_1,
        });
      }

      next();
    } catch (e) {
      next(e);
    }
  };
}