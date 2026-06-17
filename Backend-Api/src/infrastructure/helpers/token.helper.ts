import { hashToken } from "@/config/hashToken";
import { config } from "@/config/index";
import { SessionModel } from "@/modules/sessions/session.model";
import UnauthenticatedError from "@/shared/errors/unaunthenticated";
import * as jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";
import Unauthorized from "../../shared/errors/unauthorized";
import {
  createMongoSession,
  deleteRefreshByHash,
  getPayloadByRefreshToken,
  storeRefreshToken,
} from "./session.helper";

interface AccessPayload {
  sub: string;
  userId: string;
  email: string;
  role: string;
  jti: string;
  deviceId: string;
  passwordVersion: number;
}

interface RefreshPayload {
  sub: string;
  jti: string;
  userId: string;
  deviceId: string;
  email: string;
}

interface StoredRefreshPayload {
  iat: number;
  exp: number;
}

export interface VerifiedRefreshToken {
  jwtPayload: RefreshPayload;
  storedPayload: StoredRefreshPayload;
}

const tokenConfig = {
  refreshToken: {
    maxAge: 7 * 24 * 60 * 60, // 7 days in seconds
    expiresIn: 7 * 24 * 60 * 60, // fallback also 7 days
  },
};

export const signAccessToken = async (
  payload: Omit<AccessPayload, "jti"> & { passwordVersion: number },
) => {
  const secret = config.jwt.accessSecret;
  if (!secret)
    throw new UnauthenticatedError("ACCESS_TOKEN_SECRET is not defined");

  const jti = uuidv4(); // unique ID for this specific token

  return {
    token: jwt.sign({ ...payload, jti }, secret, {
      expiresIn: config.jwt.accessExpiry as jwt.SignOptions["expiresIn"],
    }),
    jti,
  };
};

export const signRefreshToken = async (
  sub: string,
  userId: string,
  deviceId: string,
  email: string,
) => {
  const secret = config.jwt.refreshSecret;

  const jti = uuidv4();
  const payload: RefreshPayload = { sub, jti, userId, deviceId, email };

  if (!secret)
    throw new UnauthenticatedError("REFRESH_TOKEN_SECRET is not defined");
  const token = jwt.sign(payload, secret, {
    expiresIn: config.jwt.refreshExpiry as jwt.SignOptions["expiresIn"],
  });

  const decoded = jwt.decode(token) as RefreshPayload & {
    iat: number;
    exp: number;
  };

  return {
    token,
    payload: decoded, // Now includes iat and exp
  };
};

export const verifyAccessToken = async (
  token: string,
): Promise<AccessPayload> => {
  return new Promise((resolve, reject) => {
    try {
      jwt.verify(
        token,
        config.jwt.accessSecret as jwt.Secret,
        (err, payload) => {
          if (err) return reject(err);

          resolve(payload as AccessPayload);
        },
      );
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new UnauthenticatedError("Access token expired");
      }
      throw error;
    }
  });
};

export const verifyRefreshToken = async (
  token: string,
): Promise<VerifiedRefreshToken> => {
  let jwtPayload: RefreshPayload;

  try {
    jwtPayload = jwt.verify(
      token,
      config.jwt.refreshSecret as jwt.Secret,
    ) as RefreshPayload;
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      await deleteRefreshByHash(token);
      throw new UnauthenticatedError("Refresh token expired");
    }
    throw new Unauthorized("Invalid refresh token");
  }

  let storedPayload = await getPayloadByRefreshToken(token);

  if (!storedPayload) {
    const session = await SessionModel.findOne({
      refreshTokenHash: hashToken(token),
      isActive: true,
      expiresAt: { $gt: new Date() },
    }).lean();

    if (!session) {
      throw new Unauthorized("Refresh session revoked");
    }

    // rebuild payload
    storedPayload = {
      sub: session.userId,
      jti: session.refreshTokenJti,
      deviceId: session.deviceId,
      iat: Math.floor(session.createdAt.getTime() / 1000), // was updatedAt
      exp: Math.floor(session.expiresAt.getTime() / 1000),
    };

    await storeRefreshToken(token, storedPayload);
  }

  return {
    jwtPayload,
    storedPayload,
  };
};

export function getRefreshCookieLifetimeMs() {
  const cfg = tokenConfig.refreshToken;
  const seconds = cfg.maxAge ?? cfg.expiresIn ?? 0;
  return seconds * 1000;
}

export async function issueTokensForUser(user: {
  _id: string;
  userId: string;
  email: string;
  role: string;
  deviceId: string;
  passwordVersion: number;
  ipAddress?: string;
  userAgent?: string;
}) {
  //ISSUE ACCESS TOKEN TO USER
  const { token: accTk, jti } = await signAccessToken({
    sub: user._id.toString(),
    userId: user.userId,
    email: user.email,
    role: user.role,
    deviceId: user.deviceId,
    passwordVersion: user.passwordVersion,
  });

  //ISSUE REFRESH TOKEN TO USER
  const { token: refreshTokenRaw, payload } = await signRefreshToken(
    user._id.toString(),
    user.userId,
    user.deviceId,
    user.email,
  );

  const decoded = jwt.decode(accTk) as { exp: number };

  // Store hashed refresh token and latest payload
  const hashRf = await storeRefreshToken(refreshTokenRaw, payload);

  return {
    accTk,
    refreshToken: refreshTokenRaw,
    payload,
    jti,
    hashRf,
    accessTokenExp: decoded.exp,
  };
}

export const createSession = async ({
  user,
  accessJti,
  refreshTokenHash,
  refreshJti,
  payload,
  accessTokenExpiresAt,
}: {
  user: any;
  accessJti: string;
  refreshTokenHash: string;
  refreshJti: string;
  payload: any;
  accessTokenExpiresAt: Date;
}) => {
  return await createMongoSession({
    userId: user._id.toString(),
    userPublicId: user.userId,
    deviceId: user.deviceId,
    userAgent: user.userAgent || "",
    ipAddress: user.ipAddress || "",
    refreshTokenHash,
    refreshTokenJti: refreshJti,
    accessTokenJti: accessJti,
    passwordVersion: user.passwordVersion ?? 0,
    expiresAt: new Date(payload.exp * 1000),
    accessTokenExpiresAt,
  });
};

module.exports = {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  getRefreshCookieLifetimeMs,
  issueTokensForUser,
  createSession,
};
