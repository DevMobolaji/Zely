import { v4 as uuidv4 } from "uuid";
import * as jwt from "jsonwebtoken"
import redis  from "@/infrastructure/cache/redis.cli"
import { hashToken } from "@/config/hashToken";
import Unauthorized from '../errors/unauthorized';
import { config } from "@/config/index";


type AccessPayload = {
    userId: string,
    email: string,
    role: string
}

type RefreshPayload = { userId: string; jti: string; deviceId: string };

const tokenConfig = {
    refreshToken: {
        maxAge: 7 * 24 * 60 * 60, // 7 days in seconds
        expiresIn: 7 * 24 * 60 * 60 // fallback also 7 days
    }
};


export const signAccessToken = async (payload: AccessPayload) => {
    const secret = config.jwt.accessSecret
    if (!secret) throw new Unauthorized("ACCESS_TOKEN_SECRET is not defined");

    return jwt.sign(payload, secret, {
        expiresIn: config.jwt.accessExpiry as jwt.SignOptions['expiresIn']
    })
}

export const signRefreshToken = async (userId: string, deviceId: string) => {

    const secret = config.jwt.refreshSecret;

    const jti = uuidv4();
    const payload: RefreshPayload = { userId, jti, deviceId };

    if (!secret) throw new Unauthorized("REFRESH_TOKEN_SECRET is not defined");
     const token = jwt.sign(payload, secret, {
        expiresIn: config.jwt.refreshExpiry as jwt.SignOptions['expiresIn']
    })

    return { token, payload };
}


export const verifyAccessToken = async (token: string): Promise<AccessPayload> => {
    return new Promise((resolve, reject) => {
        jwt.verify(token, config.jwt.accessSecret as jwt.Secret, (err, payload) => {
            if (err) return reject(err)

            resolve(payload as AccessPayload)
        })
    })
}



export const verifyRefreshToken = async (token: string) => {
    const h = hashToken(token);
    const data = await redis.get(`${config.redis.hashPrefix}${h}`);
    if (!data) throw new Unauthorized("Invalid refresh token");

    return jwt.verify(token, config.jwt.refreshSecret as jwt.Secret) as RefreshPayload

}


export function getRefreshCookieLifetimeMs() {
    const cfg = tokenConfig.refreshToken;
    const seconds = cfg.maxAge ?? cfg.expiresIn ?? 0;
    return seconds * 1000;
}



module.exports = {
    signAccessToken,
    signRefreshToken,
    verifyAccessToken,
    verifyRefreshToken,
    getRefreshCookieLifetimeMs
}