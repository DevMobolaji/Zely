import User from "./authmodel"
import AuditLogger from "../audit/audit.service";
import BadRequestError from "@/shared/errors/badRequest";
import { issueTokensForUser, signAccessToken, signRefreshToken, verifyRefreshToken } from "@/infrastructure/helpers/token.helper";
import { deleteRefreshByHash, getLatestHashForDevice, getPayloadByRefreshToken, revokeAllSessions, revokeSession, storeRefreshToken } from "@/infrastructure/helpers/session.Service";
import { hashToken } from "@/config/hashToken";
import { IRequestContext } from "@/config/interfaces/request.interface";
import { AuditAction, AuditStatus } from "../audit/audit.interface";
import { generateUserId } from "@/shared/utils/id.generator";
import mongoose from "mongoose";
import { verifyPassword } from "@/config/password";
import emitAuditEvent from "@/infrastructure/helpers/emit.audit.helper";


class userService {

    private userModel = User

    public async Register(
        name: string,
        email: string,
        password: string,
        context: IRequestContext,
    ) {
        const session = await mongoose.startSession();
        session.startTransaction();

        const userId = generateUserId()

        const normalizedEmail = email.toLowerCase().trim();

        try {
            const alreadyExist = await this.userModel.findOne({ email: normalizedEmail })

            // Check if user already exists
            if (alreadyExist) {
                throw new BadRequestError("User already exists with that email")
            }

            const newUser = await this.userModel.create({
                userId,
                name,
                email: normalizedEmail,
                password
            })

            await emitAuditEvent({
                eventType: "AUTH_USER_REGISTER",
                action: AuditAction.USER_REGISTER_SUCCESS,
                status: AuditStatus.SUCCESS,
                userId: newUser.userId,
                context
            });

            await session.commitTransaction();

            session.endSession();

            const { accTk, refreshToken } = await issueTokensForUser(
                { _id: newUser._id.toString(), userId: userId, email: newUser.email, role: newUser.role },
                context.deviceId || context.userAgent
            );

            AuditLogger.logUserAction(context, AuditAction.USER_REGISTER_SUCCESS, AuditStatus.SUCCESS, newUser.userId);


            return {
                user: newUser.toJSON(),
                accessToken: accTk,
                refreshToken: refreshToken
            }


        } catch (error) {
            await session.abortTransaction();
            AuditLogger.logAttempt(context, AuditAction.USER_REGISTER_ATTEMPT, AuditStatus.FAILED, { email: normalizedEmail });
            throw error
        } finally {
            session.endSession();
        }
    }

    public async login(email: string, password: string, context: IRequestContext) {
        const user = await this.userModel.findOne({ email })

        if (!user) {
            AuditLogger.logAttempt(context, AuditAction.USER_LOGIN_ATTEMPT, AuditStatus.FAILED, { email });
            throw new BadRequestError("User not found")
        }

        if (user.security.lockedUntil && user.security.lockedUntil > new Date()) {
            AuditLogger.logAttempt(context, AuditAction.USER_LOGIN_ATTEMPT, AuditStatus.BLOCKED, { email });
            throw new BadRequestError(`Account locked until ${user.security.lockedUntil.toISOString()}`);
        }

        const isPasswordValid = await verifyPassword(password, user.password)

        if (!isPasswordValid) {
            const failedAttempts = (user.security.failedLoginAttempts || 0) + 1;

            let lockDurationMs = 0;
            if (failedAttempts >= 5) {
                if (failedAttempts === 5) lockDurationMs = 60_000;       // 1 min
                else if (failedAttempts <= 7) lockDurationMs = 5 * 60_000;  // 5 min
                else if (failedAttempts <= 9) lockDurationMs = 15 * 60_000; // 15 min
                else lockDurationMs = 60 * 60_000;                          // 1 hour
            }

            const wasLocked = Boolean(user.security.lockedUntil);
            const lockedUntil = lockDurationMs ? new Date(Date.now() + lockDurationMs) : null;
            const isNowLocked = Boolean(lockedUntil);

            await this.userModel.updateOne(
                { _id: user._id },
                {
                    $inc: { "security.failedLoginAttempts": 1 },
                    $set: {
                        "security.lockedUntil": lockedUntil,
                        "security.lastFailedAt": new Date(),
                        "security.lockReason": lockedUntil ? `Too many failed attempts (${failedAttempts})` : null
                    }
                }
            );

            if (isNowLocked && !wasLocked) {
                await emitAuditEvent({
                    eventType: "SECURITY",
                    action: AuditAction.ACCOUNT_LOCKED,
                    status: AuditStatus.SUCCESS,
                    userId: user.userId,
                    context,
                    reason: `Too many failed login attempts (${failedAttempts})`
                });
            }

            AuditLogger.logAttempt(context, AuditAction.USER_LOGIN_ATTEMPT, AuditStatus.FAILED, { email });
            throw new BadRequestError("Invalid credentials")
        }

        await this.userModel.updateOne(
            { _id: user._id },
            {
                $set: {
                    "security.failedLoginAttempts": 0,
                    "security.lockedUntil": null,
                    "security.lockReason": null,
                    "security.lastFailedAt": null
                }
            }
        );


        await emitAuditEvent({
            eventType: "AUTH_USER_LOGIN",
            action: AuditAction.USER_LOGIN_SUCCESS,
            status: AuditStatus.SUCCESS,
            userId: user.userId,
            context
        })

        const { accTk, refreshToken } = await issueTokensForUser(
            { _id: user._id.toString(), userId: user.userId, email: user.email, role: user.role },
            context.deviceId || context.userAgent
        );

        AuditLogger.logUserAction(context, AuditAction.USER_LOGIN_SUCCESS, AuditStatus.SUCCESS, user.userId);

        return this.createResponseDTO(user, accTk, refreshToken)
    }

    public async refreshToken(refreshToken: string, context: IRequestContext) {
        const verifiedToken = await verifyRefreshToken(refreshToken);

        const payloadFromJwt = verifiedToken as any;
        const storeedPayload = await getPayloadByRefreshToken(refreshToken)

        const lastestHash = await getLatestHashForDevice(payloadFromJwt.sub, payloadFromJwt.deviceId)
        const incomingHash = hashToken(refreshToken)

        if (!storeedPayload) {
            await revokeAllSessions(payloadFromJwt.sub)
            throw new BadRequestError("Refresh token revoked (possible reuse). Re-login required.")
        }

        if (lastestHash && incomingHash !== lastestHash) {
            await revokeAllSessions(payloadFromJwt.sub)
            throw new BadRequestError("Refresh token reuse detected. All sessions revoked.")
        }

        const user = await this.userModel.findById(payloadFromJwt.sub).select("_id userId email role").exec()
        if (!user) {
            throw new BadRequestError("User not found")
        }

        console.log(user)

        const { token: newRefreshRaw, payload: newPayload } = await signRefreshToken(user._id.toString(), payloadFromJwt.deviceId);
        const newAccess = await signAccessToken({ sub: user._id.toString(), userId: user.userId, email: user.email, role: user.role });

        AuditLogger.logAttempt(context, AuditAction.REFRESH_TOKEN_SUCCESS, AuditStatus.SUCCESS, { email: user.email });

        await storeRefreshToken(newRefreshRaw, newPayload)

        await deleteRefreshByHash(refreshToken);

        return this.createResponseDTO(user._id.toString(), newAccess, newRefreshRaw)

    }


    private createResponseDTO(user: any, accessToken: string, refreshToken: string) {
        return {
            user: user,
            accessToken: accessToken,
            refreshToken: refreshToken
        }
    }

    public async logout(userId: string, token: string, deviceId: string | undefined, context: IRequestContext) {

        if (!token) throw new BadRequestError("Refresh token required");

        // Delete the specific refresh token hash
        await deleteRefreshByHash(token);

        // Optionally delete device session record
        if (deviceId) {
            await revokeSession(userId, deviceId);
        }

        await AuditLogger.logUserAction(context, AuditAction.USER_LOGOUT, AuditStatus.SUCCESS, userId);

        return { ok: true };
    }

    public async logoutAll(userId: string, context: IRequestContext) {
        if (!userId) throw new BadRequestError("User ID required");

        await revokeAllSessions(userId);

        await AuditLogger.logUserAction(context, AuditAction.USER_LOGOUT_ALL, AuditStatus.SUCCESS, userId);

        return { ok: true };
    }

    public async getUserById() {
        const user = await this.userModel.find()
        if (!user) throw new BadRequestError("Users not found");
        return user;
    }

}


export default userService; 
