import User from "./authmodel"
import AuditLogger from "../audit/audit.service";
import BadRequestError from "infrastructure/errors/badRequest";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "infrastructure/lib/token.helper";
import { deleteRefreshByHash, getLatestHashForDevice, getPayloadByRefreshToken, revokeAllSessions, revokeSession, storeRefreshToken } from "infrastructure/lib/session.Service";
import { hashToken } from "@/config/hashToken";
import { produceUserCreatedEvent } from "@/kafka/producer/user.producer";
import { IRequestContext } from "@/config/interfaces/request.interface";
import { AuditAction, AuditStatus } from "../audit/audit.interface";


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
            await AuditLogger.logUserAction(context, AuditAction.USER_REGISTER_ATTEMPT, AuditStatus.FAILED, UserId);
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

        //Fire User Created Event
        produceUserCreatedEvent({
            _id: newUser._id.toString(),
            name: newUser.name,
            email: newUser.email,
            role: newUser.role,
            isEmailVerified: newUser.isEmailVerified
        });

        await AuditLogger.logUserAction(context, AuditAction.USER_REGISTER_ATTEMPT, AuditStatus.SUCCESS, newUser._id.toString());

        context.userId = newUser._id.toString();

        return {
            user: newUser,
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
            { _id: user._id.toString(), email: user.email, role: user.role },
            context.deviceId || context.userAgent
        );

        AuditLogger.logUserAction(context, AuditAction.USER_LOGIN_ATTEMPT, AuditStatus.SUCCESS, user._id.toString());

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

        await AuditLogger.logUserAction(context, AuditAction.REFRESH_TOKEN_ATTEMPT, "REFRESH_TOKEN_SUCCESS", payloadFromJwt.userId);

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

    public async getUserById() {
        const user = await this.userModel.find()
        if (!user) throw new BadRequestError("Users not found");
        return user;
    }

}


export default userService; 
