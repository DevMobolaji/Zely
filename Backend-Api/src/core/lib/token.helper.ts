import dotenv from 'dotenv';
dotenv.config();

import { ACCESS_EXPIRES, ACCESS_SECRET, RedisKeys, REFRESH_EXPIRES_SEC, REFRESH_SECRET } from "@/config/tokenConfig";
import { v4 as uuidv4 } from "uuid";
import * as jwt from "jsonwebtoken"
import { redis } from '@/config/redis.cli'
import { hashToken } from "@/config/hashToken";
import BadRequestError from '../errors/badRequest';
import Unauthorized from '../errors/unauthorized';


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
    const secret = ACCESS_SECRET;
    if (!secret) throw new Unauthorized("ACCESS_TOKEN_SECRET is not defined");

    return jwt.sign(payload, secret, {
        expiresIn: ACCESS_EXPIRES as jwt.SignOptions['expiresIn']
    })
}

export const signRefreshToken = async (userId: string, deviceId: string) => {

    const secret = REFRESH_SECRET;

    const jti = uuidv4();
    const payload: RefreshPayload = { userId, jti, deviceId };

    if (!secret) throw new Unauthorized("REFRESH_TOKEN_SECRET is not defined");
     const token = jwt.sign(payload, secret, {
        expiresIn: REFRESH_EXPIRES_SEC as jwt.SignOptions['expiresIn']
    })

    return { token, payload };
}


export const verifyAccessToken = async (token: string): Promise<AccessPayload> => {
    return new Promise((resolve, reject) => {
        jwt.verify(token, ACCESS_SECRET as jwt.Secret, (err, payload) => {
            if (err) return reject(err)

            resolve(payload as AccessPayload)
        })
    })
}



export const verifyRefreshToken = async (token: string) => {
    const h = hashToken(token);
    const data = await redis.get(`${RedisKeys.HASH_PREFIX}${h}`);
    if (!data) throw new Unauthorized("Invalid refresh token");

    return jwt.verify(token, REFRESH_SECRET as jwt.Secret) as RefreshPayload

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