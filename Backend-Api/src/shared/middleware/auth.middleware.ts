import { config } from "@/config/index";
import redis from "@/infrastructure/cache/redis.cli";
import {
  getLatestHashForDevice,
  isJtiBlacklisted,
} from "@/infrastructure/helpers/session.helper";
import { verifyAccessToken } from "@/infrastructure/helpers/token.helper";
import { UserRole } from "@/modules/auth/authinterface";
import { SessionModel } from "@/modules/sessions/session.model";
import UnauthenticatedError from "@/shared/errors/unaunthenticated";
import { logger } from "@/shared/utils/logger";
import { NextFunction, Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import User from "modules/auth/authmodel";
import { extractRequestContext } from "./request.context";

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

        // ─── Throttled verification against MongoDB ──────────────────────
        // Redis says valid, but Redis is a cache — confirm against source
        // of truth periodically rather than trusting indefinitely.
        const stillActive = await SessionModel.exists({
          userId: payload.sub,
          deviceId: payload.deviceId,
          isActive: true,
        });

        sessionValidated = !!stillActive;
      }
    } catch (redisErr) {
      redisAvailable = false;
      logger.warn(
        "Redis unavailable in auth middleware — falling back to MongoDB",
      );
    }

    // ADD THIS LINE
    logger.info("SESSION CHECK STATE", {
      sessionValidated,
      redisAvailable,
      sub: payload.sub,
      deviceId: payload.deviceId,
    });

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

      // ─── Rehydrate Redis — heal the cache for next request ────────────────
      // Best-effort only. If this fails, MongoDB fallback just runs again
      // next time. Never let rehydration failure block the actual request.
      try {
        const ttlSeconds = Math.max(
          Math.floor((session.expiresAt.getTime() - Date.now()) / 1000),
          0,
        );

        if (ttlSeconds > 0) {
          const latestKey = `${config.redis.sessionLatestPrefix}${payload.sub}:${payload.deviceId}`;
          await redis.getClient().set(latestKey, "1", "EX", ttlSeconds);

          const pwdVerKey = `${config.redis.pwdverPrefix}${payload.sub}`;
          await redis
            .getClient()
            .set(
              pwdVerKey,
              String(user.passwordVersion ?? 0),
              "EX",
              ttlSeconds,
            );

          logger.info("Redis rehydrated after MongoDB fallback", {
            sub: payload.sub,
            deviceId: payload.deviceId,
            ttlSeconds,
          });
        }
      } catch (rehydrateErr) {
        logger.warn(
          "Redis rehydration failed — non-fatal, will retry next request",
          {
            sub: payload.sub,
          },
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
