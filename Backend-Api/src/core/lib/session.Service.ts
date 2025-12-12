
import { redis } from "@/config/redis.cli";
import { hashToken } from "@/config/hashToken";
import { RedisKeys } from "@/config/tokenConfig";


const ttl = 14 * 24 * 60 * 60;

export const storeRefreshToken = async (rawToken: string, payload: {
    userId: string, jti: string, deviceId: string
}) => {
    const h = hashToken(rawToken)
    const hashKey = RedisKeys.HASH_PREFIX + h;
    const lastestKey = `${RedisKeys.LATEST_PREFIX}${payload.userId}:${payload.deviceId}`

    const devicesKey = `${RedisKeys.DEVICES_PREFIX}${payload.userId}`;

    await redis.set(hashKey, JSON.stringify(payload), "EX", ttl)

    await redis.set(lastestKey, h, "EX", ttl)

    await redis.sadd(devicesKey, payload.deviceId);
    await redis.expire(devicesKey, ttl)
}

export const getPayloadByRefreshToken = async (rawToken: string) => {
    const h = hashToken(rawToken);

    const hashKey = RedisKeys.HASH_PREFIX + h
    const data = await redis.get(hashKey);

    if (!data) return null;

    return JSON.parse(data) as { userId: string, jti: string, deviceId: string }
}

export const getLatestHashForDevice = async (userId: string, deviceId: string) => {
    const lastestKey = `${RedisKeys.LATEST_PREFIX}${userId}:${deviceId}`

    return await redis.get(lastestKey)
}

export const deleteRefreshByHash = async (rawToken: string) => {

    const h = hashToken(rawToken);

    const key = RedisKeys.HASH_PREFIX + h;

    await redis.del(key);

};


export const revokeAllSessions = async (userId: string) => {
    const devicesKey = `${RedisKeys.DEVICES_PREFIX}${userId}`

    const devicesId = await redis.smembers(devicesKey)
    const pipeline = redis.pipeline()

    for (const deviceId of devicesId) {
        pipeline.get(`${RedisKeys.LATEST_PREFIX}${userId}:${deviceId}`)
    }

    const results = await pipeline.exec();
    const hashes = results?.map(r => (r[1] as string)).filter(Boolean) || []

    const delPipeline = redis.pipeline();

    for (const h of hashes) delPipeline.del(RedisKeys.HASH_PREFIX + h)
    for (const deviceId of devicesId) delPipeline.del(`${RedisKeys.LATEST_PREFIX}${userId}:${deviceId}`)

    delPipeline.del(devicesKey);
    await delPipeline.exec();
}


// Revoke single device session
export const revokeSession = async (userId: string, deviceId: string) => {
    const latestKey = `${RedisKeys.LATEST_PREFIX}${userId}:${deviceId}`;
    const h = await redis.get(latestKey);
    const pipeline = redis.pipeline();
    if (h) pipeline.del(RedisKeys.HASH_PREFIX + h);
    pipeline.del(latestKey);
    pipeline.srem(`${RedisKeys.DEVICES_PREFIX}${userId}`, deviceId);
    await pipeline.exec();
};