import { Request, Response, Router } from "express";
import { StatusCodes } from "http-status-codes";
import asyncWrapper from "@/shared/middleware/async.wrapper";
import { requireAuth, isAdmin } from "@/shared/middleware/auth.middleware";
import {
  getUserSessions,
  revokeSessionFull,
  revokeAllSessionsFull,
  blacklistJti,
} from "@/infrastructure/helpers/session.helper";
import { SessionModel } from "./session.model";
import BadRequestError from "@/shared/errors/badRequest";
import { NotFoundError } from "@/shared/errors/notFoundError";
import { AuditAction, AuditStatus } from "@/modules/audit/audit.interface";
import { generateEventId } from "@/shared/utils/id.generator";
import { emitOutboxEvent } from "@/infrastructure/helpers/emit.audit.helper";

export class SessionController {
  public path = "/auth/sessions";
  public route = Router();

  constructor() {
    this.initializeRoutes();
  }

  private initializeRoutes() {
    // User — list their sessions
    this.route.get(this.path, requireAuth, this.listMySessions);

    // User — kill a specific session (not current)
    this.route.delete(`${this.path}/:sessionId`, requireAuth, this.killSession);

    // User — kill all OTHER sessions (keep current)
    this.route.delete(`${this.path}`, requireAuth, this.killOtherSessions);

    // Admin — kill ALL sessions for a user
    this.route.delete(
      `/admin/users/:userPublicId/sessions`,
      requireAuth,
      isAdmin,
      this.adminKillAllSessions,
    );
  }

  // ─── List active sessions ──────────────────────────────────────────────
  private listMySessions = asyncWrapper(async (req: Request, res: Response) => {
    const { userId, deviceId } = req.user!;

    const sessions = await getUserSessions(userId, deviceId);

    return res.status(StatusCodes.OK).json({ ok: true, data: sessions });
  });

  // ─── Kill a specific session ───────────────────────────────────────────
  private killSession = asyncWrapper(async (req: Request, res: Response) => {
    const { sessionId } = req.params;

    const { sub, deviceId: currentDeviceId } = req.user!;

    const session = await SessionModel.findOne({
      sessionId,
      userId: sub,
      isActive: true,
    }).lean();

    if (!session) throw new NotFoundError("Session not found");

    // Can't kill current session via this endpoint — use logout
    if (session.deviceId === currentDeviceId) {
      throw new BadRequestError("Use /auth/logout to end your current session");
    }

    await revokeSessionFull(
      sub,
      session.deviceId,
      session.accessTokenJti,
      session.accessTokenExpiresAt,
    );

    await emitOutboxEvent({
      topic: "auth.events",
      eventId: generateEventId(),
      eventType: AuditAction.USER_LOGOUT,
      action: AuditAction.USER_LOGOUT,
      status: AuditStatus.SUCCESS,
      payload: {
        userId: sub,
        killedSessionId: sessionId,
        killedDeviceId: session.deviceId,
      },
      aggregateType: "SESSION_KILL",
      aggregateId: sub,
      version: 1,
      context: req.context,
    });

    return res.status(StatusCodes.OK).json({
      ok: true,
      message: "Session terminated",
    });
  });

  // ─── Kill all other sessions ──────────────────────────────────────────
  private killOtherSessions = asyncWrapper(
    async (req: Request, res: Response) => {
      const { sub, deviceId: currentDeviceId } = req.user!;

      await revokeAllSessionsFull(sub, currentDeviceId);

      await emitOutboxEvent({
        topic: "auth.events",
        eventId: generateEventId(),
        eventType: AuditAction.USER_LOGOUT_ALL,
        action: AuditAction.USER_LOGOUT_ALL,
        status: AuditStatus.SUCCESS,
        payload: {
          userId: sub,
          keptDeviceId: currentDeviceId,
        },
        aggregateType: "SESSION_KILL_OTHERS",
        aggregateId: sub,
        version: 1,
        context: req.context,
      });

      return res.status(StatusCodes.OK).json({
        ok: true,
        message: "All other sessions terminated",
      });
    },
  );

  // ─── Admin kills all sessions for a user ──────────────────────────────
  private adminKillAllSessions = asyncWrapper(
    async (req: Request, res: Response) => {
      const { userPublicId } = req.params;

      const sessions = await SessionModel.find({
        userPublicId,
        isActive: true,
      }).lean();

      if (sessions.length === 0) {
        return res.status(StatusCodes.OK).json({
          ok: true,
          message: "No active sessions found",
        });
      }

      // Blacklist all access tokens immediately
      // const now = new Date();
      // for (const session of sessions) {
      //   if (session.accessTokenJti && session.accessTokenExpiresAt > now) {
      //     await blacklistJti(
      //       session.accessTokenJti,
      //       session.accessTokenExpiresAt,
      //     );
      //   }
      // }

      // Get userId from first session
      const userId = sessions[0].userId;

      // Revoke all in Redis + MongoDB
      await revokeAllSessionsFull(userId);

      // Emit audit event
      await emitOutboxEvent({
        topic: "auth.events",
        eventId: generateEventId(),
        eventType: AuditAction.USER_LOGOUT_ALL,
        action: AuditAction.USER_LOGOUT_ALL,
        status: AuditStatus.SUCCESS,
        payload: {
          targetUserPublicId: userPublicId,
          adminId: req.user?.userId,
          sessionsKilled: sessions.length,
        },
        aggregateType: "ADMIN_SESSION_KILL",
        aggregateId: userPublicId,
        version: 1,
        context: req.context,
      });

      return res.status(StatusCodes.OK).json({
        ok: true,
        message: `${sessions.length} session(s) terminated`,
      });
    },
  );
}
