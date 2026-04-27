
import RateLimiter, { getKeyByIP, RateLimitConfig, RateLimitInfo } from "@/config/ratelimiter.config";
import { Request, Response, NextFunction } from "express";
import Redis from "ioredis";

export function createRateLimitMiddleware(
  redis: Redis,
  options: RateLimitConfig,
) {
  const limiter = new RateLimiter(redis, options.keyPrefix);
  const failMode = options.failMode ?? 'open';

  return async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      if (options.skip && options.skip(req)) {
        return next();
      }

      const keyGenerator = options.keyGenerator || getKeyByIP;
      const key = keyGenerator(req);

      // Try to consume — handle Redis failure separately from middleware bugs
      let info: RateLimitInfo;
      try {
        info = await limiter.consume(
          key,
          options.maxRequests,
          options.windowMs,
        );
      } catch (redisErr) {
        if (failMode === 'closed') {
          console.error('Rate limiter Redis failure (failing closed):', {
            path: req.path,
            error: redisErr,
          });
          res.status(503).json({
            success: false,
            error: {
              code: 'RATE_LIMIT_UNAVAILABLE',
              message: 'Service temporarily unavailable. Please try again in a moment.',
            },
          });
          return;
        }

        // failMode === 'open' — log and allow request through
        console.error('Rate limiter Redis failure (failing open):', {
          path: req.path,
          error: redisErr,
        });
        return next();
      }

      // Set informational headers on every response
      res.setHeader('X-RateLimit-Limit', info.limit.toString());
      res.setHeader('X-RateLimit-Remaining', info.remaining.toString());
      res.setHeader('X-RateLimit-Reset', info.resetTime.toISOString());

      // Limit exceeded — block with 429
      if (info.current > info.limit) {
        res.setHeader('Retry-After', info.retryAfter.toString());

        if (options.onLimitReached) {
          try {
            options.onLimitReached(req, info);
          } catch (cbErr) {
            // Don't let a callback bug break the middleware
            console.error('onLimitReached callback error:', cbErr);
          }
        }

        res.status(429).json({
          success: false,
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: options.message || 'Too many requests, please try again later.',
            retryAfter: info.retryAfter,
            resetTime: info.resetTime.toISOString(),
          },
        });
        return;
      }

      next();
    } catch (error) {
      // Bug in the middleware itself (not a Redis issue).
      // Don't take the app down — log and let the request through.
      console.error('Rate limit middleware unexpected error:', error);
      next();
    }
  };
}