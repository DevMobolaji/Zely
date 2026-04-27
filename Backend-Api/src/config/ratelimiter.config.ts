import { Request, Response, NextFunction } from 'express';
import Redis from 'ioredis';


export interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Max requests per window
  message?: string; // Custom error message
  keyPrefix?: string;  // Redis key prefix (default: 'ratelimit')
  keyGenerator?: (req: Request) => string; // Custom key generator
  skip?: (req: Request) => boolean;   // Skip rate limiting
  onLimitReached?: (req: Request, info?: RateLimitInfo) => void;  // Callback
  failMode?: 'open' | 'closed';  // Behavior when Redis is down (default: 'open')
}

export interface RateLimitInfo {
  limit: number;
  current: number;
  remaining: number;
  resetTime: Date;
  retryAfter: number;  // seconds
}


export class RateLimiter {
  private redis: Redis;
  private prefix: string;

  /**
   * Atomic INCR + conditional EXPIRE in a single Lua script.
   *
   * Why Lua: Redis runs scripts atomically. Without this, a process crash
   * between INCR and EXPIRE leaves a counter with no TTL — it stays at 1
   * forever and locks users out permanently until manually deleted.
   *
   * Returns: [currentCount, currentTTLSeconds]
   */
  private static readonly RATE_LIMIT_SCRIPT = `
    local current = redis.call('INCR', KEYS[1])
    if current == 1 then
      redis.call('EXPIRE', KEYS[1], ARGV[1])
    end
    return { current, redis.call('TTL', KEYS[1]) }
  `;

  constructor(redis: Redis, prefix: string = 'ratelimit') {
    this.redis = redis;
    this.prefix = prefix;
  }

  /**
   * Atomically increment the counter and return current state.
   * Throws on Redis failure — caller decides fail-open vs fail-closed.
   */
  async consume(
    key: string,
    maxRequests: number,
    windowMs: number,
  ): Promise<RateLimitInfo> {
    const redisKey = `${this.prefix}:${key}`;
    const now = Date.now();
    const windowSeconds = Math.ceil(windowMs / 1000);

    const result = await this.redis.eval(
      RateLimiter.RATE_LIMIT_SCRIPT,
      1,                  // number of KEYS
      redisKey,           // KEYS[1]
      windowSeconds.toString(),  // ARGV[1]
    ) as [number, number];

    const current = result[0];
    const ttl = result[1];

    const resetTime = ttl > 0
      ? new Date(now + (ttl * 1000))
      : new Date(now + windowMs);

    return {
      limit: maxRequests,
      current,
      remaining: Math.max(0, maxRequests - current),
      resetTime,
      retryAfter: ttl > 0 ? ttl : windowSeconds,
    };
  }

  /**
   * Read current state without incrementing.
   * Throws on Redis failure.
   */
  async getInfo(
    key: string,
    maxRequests: number,
    windowMs: number,
  ): Promise<RateLimitInfo> {
    const redisKey = `${this.prefix}:${key}`;
    const now = Date.now();

    const pipeline = this.redis.pipeline();
    pipeline.get(redisKey);
    pipeline.ttl(redisKey);

    const results = await pipeline.exec();
    if (!results) {
      throw new Error('Redis pipeline failed');
    }

    const current = parseInt((results[0][1] as string) || '0');
    const ttl = results[1][1] as number;

    const resetTime = ttl > 0
      ? new Date(now + (ttl * 1000))
      : new Date(now + windowMs);

    return {
      limit: maxRequests,
      current,
      remaining: Math.max(0, maxRequests - current),
      resetTime,
      retryAfter: ttl > 0 ? ttl : Math.ceil(windowMs / 1000),
    };
  }

  /**
   * Reset rate limit for a specific key (admin/emergency use).
   */
  async reset(key: string): Promise<boolean> {
    const redisKey = `${this.prefix}:${key}`;
    try {
      await this.redis.del(redisKey);
      return true;
    } catch (error) {
      console.error('Rate limiter reset error:', error);
      return false;
    }
  }
}


/**
 * Generate key based on IP address.
 * Trusts X-Forwarded-For — make sure Express `trust proxy` is configured
 * so attackers can't spoof this header on direct connections.
 */
export function getKeyByIP(req: Request): string {
  const ip =
    (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
    (req.headers['x-real-ip'] as string) ||
    req.socket.remoteAddress ||
    'unknown';

  return ip;
}

/**
 * Generate key based on email from request body.
 * Falls back to IP if email is missing.
 */
export function getKeyByEmail(req: Request): string {
  const email = req.body?.email;
  if (!email || typeof email !== 'string') {
    return getKeyByIP(req);
  }
  return `email:${email.toLowerCase().trim()}`;
}

/**
 * Generate key based on authenticated user ID.
 * Falls back to IP if not authenticated.
 */
export function getKeyByUserId(req: Request): string {
  const userId = (req as any).user?.id || (req as any).user?.userId || (req as any).userId;
  if (!userId) {
    return getKeyByIP(req);
  }
  return `user:${userId}`;
}

/**
 * Composite key: IP + Email. Most secure for auth endpoints —
 * one IP can't lock out a victim by spamming requests for the victim's email.
 */
export function getKeyByIPAndEmail(req: Request): string {
  const ip = getKeyByIP(req);
  const email = req.body?.email;

  if (!email || typeof email !== 'string') {
    return ip;
  }

  return `${ip}:email:${email.toLowerCase().trim()}`;
}



export default RateLimiter;