import { hashToken } from "@/config/hashToken";
import redis from "../cache/redis.cli";
import { config } from "@/config/index";


const ttl = 14 * 24 * 60 * 60;

export const storeRefreshToken = async (rawToken: string, payload: { sub: string, jti: string, deviceId: string }) => {
    const h = hashToken(rawToken)
    const hashKey = `${config.redis.hashPrefix}${h}`;
    const latestKey = `${config.redis.latestPrefix}${payload.sub}:${payload.deviceId}`;
    const devicesKey = `${config.redis.userDevicesPrefix}${payload.sub}`;

    const pipeline = redis.getClient().pipeline();

    pipeline.set(hashKey, JSON.stringify(payload), "EX", ttl)
    pipeline.set(latestKey, h, "EX", ttl)
    pipeline.sadd(devicesKey, payload.deviceId)
    pipeline.expire(devicesKey, ttl)
    await pipeline.exec()
}

export const getPayloadByRefreshToken = async (rawToken: string) => {
    const h = hashToken(rawToken);

    const hashKey = `${config.redis.hashPrefix}${h}`;
    const data = await redis.get(hashKey);

    if (!data) return null;

    return data as { sub: string, jti: string, deviceId: string }
}

export const getLatestHashForDevice = async (sub: string, deviceId: string) => {
    const lastestKey = `${config.redis.latestPrefix}${sub}:${deviceId}`

    return await redis.get(lastestKey)
}

export const deleteRefreshByHash = async (rawToken: string) => {

    const h = hashToken(rawToken);

    const key = config.redis.hashPrefix + h;

    await redis.delete(key);

};


export const revokeAllSessions = async (sub: string) => {
    const devicesKey = `${config.redis.userDevicesPrefix}${sub}`

    const devicesId = await redis.getClient().smembers(devicesKey)
    const pipeline = redis.getClient().pipeline()

    for (const deviceId of devicesId) {
        const latestKey = `${config.redis.latestPrefix}${sub}:${deviceId}`;
        const h = await redis.get(latestKey);

        if (h) pipeline.del(config.redis.hashPrefix + h);
        pipeline.del(latestKey);
    }

    pipeline.del(devicesKey);

    await pipeline.exec();
}


// Revoke single device session
export const revokeSession = async (sub: string, deviceId: string) => {
    const latestKey = `${config.redis.latestPrefix}${sub}:${deviceId}`;
    const devicesKey = `${config.redis.userDevicesPrefix}${sub}`;

    if (!sub) {
        throw new Error("revokeSession called with undefined sub");
    }
    if (!deviceId) {
        throw new Error("revokeSession called with undefined deviceId");
      }

    const h = await redis.get(latestKey);

    const pipeline = redis.getClient().pipeline();

    if (h) pipeline.del(config.redis.hashPrefix + h);
    pipeline.del(latestKey);
    pipeline.srem(devicesKey, deviceId);
    pipeline.scard(devicesKey);

    await pipeline.exec();
};

