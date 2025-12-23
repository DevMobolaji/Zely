import { hashToken } from "@/config/hashToken";
import redis from "../cache/redis.cli";
import { config } from "@/config/index";


const ttl = 14 * 24 * 60 * 60;

export const storeRefreshToken = async (rawToken: string, payload: { userId: string, jti: string, deviceId: string }) => {
    const h = hashToken(rawToken)
    const hashKey = config.redis.hashPrefix + h;
    const lastestKey = `${config.redis.latestPrefix}${payload.userId}:${payload.deviceId}`

    const devicesKey = `${config.redis.devicesPrefix}${payload.userId}`;

    await redis.set(hashKey, JSON.stringify(payload), ttl)

    await redis.set(lastestKey, h, ttl)

    await redis.getClient().sadd(devicesKey, payload.deviceId);
    await redis.expire(devicesKey, ttl)
}

export const getPayloadByRefreshToken = async (rawToken: string) => {
    const h = hashToken(rawToken);

    const hashKey = config.redis.hashPrefix + h
    const data = await redis.get(hashKey);

    if (!data) return null;

    return data as { userId: string, jti: string, deviceId: string }
}

export const getLatestHashForDevice = async (userId: string, deviceId: string) => {
    const lastestKey = `${config.redis.latestPrefix}${userId}:${deviceId}`

    return await redis.get(lastestKey)
}

export const deleteRefreshByHash = async (rawToken: string) => {

    const h = hashToken(rawToken);

    const key = config.redis.hashPrefix + h;

    await redis.delete(key);

};


export const revokeAllSessions = async (userId: string) => {
    const devicesKey = `${config.redis.devicesPrefix}${userId}`

    const devicesId = await redis.getClient().smembers(devicesKey)
    const pipeline = redis.getClient().pipeline()

    for (const deviceId of devicesId) {
        pipeline.get(`${config.redis.latestPrefix}${userId}:${deviceId}`)
    }

    const results = await pipeline.exec();
    const hashes = results?.map(r => (r[1] as string)).filter(Boolean) || []

    const delPipeline = redis.getClient().pipeline();

    for (const h of hashes) delPipeline.del(config.redis.hashPrefix + h)
    for (const deviceId of devicesId) delPipeline.del(`${config.redis.latestPrefix}${userId}:${deviceId}`)

    delPipeline.del(devicesKey);
    await delPipeline.exec();
}


// Revoke single device session
export const revokeSession = async (userId: string, deviceId: string) => {
    const latestKey = `${config.redis.latestPrefix}${userId}:${deviceId}`;
    const h = await redis.get(latestKey);
    const pipeline = redis.getClient().pipeline();
    if (h) pipeline.del(config.redis.hashPrefix + h);
    pipeline.del(latestKey);
    pipeline.srem(`${config.redis.devicesPrefix}${userId}`, deviceId);
    await pipeline.exec();
};