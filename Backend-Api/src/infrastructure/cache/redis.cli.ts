import Redis from "ioredis";
import { config } from "@/config/index";
import { logger } from "@/shared/utils/logger";
import { withRedisBreaker } from "@/infrastructure/resilience/breakers/redis.breaker";
import { rehydrateBlacklistOnRedisReconnect } from "@/infrastructure/helpers/session.helper";

class RedisConnection {
  private client: Redis | null = null;
  private isConnected: boolean = false;
  private reconnectAttempts: number = 0;
  private readonly MAX_RECONNECT_ATTEMPTS = 5;

  // ─────────────────────────────────────────────
  // CORE: Single entry point for all Redis ops
  // Circuit breaker + connection guard live here
  // ─────────────────────────────────────────────

  public async execute<T>(
    command: () => Promise<T>,
    fallback: () => Promise<T>,
    context?: string,
  ): Promise<T> {
    // client never initialized at all — skip breaker, nothing to count
    if (!this.client) {
      logger.warn("⚠️ Redis client not initialized — skipping to fallback", {
        context,
      });
      return fallback();
    }

    // client exists but may be disconnected
    // let withRedisBreaker handle it — so failures are counted and circuit can open
    return withRedisBreaker(
      async () => {
        // if client is not ready this will throw — breaker counts it
        if (this.client?.status !== "ready") {
          throw new Error(
            `Redis client not ready — status: ${this.client?.status}`,
          );
        }
        return command();
      },
      () => fallback(),
      context,
    );
  }

  // ─────────────────────────────────────────────
  // INTERNAL: Safe accessor for Redis client
  // ─────────────────────────────────────────────

  private get redis(): Redis {
    if (!this.client) {
      throw new Error("Redis client not initialized. Call connect() first.");
    }
    return this.client;
  }

  // ─────────────────────────────────────────────
  // CONNECTION
  // ─────────────────────────────────────────────

  async connect(): Promise<void> {
    try {
      this.client = new Redis({
        host: config.redis.host,
        port: config.redis.port,
        password: config.redis.password,
        db: config.redis.db,

        // Exponential backoff — stop after MAX_RECONNECT_ATTEMPTS
        retryStrategy: (times: number) => {
          const delay = Math.min(times * 500, 10000); // max 10s between retries
          logger.warn(`🔄 Redis: Reconnecting... attempt ${times}`, { delay });
          return delay; // never return null — always keep trying
        },

        reconnectOnError: (err) => {
          const targetErrors = ["READONLY", "ECONNREFUSED"];
          return targetErrors.some((e) => err.message.includes(e));
        },

        maxRetriesPerRequest: config.redis.maxRetriesPerRequest,
        enableReadyCheck: config.redis.enableReadyCheck,

        // CRITICAL: Reject commands immediately when disconnected
        // Do NOT queue them — in fintech we need the fallback to kick in instantly
        // not silently wait for Redis to come back
        enableOfflineQueue: false,

        connectTimeout: 10000,
        keepAlive: 30000,

        // App starts even if Redis is down
        // execute() handles unavailability gracefully
        lazyConnect: true,
      });

      this.setupEventListeners();

      // Attempt connection — but don't crash the app if it fails
      await this.client.connect().catch((err) => {
        logger.error(
          "❌ Redis: Initial connection failed — app will start in degraded mode",
          {
            message: err.message,
          },
        );
        // Not throwing here — execute() + circuit breaker handles fallbacks
      });

      if (this.isConnected) {
        await this.testConnection();
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error("❌ Redis: Unexpected error during connect:", errorMessage);
      // Still not throwing — degrade gracefully
    }
  }

  async testConnection(): Promise<void> {
    try {
      const result = await this.redis.ping();
      if (result === "PONG") {
        logger.info("✅ Redis: Ping successful");
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error("❌ Redis: Ping failed:", errorMessage);
      throw error;
    }
  }

  // ─────────────────────────────────────────────
  // EVENT LISTENERS
  // ─────────────────────────────────────────────

  private setupEventListeners(): void {
    this.redis.on("connect", () => {
      logger.info("🔗 Redis: Connection established");
    });

    this.redis.on("ready", () => {
      this.isConnected = true;
      this.reconnectAttempts = 0;
      logger.info("✅ Redis: Ready to accept commands");
    });

    this.redis.on("error", (err) => {
      // Do NOT throw here — throwing inside an event handler crashes the process
      // ioredis handles reconnection internally
      this.isConnected = false;
      logger.error("❌ Redis: Error:", err.message);
    });

    this.redis.on("close", () => {
      this.isConnected = false;
      logger.warn("🔌 Redis: Connection closed");
    });

    this.redis.on("reconnecting", () => {
      this.reconnectAttempts++;
      logger.warn(`🔄 Redis: Reconnecting...`, {
        attempt: this.reconnectAttempts,
      });
    });

    this.redis.on("end", () => {
      this.isConnected = false;
      logger.warn("⚠️ Redis: Connection ended");
    });

    this.redis.on("ready", async () => {
      await rehydrateBlacklistOnRedisReconnect().catch(logger.error);
    });
  }

  // ─────────────────────────────────────────────
  // OPERATIONS
  // All go through execute() — circuit breaker
  // is applied automatically, no exceptions
  // ─────────────────────────────────────────────

  async set(key: string, value: unknown, ttl?: number): Promise<boolean> {
    if (!key) throw new Error("Redis key must be a non-empty string");
    if (ttl !== undefined && (!Number.isInteger(ttl) || ttl < 0)) {
      throw new Error("TTL must be a non-negative integer");
    }

    const stringValue =
      typeof value === "string" ? value : JSON.stringify(value);

    return this.execute(
      async () => {
        if (ttl !== undefined) {
          await this.redis.setex(key, ttl, stringValue);
        } else {
          await this.redis.set(key, stringValue);
        }
        return true;
      },
      async () => {
        logger.warn("Redis unavailable — set operation skipped", { key });
        return false;
      },
      `set:${key}`,
    );
  }

  async get<T = unknown>(
    key: string,
    parseJson: boolean = true,
  ): Promise<T | string | null> {
    if (!key) throw new Error("Redis key must be a non-empty string");

    return this.execute(
      async () => {
        const value = await this.redis.get(key);
        if (value === null) return null;
        if (parseJson) {
          try {
            return JSON.parse(value) as T;
          } catch {
            return value;
          }
        }
        return value;
      },
      async () => {
        logger.warn("Redis unavailable — get returning null", { key });
        return null;
      },
      `get:${key}`,
    ) as Promise<T | string | null>;
  }

  async delete(key: string): Promise<number> {
    if (!key) throw new Error("Redis key must be a non-empty string");

    return this.execute(
      () => this.redis.del(key),
      async () => {
        logger.warn("Redis unavailable — delete skipped", { key });
        return 0;
      },
      `delete:${key}`,
    );
  }

  async exists(key: string): Promise<boolean> {
    if (!key) throw new Error("Redis key must be a non-empty string");

    return this.execute(
      async () => (await this.redis.exists(key)) === 1,
      async () => {
        logger.warn("Redis unavailable — exists returning false", { key });
        return false;
      },
      `exists:${key}`,
    );
  }

  async expire(key: string, seconds: number): Promise<number> {
    if (!key) throw new Error("Redis key must be a non-empty string");
    if (!Number.isInteger(seconds) || seconds < 0)
      throw new Error("TTL must be a non-negative integer");

    return this.execute(
      () => this.redis.expire(key, seconds),
      async () => {
        logger.warn("Redis unavailable — expire skipped", { key, seconds });
        return 0;
      },
      `expire:${key}`,
    );
  }

  async increment(key: string, amount: number = 1): Promise<number> {
    if (!key) throw new Error("Redis key must be a non-empty string");
    if (!Number.isInteger(amount))
      throw new Error("Increment amount must be an integer");

    return this.execute(
      () => this.redis.incrby(key, amount),
      async () => {
        // ⚠️ Never return 0 here
        // A silently reset counter = limit bypass = compliance breach
        logger.error(
          "Redis unavailable — increment rejected to prevent silent bypass",
          { key },
        );
        throw new Error("Redis unavailable — increment operation rejected");
      },
      `increment:${key}`,
    );
  }

  async mget<T = unknown>(keys: string[]): Promise<(T | null)[]> {
    if (!keys.length) return [];

    return this.execute(
      async () => {
        const values = await this.redis.mget(keys);
        return values.map((value) => {
          try {
            return JSON.parse(value as string) as T;
          } catch {
            return value as T | null;
          }
        });
      },
      async () => {
        logger.warn("Redis unavailable — mget returning nulls", { keys });
        return keys.map(() => null as T | null);
      },
      `mget:${keys.join(",")}`,
    );
  }

  async flush(): Promise<void> {
    return this.execute(
      async () => {
        await this.redis.flushdb();
        logger.info("🗑️ Redis: Database flushed");
      },
      async () => {
        // flush should never silently no-op
        throw new Error("Redis unavailable — flush rejected");
      },
      `flush`,
    );
  }

  // ─────────────────────────────────────────────
  // HEALTH + TEARDOWN
  // ─────────────────────────────────────────────

  async getHealthStatus() {
    if (!this.client) {
      return { isConnected: false, error: "Redis client not initialized" };
    }

    try {
      const info = await this.redis.info();
      return {
        isConnected: this.isConnected,
        status: this.client.status,
        reconnectAttempts: this.reconnectAttempts,
        uptime: this.extractFromInfo(info, "uptime_in_seconds"),
      };
    } catch (error) {
      return {
        isConnected: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  isHealthy(): boolean {
    return this.isConnected && this.client !== null;
  }

  private extractFromInfo(info: string, key: string): string {
    if (!info || !key) return "N/A";
    const match = info.match(new RegExp(`^${key}:(.+)$`, "im"));
    return match ? match[1].trim() : "N/A";
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.quit();
      this.client = null;
      this.isConnected = false;
      logger.info("👋 Redis: Disconnected gracefully");
    }
  }

  // Exposed only for edge cases — all normal usage should go through execute()
  public getClient(): Redis {
    if (!this.client)
      throw new Error("Redis client not initialized. Call connect() first.");
    return this.client;
  }
}

const redis = new RedisConnection();
export default redis;
