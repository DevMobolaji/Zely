import { v4 as uuidv4 } from "uuid";
import * as jwt from "jsonwebtoken"
import { redis } from '@/config/redis.cli'

require(
    'dotenv').config();
import { ACCESS_EXPIRES, ACCESS_SECRET, REFRESH_EXPIRES_SEC, REFRESH_SECRET } from "@/config/tokenConfig";

console.log(ACCESS_EXPIRES, ACCESS_SECRET, REFRESH_EXPIRES_SEC, REFRESH_SECRET)
type AccessPayload = {
    userId: string,
    email: string,
    role: string
}

type RefreshPayload = { userId: string; jti: string; deviceId: string };

export const signAccessToken = async (payload: AccessPayload) => {
    const secret = ACCESS_SECRET;
    if (!secret) throw new Error("ACCESS_TOKEN_SECRET is not defined");

    return jwt.sign(payload, secret, {
        expiresIn: ACCESS_EXPIRES as jwt.SignOptions['expiresIn']
    })
}

export const signRefreshToken = async (userId: string, deviceId: string) => {

    const secret = REFRESH_SECRET;

    const jti = uuidv4();
    const payload: RefreshPayload = { userId, jti, deviceId };

    if (!secret) throw new Error("REFRESH_TOKEN_SECRET is not defined");
     const token = jwt.sign(payload, secret, {
        expiresIn: REFRESH_EXPIRES_SEC as jwt.SignOptions['expiresIn']
    })

    return { token, payload };
}


export const verifyAccessToken = async (token: string): Promise<jwt.VerifyErrors | any> => {
    return new Promise((resolve, reject) => {
        jwt.verify(token, ACCESS_SECRET as jwt.Secret, (err, payload) => {
            if (err) return reject(err)

            resolve(payload as AccessPayload)
        })
    })
}


export const verifyRefreshToken = async (token: string) => {
    const storedUserId = await redis.get(`refresh:${token}`);
    if (!storedUserId) throw new Error("Invalid refresh token");

    return jwt.verify(token, REFRESH_SECRET as jwt.Secret) as RefreshPayload

}




module.exports = {
    signAccessToken,
    signRefreshToken,
    verifyAccessToken,
    verifyRefreshToken,
}