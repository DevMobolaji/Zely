import { hashToken } from "@/config/hashToken";
import { config } from "@/config/index";
import { SessionModel } from "@/modules/sessions/session.model";
import BadRequestError from "@/shared/errors/badRequest";
import { logger } from "@/shared/utils/logger";
import { UAParser } from "ua-parser-js"; // npm install ua-parser-js
import { v4 as uuidv4 } from "uuid";
import redis from "../cache/redis.cli";

export const storeRefreshToken = async (
  rawToken: string,
  payload: {
    sub: string;
    jti: string;
    deviceId: string;
    iat: number;
    exp: number;
  },
): Promise<string> => {
  const h = hashToken(rawToken);
  const hashKey = `${config.redis.hashPrefix}${h}`;
  const latestKey = `${config.redis.latestPrefix}${payload.sub}:${payload.deviceId}`;
  const devicesKey = `${config.redis.userDevicesPrefix}${payload.sub}`;

  const now = Math.floor(Date.now() / 1000);
  const ttl = Math.max(Number(payload.exp) - now, 0);

  const pipeline = redis.getClient().pipeline();

  pipeline.set(hashKey, JSON.stringify(payload), "EX", ttl);
  pipeline.set(latestKey, h, "EX", ttl);
  pipeline.sadd(devicesKey, payload.deviceId);
  pipeline.expire(devicesKey, ttl);
  await pipeline.exec();

  return h;
};

export const getPayloadByRefreshToken = async (rawToken: string) => {
  const h = hashToken(rawToken);

  const hashKey = `${config.redis.hashPrefix}${h}`;
  const data = await redis.get(hashKey);

  if (!data) return null;

  return data as {
    sub: string;
    jti: string;
    deviceId: string;
    iat: number;
    exp: number;
  };
};

export const getLatestHashForDevice = async (sub: string, deviceId: string) => {
  const lastestKey = `${config.redis.latestPrefix}${sub}:${deviceId}`;

  return await redis.get(lastestKey);
};

export const deleteRefreshByHash = async (rawToken: string) => {
  const h = hashToken(rawToken);

  const key = config.redis.hashPrefix + h;

  await redis.delete(key);
};

export const revokeAllSessions = async (sub: string) => {
  const devicesKey = `${config.redis.userDevicesPrefix}${sub}`;

  const devicesId = await redis.getClient().smembers(devicesKey);
  const pipeline = redis.getClient().pipeline();

  for (const deviceId of devicesId) {
    const latestKey = `${config.redis.latestPrefix}${sub}:${deviceId}`;
    const h = await redis.get(latestKey);

    if (h) pipeline.del(config.redis.hashPrefix + h);
    pipeline.del(latestKey);
  }

  pipeline.del(devicesKey);

  await pipeline.exec();
};

// Revoke single device session
export const revokeSession = async (sub: string, deviceId: string) => {
  const latestKey = `${config.redis.latestPrefix}${sub}:${deviceId}`;
  const devicesKey = `${config.redis.userDevicesPrefix}${sub}`;

  if (!sub) {
    throw new BadRequestError("revokeSession called with undefined sub");
  }
  if (!deviceId) {
    throw new BadRequestError("revokeSession called with undefined deviceId");
  }

  const h = await redis.get(latestKey);

  const pipeline = redis.getClient().pipeline();

  if (h) pipeline.del(config.redis.hashPrefix + h);
  pipeline.del(latestKey);
  pipeline.srem(devicesKey, deviceId);
  pipeline.scard(devicesKey);

  await pipeline.exec();
};

// ─── Create MongoDB session ────────────────────────────────────────────────
export const createMongoSession = async (params: {
  userId: string;
  userPublicId: string;
  deviceId: string;
  userAgent: string;
  ipAddress: string;
  refreshTokenJti: string;
  accessTokenJti: string;
  passwordVersion: number;
  refreshTokenHash: string;
  expiresAt: Date;
  accessTokenExpiresAt: Date;
}) => {
  const parser = new UAParser(params.userAgent);
  const browser = parser.getBrowser().name ?? "Unknown";
  const os = parser.getOS().name ?? "Unknown";
  const deviceName = `${browser} on ${os}`;
  const sessionId = `SES_${uuidv4().replace(/-/g, "").substring(0, 16)}`;

  await SessionModel.findOneAndUpdate(
    { userId: params.userId, deviceId: params.deviceId },
    {
      $set: {
        userPublicId: params.userPublicId,
        deviceName,
        userAgent: params.userAgent,
        ipAddress: params.ipAddress,
        refreshTokenJti: params.refreshTokenJti,
        accessTokenJti: params.accessTokenJti,
        passwordVersion: params.passwordVersion,
        refreshTokenHash: params.refreshTokenHash,
        accessTokenExpiresAt: params.accessTokenExpiresAt,
        isActive: true,
        lastUsedAt: new Date(),
        expiresAt: params.expiresAt,
      },
      $setOnInsert: { sessionId },
    },
    { upsert: true, new: true },
  );

  return sessionId;
};

// ─── JTI Blacklist ────────────────────────────────────────────────────────
export const blacklistJti = async (
  jti: string,
  expiresAt: Date,
): Promise<void> => {
  const ttl = Math.max(
    Math.floor((expiresAt.getTime() - Date.now()) / 1000),
    0,
  );
  if (ttl > 0) {
    await redis
      .getClient()
      .setex(`${config.redis.blacklistPrefix}${jti}`, ttl, "1");
  }
};

export const isJtiBlacklisted = async (jti: string): Promise<boolean> => {
  const result = await redis.get(`${config.redis.blacklistPrefix}${jti}`);
  return result === "1";
};

// ─── Kill session (Redis + MongoDB) ───────────────────────────────────────
export const revokeSessionFull = async (
  sub: string,
  deviceId: string,
  accessTokenJti?: string,
  accessTokenExpiresAt?: Date,
) => {
  // Redis revoke (existing)
  await revokeSession(sub, deviceId);

  // MongoDB revoke (new)
  await SessionModel.updateOne(
    { userId: sub, deviceId },
    { $set: { isActive: false } },
  );

  // Blacklist access token if provided
  if (accessTokenJti && accessTokenExpiresAt) {
    await blacklistJti(accessTokenJti, accessTokenExpiresAt);
  }
};

// ─── Kill all sessions (Redis + MongoDB) ──────────────────────────────────
export const revokeAllSessionsFull = async (
  sub: string,
  excludeDeviceId?: string, // keep current device active
) => {
  // Get all active sessions from MongoDB
  const filter: any = { userId: sub, isActive: true };
  if (excludeDeviceId) filter.deviceId = { $ne: excludeDeviceId };

  const sessions = await SessionModel.find(filter).lean();

  // Blacklist all access JTIs
  const now = new Date();
  const blacklistPromises = sessions
    .filter((s) => s.accessTokenJti && s.accessTokenExpiresAt > now)
    .map((s) => blacklistJti(s.accessTokenJti, s.accessTokenExpiresAt));

  await Promise.all(blacklistPromises);

  // MongoDB: mark all inactive
  await SessionModel.updateMany(filter, { $set: { isActive: false } });

  // Redis: revoke all (existing)
  await revokeAllSessions(sub);
  if (excludeDeviceId) {
    const devicesKey = `${config.redis.userDevicesPrefix}${sub}`;
    await redis.getClient().sadd(devicesKey, excludeDeviceId);
  }
};

// ─── Get active sessions ──────────────────────────────────────────────────
export const getUserSessions = async (
  userPublicId: string,
  currentDeviceId: string,
) => {
  const sessions = await SessionModel.find({
    userPublicId,
    isActive: true,
    expiresAt: { $gt: new Date() },
  })
    .sort({ lastUsedAt: -1 })
    .lean();

  return sessions.map((s) => ({
    sessionId: s.sessionId,
    deviceName: s.deviceName,
    ipAddress: s.ipAddress,
    lastUsedAt: s.lastUsedAt,
    createdAt: s.createdAt,
    isCurrent: s.deviceId === currentDeviceId,
  }));
};

// ─── Redis reconnect → rehydrate blacklist ────────────────────────────────
export const rehydrateBlacklistOnRedisReconnect = async () => {
  logger.info("Redis reconnected — rehydrating JTI blacklist");

  const recentlyKilled = await SessionModel.find({
    isActive: false,
    updatedAt: { $gte: new Date(Date.now() - 15 * 60 * 1000) },
    accessTokenJti: { $exists: true },
    accessTokenExpiresAt: { $gt: new Date() },
  }).lean();

  for (const session of recentlyKilled) {
    await blacklistJti(session.accessTokenJti, session.accessTokenExpiresAt);
  }

  logger.info("JTI blacklist rehydration complete", {
    count: recentlyKilled.length,
  });
};
