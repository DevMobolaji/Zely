// import { Request, Response, NextFunction } from "express";
// import { verifyAccessToken } from "@/infrastructure/helpers/token.helper";
// import UnauthenticatedError from "@/shared/errors/unaunthenticated";
// import User from "modules/auth/authmodel";
// import { extractRequestContext } from "./request.context";
// import {
//   getLatestHashForDevice,
//   isJtiBlacklisted,
// } from "@/infrastructure/helpers/session.helper";
// import Unauthorized from "../errors/unauthorized";
// import { UserRole } from "@/modules/auth/authinterface";
// import { StatusCodes } from "http-status-codes";
// import { SessionModel } from "@/modules/sessions/session.model";
// import { logger } from "@/shared/utils/logger";

// export interface AccessPayload {
//   userId: string;
//   email: string;
//   role: string;
//   deviceId: string;
//   iat?: number;
//   exp?: number;
//   sub: string;
//   jti: string;
//   passwordVersion: number;
// }

// export const requireAuth = async (
//   req: Request & { user?: any },
//   _res: Response,
//   next: NextFunction,
// ) => {
//   const header = req.headers.authorization;
//   if (!header?.startsWith("Bearer ")) {
//     return next(new UnauthenticatedError("Unauthorized"));
//   }

//   let token = header.substring(7).replace(/^'|'$/g, "").replace(/^"|"$/g, "");

//   try {
//     // 1. Verify JWT signature
//     const payload: AccessPayload = await verifyAccessToken(token);

//     // 2. Check JTI blacklist in Redis
//     try {
//       const blacklisted = await isJtiBlacklisted(payload.jti);
//       console.log("blacklisted, ", blacklisted);
//       if (blacklisted) {
//         return next(new UnauthenticatedError("Session terminated"));
//       }
//     } catch (redisErr) {
//       // Redis down — fall back to MongoDB session check only
//       logger.warn("Redis blacklist check failed, falling back to MongoDB", {
//         jti: payload.jti,
//       });

//       const session = await SessionModel.findOne({
//         userId: payload.sub,
//         deviceId: payload.deviceId,
//         isActive: true,
//         passwordVersion: payload.passwordVersion,
//       }).lean();

//       console.log("session, ", session);

//       if (!session) {
//         return next(new UnauthenticatedError("Session invalid"));
//       }

//       // Update lastUsedAt (fire and forget)
//       SessionModel.updateOne(
//         { userId: payload.sub, deviceId: payload.deviceId },
//         { $set: { lastUsedAt: new Date() } },
//       ).catch(() => {});

//       const userDoc = await User.findById(payload.sub)
//         .select("-password")
//         .exec();
//       if (!userDoc) return next(new UnauthenticatedError("Unauthorized"));

//       req.user = {
//         sub: userDoc._id.toString(),
//         userId: userDoc.userId,
//         email: userDoc.email,
//         role: userDoc.role,
//         deviceId: payload.deviceId,
//         jti: payload.jti,
//       };
//       req.context = extractRequestContext(req);
//       return next();
//     }

//     // 3. Check Redis session (existing flow)
//     const latestHash = await getLatestHashForDevice(
//       payload.sub,
//       payload.deviceId,
//     );
//     console.log("latest hash", latestHash);
//     if (!latestHash) {
//       // Redis miss — check MongoDB
//       const session = await SessionModel.findOne({
//         userId: payload.sub,
//         deviceId: payload.deviceId,
//         isActive: true,
//       }).lean();

//       if (!session) {
//         return next(new Unauthorized("Session expired / logged out"));
//       }

//       // Rehydrate Redis lazily
//       // (refresh token rehydration would happen on next refresh call)
//     }

//     // 4. Check passwordVersion
//     if (payload.passwordVersion !== undefined) {
//       const user = await User.findById(payload.sub)
//         .select("passwordVersion userId email role")
//         .lean();

//       if (!user) return next(new UnauthenticatedError("Unauthorized"));

//       if (user.passwordVersion !== payload.passwordVersion) {
//         return next(new Unauthorized("Password changed, please login again"));
//       }

//       // Update lastUsedAt (fire and forget)
//       SessionModel.updateOne(
//         { userId: payload.sub, deviceId: payload.deviceId },
//         { $set: { lastUsedAt: new Date() } },
//       ).catch(() => {});

//       req.user = {
//         sub: user._id?.toString() ?? payload.sub,
//         userId: user.userId,
//         email: user.email,
//         role: user.role,
//         deviceId: payload.deviceId,
//         jti: payload.jti,
//       };
//     } else {
//       // Old token without passwordVersion — still supported
//       const userDoc = await User.findById(payload.sub)
//         .select("-password")
//         .exec();
//       if (!userDoc) return next(new UnauthenticatedError("Unauthorized"));

//       req.user = {
//         sub: userDoc._id.toString(),
//         userId: userDoc.userId,
//         email: userDoc.email,
//         role: userDoc.role,
//         deviceId: payload.deviceId,
//         jti: payload.jti,
//       };
//     }

//     req.context = extractRequestContext(req);
//     next();
//   } catch (err) {
//     return next(new UnauthenticatedError("Unauthorized"));
//   }
// };

// export const isAdmin = async (
//   req: Request,
//   res: Response,
//   next: NextFunction,
// ) => {
//   const role = req.user?.role;

//   if (role !== UserRole.ADMIN) {
//     return res.status(StatusCodes.FORBIDDEN).json({ error: "ADMIN_ONLY" });
//   }
//   next();
// };

import { Request, Response, NextFunction } from "express";
import { verifyAccessToken } from "@/infrastructure/helpers/token.helper";
import UnauthenticatedError from "@/shared/errors/unaunthenticated";
import User from "modules/auth/authmodel";
import { extractRequestContext } from "./request.context";
import {
  getLatestHashForDevice,
  isJtiBlacklisted,
} from "@/infrastructure/helpers/session.helper";
import Unauthorized from "../errors/unauthorized";
import { UserRole } from "@/modules/auth/authinterface";
import { StatusCodes } from "http-status-codes";
import { SessionModel } from "@/modules/sessions/session.model";
import { logger } from "@/shared/utils/logger";
import redis from "@/infrastructure/cache/redis.cli";
import { config } from "@/config/index";

export interface AccessPayload {
  userId: string;
  email: string;
  role: string;
  deviceId: string;
  iat?: number;
  exp?: number;
  sub: string;
  jti: string;
  passwordVersion: number;
}

export const requireAuth = async (
  req: Request & { user?: any },
  _res: Response,
  next: NextFunction,
) => {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return next(new UnauthenticatedError("Unauthorized"));
  }

  const token = header.substring(7).replace(/^['"]|['"]$/g, "");

  try {
    // ─── 1. Verify JWT signature ─────────────────────────────────────────
    const payload: AccessPayload = await verifyAccessToken(token);
    const expectedPasswordVersion = payload.passwordVersion ?? 0;

    // ─── 2. Blacklist check — ALWAYS fail closed ─────────────────────────
    // Stolen/revoked tokens must never pass. If Redis is down for this
    // check, we block entirely. Security over availability here.
    try {
      if (payload.jti) {
        const blacklisted = await isJtiBlacklisted(payload.jti);
        if (blacklisted) {
          return next(new UnauthenticatedError("Session terminated"));
        }
      }
    } catch (blacklistErr) {
      logger.error(
        "Redis down — cannot verify JTI blacklist, blocking request",
        { userId: payload.sub, deviceId: payload.deviceId },
      );
      return next(new UnauthenticatedError("Auth service unavailable"));
    }

    // ─── 3. Session + password version — parallel Redis, fail open ───────
    // Both checks run simultaneously. If Redis is down, we fall through
    // to MongoDB. Session miss ≠ security breach, MongoDB covers it.
    let sessionValidated = false;
    let redisAvailable = true;

    try {
      const [latestHash, storedPwdVer] = await Promise.all([
        getLatestHashForDevice(payload.sub, payload.deviceId),
        redis.getClient().get(`${config.redis.pwdverPrefix}${payload.sub}`),
      ]);

      if (latestHash) {
        if (
          storedPwdVer !== null &&
          Number(storedPwdVer) !== expectedPasswordVersion
        ) {
          return next(
            new UnauthenticatedError("Password changed — please login again"),
          );
        }
        sessionValidated = true;
      }
    } catch (redisErr) {
      redisAvailable = false;
      logger.warn(
        "Redis unavailable in auth middleware — falling back to MongoDB",
        { userId: payload.sub, deviceId: payload.deviceId },
      );
    }

    // ─── 4. MongoDB fallback if Redis missed or is down ──────────────────
    // Keeps users authenticated during Redis outages.
    // Slower but correct. Platform stays up.
    if (!sessionValidated) {
      const [session, user] = await Promise.all([
        SessionModel.findOne({
          userId: payload.sub,
          deviceId: payload.deviceId,
          isActive: true,
          expiresAt: { $gt: new Date() },
        }).lean(),
        User.findById(payload.sub).select("passwordVersion").lean(),
      ]);

      if (!session) {
        return next(new UnauthenticatedError("Session expired or logged out"));
      }

      if (!user) {
        return next(new UnauthenticatedError("Unauthorized"));
      }

      if ((user.passwordVersion ?? 0) !== expectedPasswordVersion) {
        return next(
          new UnauthenticatedError("Password changed — please login again"),
        );
      }
    }

    // ─── 5. Throttled lastUsedAt — atomic Redis gate ─────────────────────
    // SET NX EX is atomic — no race condition possible.
    // Only one request per 5 minutes wins and writes to MongoDB.
    // If Redis is down, falls back to unconditional write.
    try {
      const throttleKey = `${config.redis.lastusedPrefix}${payload.sub}:${payload.deviceId}`;

      const acquired = await redis
        .getClient()
        .set(throttleKey, "1", "EX", 300, "NX");

      if (acquired === "OK") {
        SessionModel.updateOne(
          { userId: payload.sub, deviceId: payload.deviceId, isActive: true },
          { $set: { lastUsedAt: new Date() } },
        ).catch(() => {});
      }
    } catch (throttleErr) {
      SessionModel.updateOne(
        { userId: payload.sub, deviceId: payload.deviceId, isActive: true },
        { $set: { lastUsedAt: new Date() } },
      ).catch(() => {});
    }

    // ─── 6. Attach user from JWT claims — zero DB lookup ─────────────────
    // Identity is proven by the verified JWT signature.
    // Profile data fetched only at endpoints that actually need it.

    req.user = {
      sub: payload.sub,
      role: payload.role,
      deviceId: payload.deviceId,
      userId: payload.userId,
      email: payload.email,
      jti: payload.jti,
    };

    req.context = extractRequestContext(req);
    next();
  } catch (err) {
    return next(new UnauthenticatedError("Unauthorized"));
  }
};

export const isAdmin = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const role = req.user?.role;

  if (role !== UserRole.ADMIN) {
    return res.status(StatusCodes.FORBIDDEN).json({ error: "ADMIN_ONLY" });
  }
  next();
};
