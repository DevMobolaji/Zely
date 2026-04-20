import Redis from 'ioredis';
import { config } from "@/config/index"
import { logger } from '@/shared/utils/logger';
import { withRedisBreaker } from '@/infrastructure/resilience/breakers/redis.breaker';


class RedisConnection {
    del(redisKey: string) {
        throw new Error("Method not implemented.");
    }
    private client: Redis | null;
    private isConnected: boolean;


    constructor() {
        this.client = null;
        this.isConnected = false;

    }

    //REDIS INSTANCE 
    private get redis(): Redis {
        if (!this.client) {
            throw new Error("Redis client not initialized. Call connect() first.");
        }
        return this.client;
    }

    /**
     * Setup Redis event listeners
     * SYSTEM DESIGN: Observability - know what's happening in your system
     */
    private setupEventListeners() {
        // Connection established
        this.redis.on('connect', () => {
            logger.info('🔗 Redis: Connection established');
        });

        // Connection ready (after auth, select db, etc.)
        this.redis.on('ready', () => {
            logger.info('✅ Redis: Ready to accept commands');
            this.isConnected = true;
        });

        // Error occurred
        this.redis.on('error', (err) => {
            logger.error('❌ Redis: Error:', err.message);
            this.isConnected = false;
        });

        // Connection closed
        this.redis.on('close', () => {
            logger.info('🔌 Redis: Connection closed');
            this.isConnected = false;
        });

        // Reconnecting
        this.redis.on('reconnecting', () => {
            logger.info('🔄 Redis: Attempting to reconnect...');
        });

        // Connection ended
        this.redis.on('end', () => {
            logger.info('⚠️  Redis: Connection ended');
            this.isConnected = false;
        });

        // Graceful shutdown
        //APP.JS HANDLES THIS NOW
        // process.on('SIGINT', async () => {
        //     logger.info('👋 Redis: Received SIGINT, shutting down gracefully...');
        //     await this.disconnect();
        //     process.exit(0);
        // });
    }

    public getClient() {
        if (!this.client) {
            throw new Error('Redis client not initialized. Call connect() first.');
        }
        return this.client;
    }

    async connect() {
        try {
            // Create Redis client with configuration
            this.client = new Redis({
                host: config.redis.host,
                port: config.redis.port,
                password: config.redis.password,
                db: config.redis.db,

                retryStrategy: (times) => {
                    const delay = Math.min(times * 50, 2000);
                    console.log(`⏳ Redis: Retry attempt ${times}, waiting ${delay}ms`);
                    return delay;
                },

                reconnectOnError: (err) => {
                    const targetErrors = ['READONLY', 'ECONNREFUSED'];
                    return targetErrors.some(targetError => err.message.includes(targetError));
                },
                maxRetriesPerRequest: config.redis.maxRetriesPerRequest,
                enableReadyCheck: config.redis.enableReadyCheck,
                enableOfflineQueue: config.redis.enableOfflineQueue,
                connectTimeout: 10000,
                keepAlive: 30000,
            });

            // Setup event listeners
            this.setupEventListeners();

            await new Promise((resolve, reject) => {
                this.redis.on('ready', resolve);
                this.redis.on('error', reject);

                // Timeout after 10 seconds
                setTimeout(() => reject(new Error('Redis connection timeout')), 10000);
            });
            this.isConnected = true;

            // Test connection
            await this.testConnection();

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            logger.error('❌ Redis: Connection failed:', errorMessage);
            throw error;
        }
    }

    async testConnection() {
        try {
            const result = await this.redis.ping();
            if (result === 'PONG') {
                logger.info('✅ Redis: Ping successful');
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            logger.error('❌ Redis: Ping failed:', errorMessage);
            throw error;
        }
    }

    /**
     * Set a value with optional TTL (Time To Live)
     * WHY TTL: Automatic cleanup of old data (sessions, cache)
     */

    async set(key: string, value: unknown, ttl?: number): Promise<boolean> {
        if (!key) throw new Error("Redis key must be a non-empty string");
        if (ttl !== undefined && (!Number.isInteger(ttl) || ttl < 0)) {
            throw new Error("TTL must be a non-negative integer");
        }

        const stringValue = typeof value === "string" ? value : JSON.stringify(value);

        return withRedisBreaker(
            async () => {
                if (ttl !== undefined) {
                    await this.redis.setex(key, ttl, stringValue);
                } else {
                    await this.redis.set(key, stringValue);
                }
                return true;
            },
            async () => {
                logger.warn("Redis circuit open — set operation skipped", { key });
                return false; // graceful degradation
            },
            `set:${key}`
        );
    }

    /**
     * Get a value by key
     */

    async get<T = unknown>(key: string, parseJson: boolean = true): Promise<T | string | null> {
        if (!key) throw new Error("Redis key must be a non-empty string");

        return withRedisBreaker(
            async () => {
                const value = await this.redis.get(key);
                if (value === null) return null;
                if (parseJson) {
                    try { return JSON.parse(value) as T; } catch { return value; }
                }
                return value;
            },
            async () => {
                logger.warn("Redis circuit open — get operation returning null", { key });
                return null; // graceful degradation
            },
            `get:${key}`
        ) as Promise<T | string | null>;
    }

    /**
     * Delete a key
     */
    async delete(key: string): Promise<number> {
        if (!key) throw new Error("Redis key must be a non-empty string");

        return withRedisBreaker(
            async () => this.redis.del(key),
            async () => {
                logger.warn("Redis circuit open — delete operation skipped", { key });
                return 0; // graceful degradation
            },
            `delete:${key}`
        );
    }

    /**
     * Check if key exists
     */
    async exists(key: string): Promise<boolean> {
        if (!key) throw new Error("Redis key must be a non-empty string");

        try {
            const result = await this.redis.exists(key);
            return result === 1;
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            logger.error('❌ Redis: Exists check failed:', errorMessage);
            throw error;
        }
    }

    /**
     * Set TTL on existing key
     * WHY: Extend or set expiration on cached data
     */
    async expire(key: string, seconds: number): Promise<number> {
        if (!key) throw new Error("Redis key must be a non-empty string");
        if (!Number.isInteger(seconds) || seconds < 0) throw new Error("TTL must be a non-negative integer");

        try {
            const result = await this.redis.expire(key, seconds);
            return result;
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            logger.error('❌ Redis: Expire operation failed:', errorMessage);
            throw error;
        }
    }

    /**
     * Increment a value (useful for counters, rate limiting)
     * WHY: Atomic operation - prevents race conditions
     */
    async increment(key: string, amount: number = 1): Promise<number> {
        if (!key) throw new Error("Redis key must be a non-empty string");
        if (!Number.isInteger(amount)) throw new Error("Increment amount must be an integer");

        try {
            const result = await this.redis.incrby(key, amount);
            // console.log(result ? `✅ Key "${key}" incremented` : `⚠️ Key "${key}" not found`);
            return result;
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            logger.error('❌ Redis: Increment operation failed:', errorMessage);
            throw error;
        }
    }
    /**
     * Get multiple keys at once
     * WHY: Reduces round trips to Redis
     */
    async mget<T = unknown>(keys: string[]): Promise<(T | null)[]> {
        try {
            const values = await this.redis.mget(keys);
            return values.map(value => {
                try {
                    return JSON.parse(value as string);
                } catch {
                    return value;
                }
            });
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            logger.error('❌ Redis: Mget operation failed:', errorMessage);
            throw error;
        }
    }

    /**
     * Flush specific database
     * WARNING: This deletes ALL keys! Use carefully!
     */
    async flush() {
        try {
            await this.redis.flushdb();
            console.log('🗑️  Redis: Database flushed');
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            logger.error('❌ Redis: Flush operation failed:', errorMessage);
            throw error;
        }
    }

    /**
     * Get Redis health status
     * WHY: Health check endpoint needs this
     */
    async getHealthStatus() {
        if (!this.client) {
            return { isConnected: false, error: "Redis client not initialized. Call connect() first." };
        }

        try {
            const info = await this.redis.info();
            return {
                isConnected: this.client.status,
                uptime: this.extractFromInfo(info, 'uptime_in_seconds'),
                // connectedClients: this.extractFromInfo(info, 'connected_clients'),
                // usedMemory: this.extractFromInfo(info, 'used_memory_human'),
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            return {
                isConnected: false,
                error: errorMessage,
            };
        }
    }

    /**
     * Extract value from Redis INFO output
     */
    private extractFromInfo(info: string, key: string): string {
        if (!info || !key) {
            return 'N/A';
        }

        const regex = new RegExp(`^${key}:(.+)$`, 'im'); // ^ and m for line start + case-insensitive
        const match = info.match(regex);
        return match ? match[1].trim() : 'N/A';
    }

    /**
     * Disconnect from Redis
     */
    async disconnect() {
        if (this.redis) {
            await this.redis.quit();
            logger.info('👋 Redis: Disconnected gracefully');
            this.isConnected = false;
        }
    }
}

// Export singleton instance
const redis = new RedisConnection();
export default redis
