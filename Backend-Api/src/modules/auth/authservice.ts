import User from "./authmodel"
import AuditLogger from "../audit/audit.service";
import BadRequestError from "@/shared/errors/badRequest";
import {
    issueTokensForUser,
    signAccessToken,
    signRefreshToken,
    verifyRefreshToken
} from "@/infrastructure/helpers/token.helper";
import {
    deleteRefreshByHash,
    getLatestHashForDevice,
    getPayloadByRefreshToken,
    revokeAllSessions,
    revokeSession,
    storeRefreshToken
} from "@/infrastructure/helpers/session.Service";
import { hashToken } from "@/config/hashToken";
import { IRequestContext } from "@/config/interfaces/request.interface";
import { AuditAction, AuditStatus } from "../audit/audit.interface";
import { generateEventId, generateUserId } from "@/shared/utils/id.generator";
import mongoose, { Types } from "mongoose";
import { verifyPassword } from "@/config/password";
import { emitOutboxEvent, generateOTP, getLockTime, hashOtp, verifyOtp } from "@/infrastructure/helpers/emit.audit.helper";
import Unauthorized from "@/shared/errors/unauthorized";
import redis from "@/infrastructure/cache/redis.cli";
import { emailQueue } from "@/infrastructure/queues/email.queue";
import { accountStatus, UserStatus } from "./authinterface";
import { checkOtpRateLimit, checkResendRateLimit, resetOtpRateLimit } from "@/infrastructure/helpers/email.service.helper";
import { AccountStatus, assertValidTransition } from "@/infrastructure/helpers/domain.guard";


class userService {

    private userModel = User

    private createResponseDTO(user: any, accessToken: string, refreshToken: string) {
        return {
            user: user,
            accessToken: accessToken,
            refreshToken: refreshToken
        }
    }

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

        const EventId = generateEventId()

        try {
            const alreadyExist = await this.userModel.findOne({ email: normalizedEmail }).session(session)

            // Check if user already exists
            if (alreadyExist) {
                throw new BadRequestError("User already exists with that email")
            }

            const [newUser] = await this.userModel.create([{
                userId,
                name,
                email: normalizedEmail,
                password,
                isEmailVerified: UserStatus.PENDING
            }], { session })

            await emitOutboxEvent({
                eventId: EventId,
                eventType: "auth.user.register.success",
                action: AuditAction.USER_REGISTER_SUCCESS,
                status: AuditStatus.PENDING,
                payload: {
                    userId: newUser.userId,
                    email: newUser.email
                },
                aggregateType: "USER_REGISTER",
                aggregateId: newUser.userId,
                context
            }, { session });

            await session.commitTransaction();


            const { otp, expires } = generateOTP();
            const ttlInSeconds = Math.floor((expires.getTime() - Date.now()) / 1000);
            const hashedOtp = hashOtp(otp);
            const redisValue = JSON.stringify({
                hash: hashedOtp,
                userId: userId, // associate OTP with user
            });
            await redis.getClient().set(`email-otp:${normalizedEmail}`, redisValue, 'EX', ttlInSeconds);

            // Pass outboxId in job data, not in options
            await emailQueue.add('sendVerification', {
                email: normalizedEmail,
                name,
                otp,
                type: "VERIFICATION"
            });

            const { accTk, refreshToken } = await issueTokensForUser(
                { _id: newUser._id.toString(), userId: userId, email: newUser.email, role: newUser.role, deviceId: context.deviceId || context.userAgent },
            );

            AuditLogger.logUserAction(context, AuditAction.USER_REGISTER_SUCCESS, AuditStatus.SUCCESS, newUser.userId);


            return {
                user: newUser.toJSON(),
                accessToken: accTk,
                refreshToken: refreshToken
            }


        } catch (error) {
            if (session.inTransaction()) {
                await session.abortTransaction();
            }
            AuditLogger.logAttempt(context, AuditAction.USER_REGISTER_ATTEMPT, AuditStatus.FAILED, { email: normalizedEmail });
            throw error
        } finally {
            session.endSession();
        }
    }

    public async verifyEmail(
        email: string,
        otp: string,
        context: IRequestContext
    ) {
        const normalizedEmail = email.toLowerCase().trim();
        await checkOtpRateLimit(normalizedEmail);

        const eventId = generateEventId();
        const failedKey = `otp-failed:${normalizedEmail}`;

        // 1️⃣ Read OTP (NOT transactional — Redis)
        const raw = await redis.getClient().get(`email-otp:${normalizedEmail}`);
        if (!raw) {
            const alreadyFailed = await redis.get(failedKey);
            if (!alreadyFailed) {
                await emitOutboxEvent({
                    eventId,
                    eventType: "auth.email.verify.failed",
                    action: AuditAction.EMAIL_VERIFIED,
                    status: AuditStatus.FAILED,
                    payload: { reason: "OTP expired" },
                    aggregateType: "EMAIL_VERIFY",
                    aggregateId: normalizedEmail,
                    context,
                });
                await redis.getClient().set(failedKey, "1", "EX", 60);
            }
            throw new BadRequestError("Verification code expired.");
        }

        const { hash, userId } = JSON.parse(raw);

        const isOtpValid = await verifyOtp(otp, hash);
        if (!isOtpValid) {
            await emitOutboxEvent({
                eventId,
                eventType: "auth.email.verify.failed",
                action: AuditAction.EMAIL_VERIFIED,
                status: AuditStatus.FAILED,
                payload: { reason: "Invalid OTP" },
                aggregateType: "EMAIL_VERIFY_FAILED",
                aggregateId: userId,
                context,
            });
            throw new BadRequestError("Invalid or expired OTP.");
        }

        // 2️⃣ Transaction (MongoDB only)
        const session = await mongoose.startSession();
        try {
            let user;

            await session.withTransaction(async () => {
                user = await this.userModel.findOneAndUpdate(
                    {
                        userId,
                        accountStatus: { $in: [accountStatus.PENDING_EMAIL_VERIFICATION, accountStatus.EMAIL_VERIFIED] }
                    },
                    {
                        $set: {
                            accountStatus: accountStatus.EMAIL_VERIFIED,
                            isEmailVerified: UserStatus.VERIFIED,
                            emailVerifiedAt: new Date(),
                        },
                    },
                    { session, new: true }
                );

                if (!user) {
                    throw new BadRequestError("User not found or already verified.");
                }

                // transactional outbox
                await emitOutboxEvent(
                    {
                        eventId,
                        eventType: "auth.email.verify.success",
                        action: AuditAction.USER_VERIFY_EMAIL_SUCCESS,
                        status: AuditStatus.PENDING,
                        payload: {
                            userId: user.userId,
                            email: normalizedEmail,
                            name: user.name,
                        },
                        aggregateType: "USER",
                        aggregateId: user.userId,
                        context,
                    },
                    { session }
                );
            });

            // 3️⃣ Side-effects (AFTER commit)
            await resetOtpRateLimit(normalizedEmail);

            await emailQueue.add("sendWelcomeEmail", {
                email: normalizedEmail,
                name: user!.name,
                type: "WELCOME",
            });

            AuditLogger.logUserAction(
                context,
                AuditAction.USER_VERIFY_EMAIL_SUCCESS,
                AuditStatus.SUCCESS,
                user!.userId
            );

            await redis.delete(`email-otp:${normalizedEmail}`);
            await redis.delete(failedKey);

            return { message: "Email verified successfully." };
        } catch (error) {
            throw error;
        } finally {
            session.endSession();
        }
    }
      

    public async resendVerificationEmail(email: string, context: IRequestContext) {
        const normalizedEmail = email.toLowerCase().trim();

        const user = await this.userModel.findOne({ email });
        const EventId = generateEventId()

        if (!user || user.isEmailVerified === UserStatus.VERIFIED) {
            throw new BadRequestError("User not found or Email already verified");
        }

        await checkResendRateLimit(normalizedEmail);

        const { otp, expires } = generateOTP();
        const hashedOtp = hashOtp(otp);
        const ttlInSeconds = Math.floor((expires.getTime() - Date.now()) / 1000);


        await redis.getClient().set(`email-otp:${normalizedEmail}`, hashedOtp, 'EX', ttlInSeconds);

        emailQueue.add('sendVerification', {
            email: normalizedEmail,
            name: user.name,
            otp,
        });

        await emitOutboxEvent({
            eventId: EventId,
            eventType: "AUTH_EMAIL_RESEND",
            action: AuditAction.EMAIL_VERIFICATION_RESENT,
            status: AuditStatus.SUCCESS,
            payload: {
                userId: user.userId
            },
            aggregateType: "EMAIL_RESEND",
            aggregateId: user.userId,
            context,
        });

        return { message: "Verification email resent successfully" };
    }

    public async login(email: string, password: string, context: IRequestContext) {
        const user = await this.userModel.findOne({ email })
        const EventId = generateEventId()

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

            const lockDurationMs = getLockTime(failedAttempts);

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
                await emitOutboxEvent({
                    eventId: EventId,
                    eventType: "SECURITY",
                    action: AuditAction.ACCOUNT_LOCKED,
                    status: AuditStatus.SUCCESS,
                    payload: {
                        userId: user.userId,
                        reason: `Too many failed login attempts (${failedAttempts})`
                    },
                    aggregateType: "ACCOUNT_LOCKED",
                    aggregateId: user.userId,
                    context,
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


        await emitOutboxEvent({
            eventId: EventId,
            eventType: "AUTH_USER_LOGIN_SUCCESS",
            action: AuditAction.USER_LOGIN_SUCCESS,
            status: AuditStatus.SUCCESS,
            payload: {
                userId: user.userId,
            },
            aggregateType: "USER_LOGIN",
            aggregateId: user.userId,
            context
        })

        const { accTk, refreshToken } = await issueTokensForUser(
            { _id: user._id.toString(), userId: user.userId, email: user.email, role: user.role, deviceId: context.deviceId || context.userAgent },
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

        const { token: newRefreshRaw, payload: newPayload } = await signRefreshToken(user._id.toString(), payloadFromJwt.deviceId);
        const newAccess = await signAccessToken({ sub: user._id.toString(), userId: user.userId, email: user.email, role: user.role, deviceId: payloadFromJwt.deviceId });

        AuditLogger.logAttempt(context, AuditAction.REFRESH_TOKEN_SUCCESS, AuditStatus.SUCCESS, { email: user.email });

        await storeRefreshToken(newRefreshRaw, newPayload)

        await deleteRefreshByHash(refreshToken);

        return this.createResponseDTO(user._id.toString(), newAccess, newRefreshRaw)

    }

    public async logout(sub: string, deviceId: string | undefined, context: IRequestContext) {
        if (!sub && !deviceId) {
            throw new Unauthorized("Missing tokens");
        }
        if (deviceId) {
            await revokeSession(sub, deviceId);
        } else {
            // optional: revoke all devices
            await revokeAllSessions(sub);
        }

        await AuditLogger.logUserAction(context, AuditAction.USER_LOGOUT, AuditStatus.SUCCESS, sub);

        return { ok: true };
    }

    public async logoutAll(sub: string, context: IRequestContext) {
        if (!sub) throw new BadRequestError("User ID required");

        await revokeAllSessions(sub);

        await AuditLogger.logUserAction(context, AuditAction.USER_LOGOUT_ALL, AuditStatus.SUCCESS, sub);

        return { ok: true };
    }

    public async getUserById() {
        const user = await this.userModel.find()
        if (!user) throw new BadRequestError("Users not found");
        return user;
    }

}


export default userService; 
