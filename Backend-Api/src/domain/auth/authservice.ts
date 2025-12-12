import User from "@/domain/auth/authmodel"
import AuditLogger from "../audit/audit.service";
import { IRequestContext } from "@/interfaces/RequestContext";
import BadRequestError from "@/core/errors/badRequest";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "@/core/lib/token.helper";
import { redis } from "@/config/redis.cli";
import { deleteRefreshByHash, getLatestHashForDevice, getPayloadByRefreshToken, revokeAllSessions, revokeSession, storeRefreshToken } from "@/core/lib/session.Service";
import { hashToken } from "@/config/hashToken";


// Helperfunction: generate tokens and store them properly
export const issueTokensForUser = async (user: { _id: string; email: string; role: string }, deviceId: string) => {
    //ISSUE ACCESS TOKEN TO USER
    const accTk = await signAccessToken({ userId: user._id, email: user.email, role: user.role });

    //ISSUE REFRESH TOKEN TO USER
    const { token: refreshTokenRaw, payload } = await signRefreshToken(user._id, deviceId);

    // Store hashed refresh token and latest payload
    await storeRefreshToken(refreshTokenRaw, payload);

    return { accTk, refreshToken: refreshTokenRaw };
};


class userService {

    private userModel = User

    /**
   * Registers a new user
   * @param name User's name
   * @param email User email
   * @param password Plain text password
   * @param ip Optional IP for audit logging
   * @param userAgent Optional User-Agent for audit logging
   */

    public async Register(
        name: string,
        email: string,
        password: string,
        context: IRequestContext,
        deviceId: string
    ) {
        const alreadyExist = await this.userModel.findOne({ email })

        if (alreadyExist) {
            const UserId = alreadyExist._id.toString()
            await AuditLogger.logUserAction(context, "USER_REGISTER_ATTEMPT", "REGISTRATION_BLOCKED_ALREADY_EXISTS", UserId);
            throw new BadRequestError("User already Exist with that email")
        }

        const newUser = await this.userModel.create({
            name,
            email,
            password
        })

        const { accTk, refreshToken } = await issueTokensForUser(
            { _id: newUser._id.toString(), email: newUser.email, role: newUser.role },
            deviceId || context.userAgent
        );

        await AuditLogger.logUserAction(context, "USER_REGISTER_ATTEMPT", "REGISTRATION_SUCCESS", newUser._id.toString());

        return {
            user: newUser,
            accessToken: accTk,
            refreshToken: refreshToken
        }
    }

    public async login(email: string, password: string, context: IRequestContext, deviceId?: string) {
        const user = await this.userModel.findOne({ email })
        if (!user) {
            await AuditLogger.logUserAction(context, "USER_LOGIN_ATTEMPT", "LOGIN_FAILED_USER_NOT_FOUND");
            throw new BadRequestError("User not found")
        }
        const isPasswordValid = await user.comparePassword(password)
        if (!isPasswordValid) {
            await AuditLogger.logUserAction(context, "USER_LOGIN_ATTEMPT", "LOGIN_FAILED_WRONG_PASSWORD");
            throw new BadRequestError("Invalid password")
        }

        const { accTk, refreshToken } = await issueTokensForUser(
            { _id: user._id.toString(), email: user.email, role: user.role },
            deviceId || context.userAgent
        );

        await AuditLogger.logUserAction(context, "USER_LOGIN_ATTEMPT", "LOGIN_SUCCESS", user._id.toString());
        return this.createResponseDTO(user, accTk, refreshToken)

    }

    public async refreshToken(refreshToken: string, context: IRequestContext) {
        const verifiedToken = await verifyRefreshToken(refreshToken);

        const payloadFromJwt = verifiedToken as any;
        const storeedPayload = await getPayloadByRefreshToken(refreshToken)

        const lastestHash = await getLatestHashForDevice(payloadFromJwt.userId, payloadFromJwt.deviceId)
        const incomingHash = hashToken(refreshToken)

        if (!storeedPayload) {
            await revokeAllSessions(payloadFromJwt.userId)
            throw new BadRequestError("Refresh token revoked (possible reuse). Re-login required.")
        }

        if (lastestHash && incomingHash !== lastestHash) {
            await revokeAllSessions(payloadFromJwt.userId)
            throw new BadRequestError("Refresh token reuse detected. All sessions revoked.")
        }

        const { token: newRefreshRaw, payload: newPayload } = await signRefreshToken(payloadFromJwt.userId, payloadFromJwt.deviceId);
        const newAccess = await signAccessToken({ userId: payloadFromJwt.userId, email: (payloadFromJwt.email || ""), role: (payloadFromJwt.role || "") });

        await AuditLogger.logUserAction(context, "REFRESH_TOKEN_ATTEMPT", "REFRESH_TOKEN_SUCCESS", payloadFromJwt.userId);

        await storeRefreshToken(newRefreshRaw, newPayload)

        await deleteRefreshByHash(refreshToken);

        return this.createResponseDTO(payloadFromJwt.userId, newAccess, newRefreshRaw)

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

        await AuditLogger.logUserAction(context, "USER_LOGOUT", "COMPLETED", userId);

        return { ok: true };
    }

    public async logoutAll(userId: string, context: IRequestContext) {
        if (!userId) throw new BadRequestError("User ID required");

        await revokeAllSessions(userId);

        await AuditLogger.logUserAction(context, "USER_LOGOUT_ALL", "COMPLETED", userId);

        return { ok: true };
    }

}


export default userService; 
