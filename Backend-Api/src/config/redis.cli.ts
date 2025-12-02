// secure-redis.js
import Redis from "ioredis";

// Read password from environment variable
const redisPassword = process.env.REDIS_PASSWORD;

if (!redisPassword) {
    throw new Error("REDIS_PASSWORD environment variable is not set");
}

// Create Redis client
export const redis = new Redis({
    host: "127.0.0.1",
    port: 6379,
    password: redisPassword,
    maxRetriesPerRequest: null, // production-safe
    enableReadyCheck: true,
});

redis.on('connect', () => {
    console.log('Client connected to redis...')
})

redis.on('ready', () => {
    console.log('Client connected to redis and ready to use...')
})

redis.on('error', (err) => {
    console.log(err.message)
})

redis.on('end', () => {
    console.log('Client disconnected from redis')
})

process.on('SIGINT', () => {
    redis.quit()
})
