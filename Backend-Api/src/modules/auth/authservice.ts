import { hashToken } from "@/config/hashToken";
import { IRequestContext } from "@/config/interfaces/request.interface";
import { hashedPassword, verifyPassword } from "@/config/password";
import {
  emitOutboxEvent,
  getLockTime,
} from "@/infrastructure/helpers/emit.audit.helper";
import {
  getLatestHashForDevice,
  revokeAllSessionsFull,
  revokeSessionFull,
  storeRefreshToken,
} from "@/infrastructure/helpers/session.helper";
import {
  createSession,
  issueTokensForUser,
  verifyRefreshToken,
} from "@/infrastructure/helpers/token.helper";
import BadRequestError from "@/shared/errors/badRequest";
import Unauthorized from "@/shared/errors/unauthorized";
import { generateEventId, generateUserId } from "@/shared/utils/id.generator";
import mongoose from "mongoose";
import { AuditAction, AuditStatus } from "../audit/audit.interface";
import AuditLogger from "../audit/audit.service";
import { accountStatus } from "./authinterface";
import User from "./authmodel";

import { deriveOutboxEventId } from "@/events/authProcessor.evt";
import { markOldTokenForDeletionAfter } from "@/infrastructure/helpers/markOld";
import OTPManager, { OTPPurpose } from "@/modules/helpers/otp.manager";
import { NotFoundError } from "@/shared/errors/notFoundError";
import {
  invalidateAllUsrSess,
  isPasswordInHistory,
  storeResetMetadata,
} from "../helpers/auth.helpers";

import { config } from "@/config/index";
import redis from "@/infrastructure/cache/redis.cli";
import { PasswordResetTokenModel } from "@/infrastructure/helpers/psdtoken.model";
import { parseUserAgent } from "@/modules/helpers/parser.agent";
import { NotificationType } from "@/modules/notification/notification.model";
import NotificationService from "@/modules/notification/notification.service";
import { SessionModel } from "@/modules/sessions/session.model";
import { logger } from "@/shared/utils/logger";
import crypto from "crypto";
import jwt from "jsonwebtoken";

class authService {
  private userModel = User;
  private otpManager = new OTPManager();
  private static readonly RESET_TOKEN_TTL_MS = 20 * 60 * 1000; // 20 min
  private notification = new NotificationService();

  private createResponseDTO(
    user: any,
    accessToken: string,
    refreshToken: string,
  ) {
    return {
      userId: user.userId,
      name: user.name,
      email: user.email,
      role: user.role,
      isEmailVerified: user.isEmailVerified,
      accessToken: accessToken,
      refreshToken: refreshToken,
    };
  }

  public async Register(
    name: string,
    email: string,
    password: string,
    context: IRequestContext,
  ) {
    const session = await mongoose.startSession();
    session.startTransaction();

    const userId = generateUserId();

    const normalizedEmail = email.toLowerCase().trim();

    const EventId = generateEventId();

    try {
      const alreadyExist = await this.userModel
        .findOne({ email: normalizedEmail })
        .session(session);

      // Check if user already exists
      if (alreadyExist) {
        throw new BadRequestError("User already exists with that email");
      }

      const [newUser] = await this.userModel.create(
        [
          {
            userId,
            name,
            email: normalizedEmail,
            password,
            isEmailVerified: false,
          },
        ],
        { session },
      );

      await emitOutboxEvent(
        {
          topic: "auth.events",
          eventId: deriveOutboxEventId(
            userId,
            "USER_REGISTERED_SUCCESS",
            EventId,
          ),
          eventType: AuditAction.USER_REGISTER_SUCCESS,
          action: AuditAction.USER_REGISTER_SUCCESS,
          status: AuditStatus.PENDING,
          payload: {
            userId: newUser.userId,
            email: newUser.email,
            name: newUser.name,
          },
          aggregateType: "USER_REGISTER",
          aggregateId: newUser.userId,
          version: 1,
          context,
        },
        { session },
      );

      await session.commitTransaction();

      AuditLogger.logUserAction(
        context,
        AuditAction.USER_REGISTER_SUCCESS,
        AuditStatus.SUCCESS,
        newUser.userId,
      );
    } catch (error) {
      if (session.inTransaction()) {
        await session.abortTransaction();
      }
      AuditLogger.logAttempt(
        context,
        AuditAction.USER_REGISTER_ATTEMPT,
        AuditStatus.FAILED,
        { email: normalizedEmail },
      );
      throw error;
    } finally {
      session.endSession();
    }
  }

  public async verifyEmail(
    email: string,
    otp: string,
    context: IRequestContext,
  ) {
    const normalizedEmail = email.toLowerCase().trim();
    // await checkOtpRateLimit(normalizedEmail);

    const eventId = generateEventId();

    // 1️⃣ Verify OTP in Redis (non-transactional)
    const verifyResult = await this.otpManager.verify(
      normalizedEmail,
      otp,
      OTPPurpose.EMAIL_VERIFICATION,
    );

    if (!verifyResult.success) {
      await emitOutboxEvent({
        topic: "auth.events",
        eventId,
        eventType: AuditAction.EMAIL_VERIFIED_FAILED,
        action: AuditAction.EMAIL_VERIFIED_FAILED,
        status: AuditStatus.FAILED,
        payload: { reason: verifyResult.message },
        aggregateType: "EMAIL_VERIFY",
        aggregateId: normalizedEmail,
        version: 1,
        context,
      });

      throw new BadRequestError(verifyResult.message);
    }

    // 2️⃣ Update user in MongoDB transaction
    const session = await mongoose.startSession();
    let user;
    try {
      await session.withTransaction(async () => {
        user = await this.userModel.findOneAndUpdate(
          {
            email: normalizedEmail,
            accountStatus: {
              $in: [
                accountStatus.PENDING_EMAIL_VERIFICATION,
                accountStatus.EMAIL_VERIFIED,
              ],
            },
          },
          {
            $set: {
              accountStatus: accountStatus.EMAIL_VERIFIED,
              isEmailVerified: true,
              emailVerifiedAt: new Date(),
            },
          },
          { session, new: true },
        );

        if (!user) {
          throw new BadRequestError("User not found or already verified.");
        }

        // transactional outbox event
        await emitOutboxEvent(
          {
            topic: "auth.events",
            eventId: deriveOutboxEventId(
              user.userId,
              "USER_EMAIL_VERIFIED_SUCCESS",
              eventId,
            ),
            eventType: AuditAction.USER_VERIFY_EMAIL_SUCCESS,
            action: AuditAction.USER_VERIFY_EMAIL_SUCCESS,
            status: AuditStatus.PENDING,
            payload: {
              userId: user.userId,
              email: normalizedEmail,
              name: user.name,
            },
            aggregateType: "USER",
            aggregateId: user.userId,
            version: 1,
            context,
          },
          { session },
        );
      });

      // 3️⃣ Side-effects after commit
      AuditLogger.logUserAction(
        context,
        AuditAction.USER_VERIFY_EMAIL_SUCCESS,
        AuditStatus.SUCCESS,
        user!.userId,
      );

      if (!context.deviceId) {
        throw new BadRequestError("Device ID required");
      }

      // ✅ Only issue tokens after email verification
      const { accTk, refreshToken, payload, jti, accessTokenExp } =
        await issueTokensForUser({
          _id: user!._id.toString(),
          userId: user!.userId,
          email: user!.email,
          role: user!.role,
          deviceId: context.deviceId, // hard error if missing — fix #8
          passwordVersion: user!.passwordVersion ?? 0,
          ipAddress: context.ip,
          userAgent: context.userAgent,
        });

      await createSession({
        user: {
          ...user!.toObject(),
          deviceId: context.deviceId,
          userAgent: context.userAgent,
          ipAddress: context.ip,
        },
        accessJti: jti,
        refreshTokenHash: hashToken(refreshToken),
        refreshJti: payload.jti,
        payload,
        accessTokenExpiresAt: new Date(accessTokenExp * 1000),
      });

      return {
        message: verifyResult.message,
        user: user!.toJSON(),
        accessToken: accTk,
        refreshToken: refreshToken,
      };
    } catch (error) {
      throw error;
    } finally {
      session.endSession();
    }
  }

  public async resendVerificationEmail(
    email: string,
    context: IRequestContext,
  ) {
    const normalizedEmail = email.toLowerCase().trim();

    const user = await this.userModel.findOne({ email: normalizedEmail });
    const EventId = generateEventId();

    if (!user || user.isEmailVerified) {
      return {
        message: "If the email exists, a verification email has been sent.",
      };
    }

    await emitOutboxEvent({
      topic: "auth.events",
      eventId: EventId,
      eventType: AuditAction.USER_EMAIL_RESEND_SUCCESS,
      action: AuditAction.USER_EMAIL_RESEND_SUCCESS,
      status: AuditStatus.PENDING,
      payload: {
        userId: user.userId,
        name: user.name,
        email: user.email,
      },
      aggregateType: "EMAIL_RESEND",
      aggregateId: user.userId,
      version: 1,
      context,
    });

    return { message: "Verification email resent successfully" };
  }

  public async login(
    email: string,
    password: string,
    context: IRequestContext,
  ) {
    const user = await this.userModel.findOne({ email });
    const EventId = generateEventId();

    if (!user) {
      AuditLogger.logAttempt(
        context,
        AuditAction.USER_LOGIN_ATTEMPT,
        AuditStatus.FAILED,
        { email },
      );
      throw new BadRequestError("Invalid credentials");
    }

    if (user.security.lockedUntil && user.security.lockedUntil > new Date()) {
      const lockedUntil = user.security.lockedUntil;
      const now = new Date();

      const diffMs = lockedUntil.getTime() - now.getTime();
      const diffMinutes = Math.ceil(diffMs / 60000);

      AuditLogger.logAttempt(
        context,
        AuditAction.USER_LOGIN_ATTEMPT,
        AuditStatus.BLOCKED,
        { email },
      );
      throw new BadRequestError(`Account locked until ${diffMinutes} minutes`);
    }

    const isPasswordValid = await verifyPassword(password, user.password);

    if (!isPasswordValid) {
      const failedAttempts = (user.security.failedLoginAttempts || 0) + 1;

      const lockDurationMs = getLockTime(failedAttempts);

      const wasLocked = Boolean(user.security.lockedUntil);
      const lockedUntil = lockDurationMs
        ? new Date(Date.now() + lockDurationMs)
        : null;
      const isNowLocked = Boolean(lockedUntil);

      await this.userModel.updateOne(
        { _id: user._id },
        {
          $inc: { "security.failedLoginAttempts": 1 },
          $set: {
            "security.lockedUntil": lockedUntil,
            "security.lastFailedAt": new Date(),
            "security.lockReason": lockedUntil
              ? `Too many failed attempts (${failedAttempts})`
              : null,
          },
        },
      );

      if (isNowLocked && !wasLocked) {
        await emitOutboxEvent({
          topic: "auth.account.locked",
          eventId: EventId,
          eventType: AuditAction.ACCOUNT_LOCKED,
          action: AuditAction.ACCOUNT_LOCKED,
          status: AuditStatus.SUCCESS,
          payload: {
            userId: user.userId,
            reason: `Too many failed login attempts (${failedAttempts})`,
          },
          aggregateType: "ACCOUNT_LOCKED",
          aggregateId: user.userId,
          version: 1,
          context,
        });
      }

      //SEND EMAIL OF ACCOUNT LOCKED DUE TO MANY ATTEMPTS

      AuditLogger.logAttempt(
        context,
        AuditAction.USER_LOGIN_ATTEMPT,
        AuditStatus.FAILED,
        { email },
      );
      throw new BadRequestError("Invalid credentials");
    }

    await this.userModel.updateOne(
      { _id: user._id },
      {
        $set: {
          "security.failedLoginAttempts": 0,
          "security.lockedUntil": null,
          "security.lockReason": null,
          "security.lastFailedAt": null,
        },
      },
    );

    await emitOutboxEvent({
      topic: "auth.user.login.success",
      eventId: EventId,
      eventType: "USER_LOGIN_SUCCESS",
      action: AuditAction.USER_LOGIN_SUCCESS,
      status: AuditStatus.SUCCESS,
      payload: {
        userId: user.userId,
      },
      aggregateType: "USER_LOGIN",
      aggregateId: user.userId,
      version: 1,
      context,
    });

    if (!context.deviceId) {
      throw new BadRequestError("Device ID required");
    }

    const { accTk, refreshToken, payload, hashRf, jti, accessTokenExp } =
      await issueTokensForUser({
        _id: user!._id.toString(),
        userId: user!.userId,
        email: user!.email,
        role: user!.role,
        deviceId: context.deviceId || context.userAgent,
        passwordVersion: user!.passwordVersion ?? 0,
        ipAddress: context.ip,
        userAgent: context.userAgent,
      });

    const sess = await createSession({
      user: {
        ...user.toObject(),
        deviceId: context.deviceId,
        userAgent: context.userAgent,
        ipAddress: context.ip,
      },
      accessJti: jti,
      refreshTokenHash: hashToken(refreshToken),
      refreshJti: payload.jti,
      payload,
      accessTokenExpiresAt: new Date(accessTokenExp * 1000),
    });

    if (!sess) throw new Error("SESSION_CREATION_FAILED");

    const existingDeviceSession = await SessionModel.findOne({
      userPublicId: user!.userId,
      deviceId: context.deviceId,
      isActive: true,
      sessionId: { $ne: sess }, // ← use sessionId field, not _id
    }).lean();

    if (!existingDeviceSession) {
      await this.notification.createAndEmit({
        userId: user!.userId,
        type: NotificationType.SECURITY,
        title: "New Login Detected",
        message: `New login from ${parseUserAgent(context.userAgent)} at ${context.ip}`,
        referenceId: `login:${sess}`,
      });
    }

    // Fire and forget — MongoDB is source of truth
    Promise.all([
      redis
        .getClient()
        .set(
          `${config.redis.sessionLatestPrefix}${user._id}:${context.deviceId}`,
          hashRf.toString(),
          "EX",
          60 * 60 * 24 * 7,
        ),
      redis
        .getClient()
        .set(
          `user:pwdver:${user._id}`,
          user.passwordVersion,
          "EX",
          60 * 60 * 24 * 7,
        ),
    ]).catch((err) =>
      logger.warn("Redis seed after login failed", {
        userId: user.userId,
        err,
      }),
    );

    AuditLogger.logUserAction(
      context,
      AuditAction.USER_LOGIN_SUCCESS,
      AuditStatus.SUCCESS,
      user.userId,
    );

    return this.createResponseDTO(user, accTk, refreshToken);
  }

  public async refreshToken(refreshToken: string, context: IRequestContext) {
    const { jwtPayload, storedPayload } =
      await verifyRefreshToken(refreshToken);

    const incomingHash = hashToken(refreshToken);
    // When issuing new tokens, mark the old hash as "rotated"
    // not just expired
    await redis.getClient().set(
      `rotated:${incomingHash}`,
      "1",
      "EX",
      30, // 30 second grace
    );
    const latestHash = await getLatestHashForDevice(
      jwtPayload.sub,
      jwtPayload.deviceId,
    );

    const GRACE_WINDOW_MS = 30_000;
    const tokenAge = Date.now() - (storedPayload.iat ?? 0) * 1000;

    if (incomingHash !== latestHash) {
      // Check if this is a known rotated token (legitimate race)
      const wasRotated = await redis.getClient().get(`rotated:${incomingHash}`);

      if (!wasRotated) {
        // Never seen this hash — genuine replay attempt
        await revokeAllSessionsFull(jwtPayload.sub);
        throw new Unauthorized("Refresh token reuse detected");
      }

      // Was legitimately rotated — reject gracefully without revoking
      throw new Unauthorized("Token already rotated, use new token");
    }

    const session = await SessionModel.findOne({
      userId: jwtPayload.sub,
      deviceId: jwtPayload.deviceId,
    }).lean();

    if (!session || !session.isActive) {
      throw new Unauthorized("Session has been revoked");
    }

    const user = await this.userModel.findById(jwtPayload.sub).exec();
    if (!user) throw new NotFoundError("User not found");

    const {
      accTk: newAccess,
      refreshToken: newRefresh,
      payload,
      jti,
      accessTokenExp,
    } = await issueTokensForUser({
      _id: user!._id.toString(),
      userId: user!.userId,
      email: user!.email,
      role: user!.role,
      deviceId: context.deviceId || context.userAgent,
      passwordVersion: user!.passwordVersion ?? 0,
      ipAddress: context.ip,
      userAgent: context.userAgent,
    });

    await SessionModel.updateOne(
      { userId: jwtPayload.sub, deviceId: jwtPayload.deviceId, isActive: true },
      {
        $set: {
          refreshTokenHash: hashToken(newRefresh),
          refreshTokenJti: payload.jti,
          accessTokenJti: jti,
          accessTokenExpiresAt: new Date(accessTokenExp * 1000),
          expiresAt: new Date(payload.exp * 1000),
          lastUsedAt: new Date(),
          passwordVersion: user.passwordVersion ?? 0, // ← add this
        },
      },
    );

    await storeRefreshToken(newRefresh, payload);
    await markOldTokenForDeletionAfter(refreshToken, GRACE_WINDOW_MS);
    //await deleteRefreshByHash(refreshToken);

    if (context) {
      context.userId = user.userId;
      context.email = user.email;
      context.deviceId = jwtPayload.deviceId;
    }

    AuditLogger.logUserAction(
      context,
      AuditAction.REFRESH_TOKEN_SUCCESS,
      AuditStatus.SUCCESS,
      user.userId,
    );

    return this.createResponseDTO(user, newAccess, newRefresh);
  }

  public async requestPasswordReset(email: string, context: IRequestContext) {
    const eventId = generateEventId();
    const normalizedEmail = email.toLowerCase().trim();
    const user = await this.userModel
      .findOne({ email: normalizedEmail })
      .exec();

    if (!user) {
      AuditLogger.logAttempt(
        context,
        AuditAction.FORGET_PASSWORD_ATTEMPT,
        AuditStatus.FAILED,
        { email },
      );
      return {
        success: true,
        message:
          "If an account exists with this email, a password reset code will be sent.",
      };
    }

    if (user.security.lockedUntil && user.security.lockedUntil > new Date()) {
      AuditLogger.logAttempt(
        context,
        AuditAction.FORGET_PASSWORD_ATTEMPT,
        AuditStatus.BLOCKED,
        { email },
      );
      const lockedUntil = user.security.lockedUntil;
      const minutesLeft = Math.ceil(
        (lockedUntil.getTime() - Date.now()) / 60000,
      );

      throw new BadRequestError(
        `Account temporarily locked. Please try again in ${minutesLeft} minute${minutesLeft === 1 ? "" : "s"}.`,
      );
    }

    // NOTE: throttling happens in the consumer when create() runs.
    // We can also do an early throttle check here for fast UX feedback,
    // but the consumer is the authoritative one.

    await storeResetMetadata(email, {
      ipAddress: context.ip,
      userAgent: context.userAgent,
      requestedAt: new Date(),
    });

    await User.updateOne(
      { email },
      {
        $inc: { passwordResetCount: 1 },
        lastPasswordResetAt: new Date(),
      },
    );

    // Emit event WITHOUT the code. Consumer generates it.
    await emitOutboxEvent({
      topic: "password.events",
      eventId,
      eventType: AuditAction.PASSWORD_RESET_REQUESTED,
      action: AuditAction.PASSWORD_RESET_REQUESTED,
      status: AuditStatus.PENDING,
      payload: {
        email: user.email,
        name: user.name,
        // no code here ✅
      },
      aggregateType: "PASSWORD_RESET_REQUESTED",
      aggregateId: email,
      version: 1,
      context,
    });

    await AuditLogger.logAttempt(
      context,
      AuditAction.FORGET_PASSWORD_ATTEMPT,
      AuditStatus.SUCCESS,
      { normalizedEmail },
    );

    return {
      success: true,
      message:
        "If an account exists with this email, a password reset code will be sent.",
    };
  }

  public async verifyResetCode(
    email: string,
    code: string,
    context: IRequestContext,
  ) {
    const eventId = generateEventId();
    const normalizedEmail = email.toLowerCase().trim();

    // 1. Verify the OTP
    const verifyResult = await this.otpManager.verify(
      normalizedEmail,
      code,
      OTPPurpose.PASSWORD_RESET,
    );

    if (!verifyResult.success) {
      AuditLogger.logAttempt(
        context,
        AuditAction.FORGET_PASSWORD_ATTEMPT,
        AuditStatus.FAILED,
        { email: normalizedEmail },
      );
      throw new BadRequestError(verifyResult.message);
    }

    // 2. Find user — needed for passwordVersion binding
    const user = await this.userModel
      .findOne({ email: normalizedEmail })
      .exec();
    if (!user) {
      // Defensive — shouldn't happen since OTP just verified
      throw new BadRequestError("User not found");
    }

    // 3. Generate JWT bound to user's current passwordVersion
    const jti = crypto.randomUUID();
    const issuedAt = new Date();
    const expiresAt = new Date(
      issuedAt.getTime() + authService.RESET_TOKEN_TTL_MS,
    );

    const resetToken = jwt.sign(
      {
        email: normalizedEmail,
        purpose: "password_reset",
        jti,
        pwdv: user.passwordVersion ?? 0,
      },
      config.jwt.resetSecret!,
      { expiresIn: "20m" },
    );

    // 4. Persist token state for replay prevention + audit
    await PasswordResetTokenModel.create({
      jti,
      identifier: normalizedEmail,
      issuedAt,
      expiresAt,
      consumedAt: null,
      ipAddress: context.ip,
      userAgent: context.userAgent,
    });

    // 5. Emit outbox event (no plaintext token — ever)
    await emitOutboxEvent({
      topic: "password.events",
      eventId,
      eventType: AuditAction.USER_PASSWORD_RESET_CODE_VERIFIED,
      action: AuditAction.USER_PASSWORD_RESET_CODE_VERIFIED,
      status: AuditStatus.PENDING,
      payload: {
        email: normalizedEmail,
      },
      aggregateType: "PASSWORD_RESET_CODE_VERIFIED",
      aggregateId: normalizedEmail,
      version: 1,
      context,
    });

    AuditLogger.logAttempt(
      context,
      AuditAction.FORGET_PASSWORD_ATTEMPT,
      AuditStatus.SUCCESS,
      { email: normalizedEmail },
    );

    return {
      success: true,
      message: "Code verified successfully",
      data: {
        resetToken, // returned in JSON body, never in URL
        expiresIn: 1200, // 20 min in seconds
      },
    };
  }

  public async resetPassword(
    email: string,
    token: string,
    newPassword: string,
    confirmPassword: string,
    context: IRequestContext,
  ) {
    const normalizedEmail = email.toLowerCase().trim();
    const eventId = generateEventId();
    const mongoSession = await mongoose.startSession();

    if (newPassword !== confirmPassword) {
      throw new BadRequestError("Passwords do not match");
    }

    // 2. Verify JWT signature + expiry
    let payload: any;
    try {
      payload = jwt.verify(token, config.jwt.resetSecret!);
    } catch (err) {
      throw new BadRequestError("Invalid or expired reset token");
    }

    if (payload.purpose !== "password_reset") {
      throw new BadRequestError("Invalid reset token");
    }

    // 3. Token must match the email being reset (defense against cross-account use)
    if (payload.email !== normalizedEmail) {
      throw new BadRequestError("Invalid reset token");
    }

    // 4. Find user — needed for passwordVersion check + history check
    const user = await this.userModel
      .findOne({ email: normalizedEmail })
      .select("+passwordHistory")
      .exec();

    if (!user) {
      throw new BadRequestError("User not found");
    }

    // 5. Verify token's passwordVersion matches user's current
    // (prevents using an old token after a successful reset has happened since)
    if ((user.passwordVersion ?? 0) !== payload.pwdv) {
      throw new BadRequestError("Reset token is no longer valid");
    }

    // 6. Password history check
    const isReused = await isPasswordInHistory(user, newPassword);
    if (isReused) {
      throw new BadRequestError("Password has been used before, cant reuse");
    }

    // 7. Atomic consume — prevents replay
    const tokenDoc = await PasswordResetTokenModel.findOneAndUpdate(
      { jti: payload.jti, consumedAt: null },
      {
        $set: {
          consumedAt: new Date(),
          ipAtConsume: context.ip,
          userAgentAtConsume: context.userAgent,
        },
      },
      { new: true },
    );

    if (!tokenDoc) {
      throw new BadRequestError("Reset token has already been used");
    }

    // 8. Soft device binding — log mismatches, don't block
    if (
      tokenDoc.ipAddress !== context.ip ||
      tokenDoc.userAgent !== context.userAgent
    ) {
      logger.warn("Password reset used from different device than issued", {
        email: normalizedEmail,
        jti: payload.jti,
        issuedFrom: { ip: tokenDoc.ipAddress, ua: tokenDoc.userAgent },
        usedFrom: { ip: context.ip, ua: context.userAgent },
      });
    }

    // 9. Hash and update — bumping passwordVersion invalidates all outstanding tokens
    const hashedPwd = await hashedPassword(newPassword);

    await mongoSession.withTransaction(async () => {
      await User.updateOne(
        { email: normalizedEmail },
        {
          $set: {
            password: hashedPwd,
            passwordChangedAt: new Date(),
            "security.failedLoginAttempts": 0,
            "security.lockedUntil": null,
            "security.lockReason": null,
          },
          $inc: { passwordVersion: 1 },
          $push: {
            passwordHistory: { $each: [hashedPwd], $slice: -5 },
          },
        },
        { session: mongoSession, runValidators: true },
      );

      // 11. Emit success event
      await emitOutboxEvent({
        topic: "password.events",
        eventId,
        eventType: AuditAction.PASSWORD_RESET_SUCCESS,
        action: AuditAction.PASSWORD_RESET_SUCCESS,
        status: AuditStatus.PENDING,
        payload: {
          email: normalizedEmail,
          name: user.name,
        },
        aggregateType: "PASSWORD_RESET_SUCCESS",
        aggregateId: normalizedEmail,
        version: 1,
        context,
      });
    });

    mongoSession.endSession();

    // 10. Side effects: invalidate sessions, kill any stray OTPs
    await invalidateAllUsrSess(user._id.toString());
    await redis
      .getClient()
      .del(`${config.redis.pwdverPrefix}${user._id.toString()}`);
    await this.otpManager.invalidate(
      normalizedEmail,
      OTPPurpose.PASSWORD_RESET,
    );

    AuditLogger.logUserAction(
      context,
      AuditAction.USER_PASSWORD_RESET,
      AuditStatus.SUCCESS,
      user._id.toString(),
    );

    return {
      success: true,
      message:
        "Password reset successful. Please login with your new password.",
    };
  }

  public async logout(cookie: string, context: IRequestContext) {
    const { jwtPayload } = await verifyRefreshToken(cookie);

    const sub = jwtPayload.sub;
    const deviceId = jwtPayload.deviceId;

    if (!sub) throw new Unauthorized("Missing subject");
    if (!deviceId) throw new Unauthorized("Missing device ID");

    if (context) {
      context.userId = jwtPayload.userId;
      context.email = jwtPayload.email;
      context.deviceId = jwtPayload.deviceId;
    }

    const session = await SessionModel.findOne({
      userId: sub,
      deviceId,
      isActive: true,
    }).lean();

    await revokeSessionFull(
      sub,
      deviceId,
      session?.accessTokenJti,
      session?.accessTokenExpiresAt,
    );

    await AuditLogger.logUserAction(
      context,
      AuditAction.USER_LOGOUT,
      AuditStatus.SUCCESS,
      jwtPayload.userId,
    );

    return { ok: true };
  }

  public async logoutAll(sub: string, context: IRequestContext) {
    if (!sub) throw new BadRequestError("User ID required");

    await revokeAllSessionsFull(sub);

    await AuditLogger.logUserAction(
      context,
      AuditAction.USER_LOGOUT_ALL,
      AuditStatus.SUCCESS,
      sub,
    );

    return { ok: true };
  }

  public async getUser(userId: string) {
    const user = await this.userModel.findOne({ userId }).select("-password");
    console.log(user);

    // const user = await User.findOne({ userId }).select("-password");

    if (!user) throw new BadRequestError("Users not found");
    return user;
  }
}

export default authService;
