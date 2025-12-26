import User from "./authmodel"
import AuditLogger from "../audit/audit.service";
import BadRequestError from "infrastructure/errors/badRequest";
import { issueTokensForUser, signAccessToken, signRefreshToken, verifyRefreshToken } from "infrastructure/lib/token.helper";
import { deleteRefreshByHash, getLatestHashForDevice, getPayloadByRefreshToken, revokeAllSessions, revokeSession, storeRefreshToken } from "infrastructure/lib/session.Service";
import { hashToken } from "@/config/hashToken";
import { produceUserCreatedEvent } from "@/kafka/producer/user.producer";
import { IRequestContext } from "@/config/interfaces/request.interface";
import { AuditAction, AuditStatus } from "../audit/audit.interface";
import { generateUserId } from "@/shared/utils/id.generator";
import { extractRequestContext } from "@/shared/middleware/request.context";


class userService {

    private userModel = User

    public async Register(
        name: string,
        email: string,
        password: string,
        context: IRequestContext,
    ) {

        const userId = generateUserId()

        const normalizedEmail = email.toLowerCase().trim();

        const alreadyExist = await this.userModel.findOne({ email: normalizedEmail })

        if (alreadyExist) {
            AuditLogger.logAttempt(context, AuditAction.USER_REGISTER_ATTEMPT, AuditStatus.FAILED, { email: normalizedEmail });
            throw new BadRequestError("User already Exist with that email")
        }

        const newUser = await this.userModel.create({
            userId,
            name,
            email: normalizedEmail,
            password
        })

        const { accTk, refreshToken } = await issueTokensForUser(
            { _id: newUser._id.toString(), userId: userId, email: newUser.email, role: newUser.role },
            context.deviceId || context.userAgent
        );

        //Fire User Created Event
        produceUserCreatedEvent({
            _id: newUser.userId,
            name: newUser.name,
            email: newUser.email,
            role: newUser.role,
            isEmailVerified: newUser.isEmailVerified
        });

        AuditLogger.logUserAction(context, AuditAction.USER_REGISTER_SUCCESS, AuditStatus.SUCCESS, newUser.userId);


        return {
            user: newUser.toJSON(),
            accessToken: accTk,
            refreshToken: refreshToken
        }
    }

    public async login(email: string, password: string, context: IRequestContext) {
        const user = await this.userModel.findOne({ email })
        if (!user) {
            AuditLogger.logUserAction(context, AuditAction.USER_LOGIN_ATTEMPT, AuditStatus.FAILED);
            throw new BadRequestError("User not found")
        }
        const isPasswordValid = await user.comparePassword(password)
        if (!isPasswordValid) {
            AuditLogger.logUserAction(context, AuditAction.USER_LOGIN_ATTEMPT, AuditStatus.FAILED);
            throw new BadRequestError("Invalid credentials")
        }

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
