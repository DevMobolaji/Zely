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
} from "@/infrastructure/helpers/session.helper";
import { generateResetToken, hashToken } from "@/config/hashToken";
import { IRequestContext } from "@/config/interfaces/request.interface";
import { AuditAction, AuditStatus } from "../audit/audit.interface";
import { generateEventId, generateUserId } from "@/shared/utils/id.generator";
import mongoose from "mongoose";
import { hashedPassword, verifyPassword } from "@/config/password";
import { emitOutboxEvent, getLockTime } from "@/infrastructure/helpers/emit.audit.helper";
import Unauthorized from "@/shared/errors/unauthorized";
import redis from "@/infrastructure/cache/redis.cli";
import { emailQueue } from "@/infrastructure/queues/email.queue";
import { accountStatus } from "./authinterface";

import OTPManager, { OTPConfigs, OTPPurpose } from "@/config/otp.manager";
import { invalidateAllUsrSess, isPasswordInHistory, storeResetMetadata } from "../helpers/auth.helpers";
import { markOldTokenForDeletionAfter } from "@/infrastructure/helpers/markOld";
import { logger } from "@/shared/utils/logger";
import otpManager from "@/config/otp.manager";
import { NotFoundError } from "@/shared/errors/notFoundError";

class userService {

    private userModel = User
    private otpManager = new OTPManager(redis)

    private createResponseDTO(user: any, accessToken: string, refreshToken: string) {
        return {
            userId: user.userId,
            name: user.name,
            email: user.email,
            role: user.role,
            isEmailVerified: user.isEmailVerified,
            accessToken: accessToken,
            refreshToken: refreshToken,
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
                isEmailVerified: false
            }], { session })

            await emitOutboxEvent({
                topic: "auth.events",
                eventId: EventId,
                eventType: AuditAction.USER_REGISTER_SUCCESS,
                action: AuditAction.USER_REGISTER_SUCCESS,
                status: AuditStatus.PENDING,
                payload: {
                    userId: newUser.userId,
                    email: newUser.email,
                    name: newUser.name
                },
                aggregateType: "USER_REGISTER",
                aggregateId: newUser.userId,
                version: 1,
                context
            }, { session });

            await session.commitTransaction();

            AuditLogger.logUserAction(context, AuditAction.USER_REGISTER_SUCCESS, AuditStatus.SUCCESS, newUser.userId);

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
        // await checkOtpRateLimit(normalizedEmail);

        const eventId = generateEventId();

        // 1️⃣ Verify OTP in Redis (non-transactional)
        const verifyResult = await this.otpManager.verify(
            normalizedEmail,
            otp,
            OTPPurpose.EMAIL_VERIFICATION
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
                        accountStatus: { $in: [accountStatus.PENDING_EMAIL_VERIFICATION, accountStatus.EMAIL_VERIFIED] }
                    },
                    {
                        $set: {
                            accountStatus: accountStatus.EMAIL_VERIFIED,
                            isEmailVerified: true,
                            emailVerifiedAt: new Date(),
                        },
                    },
                    { session, new: true }
                );

                if (!user) {
                    throw new BadRequestError("User not found or already verified.");
                }

                // transactional outbox event
                await emitOutboxEvent(
                    {
                        topic: "auth.events",
                        eventId,
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
                    { session }
                );
            });

            // 3️⃣ Side-effects after commit
            AuditLogger.logUserAction(
                context,
                AuditAction.USER_VERIFY_EMAIL_SUCCESS,
                AuditStatus.SUCCESS,
                user!.userId
            );

            // ✅ Only issue tokens after email verification
            const { accTk, refreshToken } = await issueTokensForUser({
                _id: user!._id.toString(),
                userId: user!.userId,
                email: user!.email,
                role: user!.role,
                deviceId: context.deviceId || context.userAgent
            });

            return {
                message: verifyResult.message,
                user: user!.toJSON(),
                accessToken: accTk,
                refreshToken: refreshToken
            };
        } catch (error) {
            throw error;
        } finally {
            session.endSession();
        }

    }



    public async resendVerificationEmail(email: string, context: IRequestContext) {
        const normalizedEmail = email.toLowerCase().trim();

        const user = await this.userModel.findOne({ email: normalizedEmail });
        const EventId = generateEventId()

        if (!user || user.isEmailVerified) {
            return { message: "If the email exists, a verification email has been sent." };
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
                email: user.email
            },
            aggregateType: "EMAIL_RESEND",
            aggregateId: user.userId,
            version: 1,
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
            const lockedUntil = user.security.lockedUntil;
            const now = new Date();

            const diffMs = lockedUntil.getTime() - now.getTime();
            const diffMinutes = Math.ceil(diffMs / 60000);

            AuditLogger.logAttempt(context, AuditAction.USER_LOGIN_ATTEMPT, AuditStatus.BLOCKED, { email });
            throw new BadRequestError(`Account locked until ${diffMinutes} minutes`);
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
                    topic: "auth.account.locked",
                    eventId: EventId,
                    eventType: AuditAction.ACCOUNT_LOCKED,
                    action: AuditAction.ACCOUNT_LOCKED,
                    status: AuditStatus.SUCCESS,
                    payload: {
                        userId: user.userId,
                        reason: `Too many failed login attempts (${failedAttempts})`
                    },
                    aggregateType: "ACCOUNT_LOCKED",
                    aggregateId: user.userId,
                    version: 1,
                    context,
                });
            }

            //SEND EMAIL OF ACCOUNT LOCKED DUE TO MANY ATTEMPTS 

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
            context
        })

        const { accTk, refreshToken } = await issueTokensForUser(
            { _id: user._id.toString(), userId: user.userId, email: user.email, role: user.role, deviceId: context.deviceId || context.userAgent },
        );

        AuditLogger.logUserAction(context, AuditAction.USER_LOGIN_SUCCESS, AuditStatus.SUCCESS, user.userId);

        return this.createResponseDTO(user, accTk, refreshToken)
    }

    public async refreshToken(refreshToken: string, context: IRequestContext) {
        const { jwtPayload, storedPayload } =
            await verifyRefreshToken(refreshToken);

        const incomingHash = hashToken(refreshToken);
        const latestHash = await getLatestHashForDevice(
            jwtPayload.sub,
            jwtPayload.deviceId
        );

        const GRACE_WINDOW_MS = 30_000;
        const tokenAge = Date.now() - (storedPayload.iat ?? Date.now());

        if (latestHash && incomingHash !== latestHash && tokenAge > GRACE_WINDOW_MS) {
            await revokeAllSessions(jwtPayload.sub);
            throw new Unauthorized('Refresh token reuse detected');
        }

        const user = await this.userModel.findById(jwtPayload.sub).exec();
        if (!user) throw new NotFoundError('User not found');

        const { token: newRefresh, payload } =
            await signRefreshToken(
                user._id.toString(),
                user.userId,
                jwtPayload.deviceId,
                user.email
            );

        const newAccess = await signAccessToken({
            sub: user._id.toString(),
            userId: user.userId,
            email: user.email,
            role: user.role,
            deviceId: jwtPayload.deviceId
        });

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
            user.userId
        );

        return this.createResponseDTO(user, newAccess, newRefresh);
    }


    public async requestPasswordReset(email: string, context: IRequestContext) {
        const eventId = generateEventId();
        const normalizedEmail = email.toLowerCase().trim();
        const user = await this.userModel.findOne({ email: normalizedEmail }).exec();
        if (!user) {
            AuditLogger.logAttempt(context, AuditAction.FORGET_PASSWORD_ATTEMPT, AuditStatus.FAILED, { email });
            return {
                success: true,
                message: 'If an account exists with this email, a password reset code will be sent.'
            }
        }

        if (user.security.lockedUntil && user.security.lockedUntil > new Date()) {
            AuditLogger.logAttempt(context, AuditAction.FORGET_PASSWORD_ATTEMPT, AuditStatus.BLOCKED, { email });
            throw new BadRequestError(`Account locked until ${user.security.lockedUntil.toISOString()}`);
        }

        const throttle = await this.otpManager.shouldThrottle(email, OTPPurpose.PASSWORD_RESET, 120);

        if (throttle?.shouldThrottle) {
            // Only present to frontend, not DLQ or retry
            throw new BadRequestError(`Throttled: Please wait ${throttle.waitSeconds}s before requesting a new code`);

        }

        const { code, expiryMinutes } = await this.otpManager.create(
            email,
            OTPPurpose.PASSWORD_RESET,
            OTPConfigs.passwordReset
        );

        await storeResetMetadata(email, {
            ipAddress: context.ip,
            userAgent: context.userAgent,
            requestedAt: new Date()
        });

        await User.updateOne(
            { email },
            {
                $inc: { passwordResetCount: 1 },
                lastPasswordResetAt: new Date()
            }
        );

        await emitOutboxEvent(
            {
                topic: "password.events",
                eventId,
                eventType: AuditAction.PASSWORD_RESET_REQUESTED,
                action: AuditAction.PASSWORD_RESET_REQUESTED,
                status: AuditStatus.PENDING,
                payload: {
                    email: user.email,
                    name: user.name,
                    code: code,
                    expiryMinutes
                },
                aggregateType: "PASSWORD_RESET_REQUESTED",
                aggregateId: email,
                version: 1,
                context,
            },
        )

        await AuditLogger.logAttempt(context, AuditAction.FORGET_PASSWORD_ATTEMPT, AuditStatus.SUCCESS, { normalizedEmail });

        return {
            success: true,
            message: 'If an account exists with this email, a password reset code will be sent.'
        }
    }

    public async verifyResetCode(email: string, code: string, context: IRequestContext) {
        const eventId = generateEventId();

        const verifyResult = await this.otpManager.verify(
            email,
            code,
            OTPPurpose.PASSWORD_RESET
        )

        if (!verifyResult.success) {
            AuditLogger.logAttempt(context, AuditAction.FORGET_PASSWORD_ATTEMPT, AuditStatus.FAILED, { email });
            throw new BadRequestError(verifyResult.message);
        }

        const resetToken = await generateResetToken(email);

        // Store reset token in Redis (5 minute expiry)
        await redis.getClient().setex(
            `password_reset_token:${email}`,
            20 * 60,  // 5 minutes to complete reset
            JSON.stringify({
                resetToken,
                email,
                ipAddress: context.ip,
                userAgent: context.userAgent,
                verifiedAt: new Date()
            })
        );

        await emitOutboxEvent(
            {
                topic: "password.events",
                eventId,
                eventType: AuditAction.USER_PASSWORD_RESET_CODE_VERIFIED,
                action: AuditAction.USER_PASSWORD_RESET_CODE_VERIFIED,
                status: AuditStatus.PENDING,
                payload: {
                    email,
                },
                aggregateType: "PASSWORD_RESET_CODE_VERIFIED",
                aggregateId: email,
                version: 1,
                context,
            },
        )

        await AuditLogger.logAttempt(context, AuditAction.FORGET_PASSWORD_ATTEMPT, AuditStatus.SUCCESS, { email });

        return {
            success: true,
            message: 'Code verified successfully',
            data: {
                resetToken,  // Frontend uses this to reset password
                expiresIn: 300  // 5 minutes in seconds
            }
        }
    }

    public async resetPassword(email: string, token: string, newPassword: string, confirmPassword: string, context: IRequestContext) {
        const normalizedEmail = email.toLowerCase().trim();
        const eventId = generateEventId();
        const tokenKey = `password_reset_token:${normalizedEmail}`

        const pwdToken = await redis.getClient().get(tokenKey)

        if (!pwdToken) {
            throw new BadRequestError("Invalid or expired reset token")
        }

        const { resetToken, storedEmail } = JSON.parse(pwdToken);

        if (token !== resetToken) {
            throw new BadRequestError("Invalid or expired reset token")
        }

        if (newPassword !== confirmPassword) {
            throw new BadRequestError("Passwords do not match")
        }

        const user = await this.userModel.findOne({ storedEmail }).select("+passwordHistory").exec();
        if (!user) {
            throw new BadRequestError("User not found")
        }

        // const passwordStrength = this.checkPasswordStrength(newPassword);
        // if (!passwordStrength.isStrong) {
        //     res.status(400).json({
        //         success: false,
        //         error: {
        //             code: 'WEAK_PASSWORD',
        //             message: 'Password is too weak',
        //             details: passwordStrength.issues
        //         }
        //     });
        //     return;
        // }

        const isPasswordReused = await isPasswordInHistory(user, newPassword);
        console.log(user)
        console.log(isPasswordReused)
        if (isPasswordReused) {
            throw new BadRequestError("Password has been used before, cant reuse")
        }
        const hashedPwd = await hashedPassword(newPassword);
        console.log(hashedPwd)
        console.log(newPassword)

        await User.updateOne(
            { email },
            {
                password: hashedPwd,
                passwordChangedAt: new Date(),
                failedLoginAttempts: 0,
                accountLockedUntil: null,
                passwordResetCount: 0,
                $push: {
                    passwordHistory: {
                        $each: [hashedPwd],
                        $slice: -5
                    }
                }
            },
            { runValidators: true }
        );

        await invalidateAllUsrSess(email)

        await redis.getClient().del(`password_reset_token:${email}`);
        await redis.getClient().del(`password_reset_meta:${email}`);

        await this.otpManager.delete(email, OTPPurpose.PASSWORD_RESET);

        await redis.getClient().del(pwdToken);

        await emitOutboxEvent(
            {
                topic: "password.events",
                eventId,
                eventType: AuditAction.PASSWORD_RESET_SUCCESS,
                action: AuditAction.PASSWORD_RESET_SUCCESS,
                status: AuditStatus.PENDING,
                payload: {
                    email,
                    name: user.name,

                },
                aggregateType: "PASSWORD_RESET_SUCCESS",
                aggregateId: email,
                version: 1,
                context,
            },
        )

        await AuditLogger.logUserAction(context, AuditAction.USER_PASSWORD_RESET, AuditStatus.SUCCESS, user._id.toString());

        return {
            success: true,
            message: 'Password reset successful. Please login with your new password.',
        }
    }

    public async logout(cookie: string, context: IRequestContext) {
        const { jwtPayload } = await verifyRefreshToken(cookie);

        const sub = jwtPayload.sub;
        const deviceId = jwtPayload.deviceId;

        if (context) {
            context.userId = jwtPayload.userId;
            context.email = jwtPayload.email;
            context.deviceId = jwtPayload.deviceId;
        }

        if (!sub && !deviceId) {
            throw new Unauthorized("Missing tokens");
        }
        if (deviceId) {
            await revokeSession(sub, deviceId);
        } else {
            // optional: revoke all devices
            await revokeAllSessions(sub);
        }
        await AuditLogger.logUserAction(context, AuditAction.USER_LOGOUT, AuditStatus.SUCCESS, jwtPayload.userId);

        return { ok: true };
    }

    public async logoutAll(sub: string, context: IRequestContext) {
        if (!sub) throw new BadRequestError("User ID required");

        await revokeAllSessions(sub);

        await AuditLogger.logUserAction(context, AuditAction.USER_LOGOUT_ALL, AuditStatus.SUCCESS, sub);

        return { ok: true };
    }

    public async getUser() {
        const user = await this.userModel.find()
        if (!user) throw new BadRequestError("Users not found");
        return user;
    }

}


export default userService; 
