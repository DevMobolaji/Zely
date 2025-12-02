import User from "@/domain/auth/authmodel"
import AuditLogger from "../audit/audit.service";
import { IRequestContext } from "@/interfaces/RequestContext";
import BadRequestError from "@/core/errors/badRequest";
import { signAccessToken, signRefreshToken } from "@/core/lib/token";
import { redis } from "@/config/redis.cli";
import { storeRefreshToken } from "@/core/lib/session.Service";


// Helper: generate tokens and store them properly
export const issueTokensForUser = async (user: { _id: string; email: string; role: string }, deviceId: string) => {
    const accTk = await signAccessToken({ userId: user._id, email: user.email, role: user.role });
    const { token: refreshTokenRaw, payload } = await signRefreshToken(user._id, deviceId);

    // Store hashed refresh token and latest mapping
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
        await AuditLogger.logUserAction(context, "USER_REGISTER_ATTEMPT", "REGISTRATION_SUCCESS", newUser._id.toString());

        const { accTk, refreshToken } = await issueTokensForUser(
            { _id: newUser._id.toString(), email: newUser.email, role: newUser.role },
            deviceId || "default-device"
        );

        return {
            user: newUser,
            token: accTk,
            Rfshtoken: refreshToken
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
        await AuditLogger.logUserAction(context, "USER_LOGIN_ATTEMPT", "LOGIN_SUCCESS", user._id.toString());

        const { accTk, refreshToken } = await issueTokensForUser(
            { _id: user._id.toString(), email: user.email, role: user.role },
            deviceId || context.userAgent
        );

        return {
            user: user,
            token: accTk,
            Rfshtoken: refreshToken
        }
    }
}


export default userService; 
