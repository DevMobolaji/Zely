import Redis from "ioredis";
import {
  getKeyByIP,
  getKeyByEmail,
  getKeyByUserId,
  getKeyByIPAndEmail,
} from "@/config/ratelimiter.config";

import { createRateLimitMiddleware } from "@/shared/middleware/ratelimit.middleware";
import { Response, Request, NextFunction } from "express";
import { logger } from "@/shared/utils/logger";
// ============================================================================
// REDIS CLIENT FOR RATE LIMITING
// Separate DB so rate-limit keys don't collide with other Redis usage.
// ============================================================================

const redis = new Redis({
  host: process.env.REDIS_HOST || "localhost",
  port: parseInt(process.env.REDIS_PORT || "6379"),
  password: process.env.REDIS_PASSWORD,
  db: 2,
  retryStrategy: (times) => Math.min(times * 50, 2000),
});

redis.on("connect", () => console.log("✅ Rate-limit Redis connected"));
redis.on("error", (err) => console.error("❌ Rate-limit Redis error:", err));

const FIFTEEN_MIN = 15 * 60 * 1000;
const ONE_HOUR = 60 * 60 * 1000;
const ONE_MINUTE = 60 * 1000;

// ============================================================================
// LOGIN — Critical
// Prevent brute force on credentials.
// Layered: per IP+email (single device spam) + per IP (cross-email scanning)
// ============================================================================

export const loginLimiters = [
  createRateLimitMiddleware(redis, {
    windowMs: FIFTEEN_MIN,
    maxRequests: 8,
    keyGenerator: getKeyByIPAndEmail,
    keyPrefix: "rl:login:ipemail",
    failMode: "closed",
    message: "Too many login attempts. Please try again in 15 minutes.",
  }),
  createRateLimitMiddleware(redis, {
    windowMs: FIFTEEN_MIN,
    maxRequests: 30,
    keyGenerator: getKeyByIP,
    keyPrefix: "rl:login:ip",
    failMode: "closed",
    message: "Too many requests from this device. Please try again later.",
  }),
];

// ============================================================================
// REGISTER — Critical
// Prevent mass account creation. IP-based only (account doesn't exist yet).
// ============================================================================

export const registerLimiters = [
  createRateLimitMiddleware(redis, {
    windowMs: ONE_HOUR,
    maxRequests: 5,
    keyGenerator: getKeyByIP,
    keyPrefix: "rl:register:ip",
    failMode: "closed",
    message:
      "Too many registration attempts from this device. Please try again in an hour.",
  }),
];

// ============================================================================
// VERIFY EMAIL — High
// Submitting OTP for email verification. Prevent brute-force code guessing.
// (Note: the OTPManager itself caps maxAttempts to 5 per OTP — this is the HTTP backstop.)
// ============================================================================

export const verifyEmailLimiters = [
  createRateLimitMiddleware(redis, {
    windowMs: FIFTEEN_MIN,
    maxRequests: 10,
    keyGenerator: getKeyByIPAndEmail,
    keyPrefix: "rl:verify-email:ipemail",
    failMode: "closed",
    message: "Too many verification attempts. Please try again later.",
  }),
  createRateLimitMiddleware(redis, {
    windowMs: FIFTEEN_MIN,
    maxRequests: 30,
    keyGenerator: getKeyByIP,
    keyPrefix: "rl:verify-email:ip",
    failMode: "closed",
    message: "Too many requests from this device. Please try again later.",
  }),
];

// ============================================================================
// RESEND VERIFICATION — High
// Triggers OTP creation. HTTP layer is more permissive than the OTP throttle
// (which is the precise gate at 5/hour per email).
// ============================================================================

export const resendVerificationLimiters = [
  createRateLimitMiddleware(redis, {
    windowMs: FIFTEEN_MIN,
    maxRequests: 5,
    keyGenerator: getKeyByIPAndEmail,
    keyPrefix: "rl:resend-verification:ipemail",
    failMode: "closed",
    message: "Too many resend requests. Please try again later.",
  }),
  createRateLimitMiddleware(redis, {
    windowMs: ONE_HOUR,
    maxRequests: 10,
    keyGenerator: getKeyByEmail,
    keyPrefix: "rl:resend-verification:email",
    failMode: "closed",
    message: "Too many resend requests. Please try again later.",
  }),
  createRateLimitMiddleware(redis, {
    windowMs: FIFTEEN_MIN,
    maxRequests: 20,
    keyGenerator: getKeyByIP,
    keyPrefix: "rl:resend-verification:ip",
    failMode: "closed",
    message: "Too many requests from this device. Please try again later.",
  }),
];

// ============================================================================
// FORGOT PASSWORD — High
// Same shape as resend-verification but slightly more lenient since users
// hit this less frequently.
// ============================================================================

export const forgotPasswordLimiters = [
  createRateLimitMiddleware(redis, {
    windowMs: FIFTEEN_MIN,
    maxRequests: 8,
    keyGenerator: getKeyByIPAndEmail,
    keyPrefix: "rl:forgot-password:ipemail",
    failMode: "closed",
    message: "Too many password reset requests. Please try again later.",
  }),
  createRateLimitMiddleware(redis, {
    windowMs: ONE_HOUR,
    maxRequests: 15,
    keyGenerator: getKeyByEmail,
    keyPrefix: "rl:forgot-password:email",
    failMode: "closed",
    message: "Too many password reset requests. Please try again later.",
  }),
  createRateLimitMiddleware(redis, {
    windowMs: FIFTEEN_MIN,
    maxRequests: 30,
    keyGenerator: getKeyByIP,
    keyPrefix: "rl:forgot-password:ip",
    failMode: "closed",
    message: "Too many requests from this device. Please try again later.",
  }),
];

// ============================================================================
// CONFIRM RESET CODE — High
// Submitting OTP for password reset. Brute-force protection.
// ============================================================================

export const confirmResetCodeLimiters = [
  createRateLimitMiddleware(redis, {
    windowMs: FIFTEEN_MIN,
    maxRequests: 10,
    keyGenerator: getKeyByIPAndEmail,
    keyPrefix: "rl:confirm-reset:ipemail",
    failMode: "closed",
    message: "Too many verification attempts. Please try again later.",
  }),
  createRateLimitMiddleware(redis, {
    windowMs: FIFTEEN_MIN,
    maxRequests: 30,
    keyGenerator: getKeyByIP,
    keyPrefix: "rl:confirm-reset:ip",
    failMode: "closed",
    message: "Too many requests from this device. Please try again later.",
  }),
];

// ============================================================================
// RESET PASSWORD — Critical
// The actual password change with a valid reset code. Strict to prevent
// account takeover via stolen codes.
// ============================================================================

export const resetPasswordLimiters = [
  createRateLimitMiddleware(redis, {
    windowMs: FIFTEEN_MIN,
    maxRequests: 5,
    keyGenerator: getKeyByIPAndEmail,
    keyPrefix: "rl:reset-password:ipemail",
    failMode: "closed",
    message: "Too many password reset attempts. Please try again later.",
  }),
  createRateLimitMiddleware(redis, {
    windowMs: FIFTEEN_MIN,
    maxRequests: 10,
    keyGenerator: getKeyByIP,
    keyPrefix: "rl:reset-password:ip",
    failMode: "closed",
    message: "Too many requests from this device. Please try again later.",
  }),
];

// ============================================================================
// REFRESH TOKEN — Medium
// IP-based since the refresh token is in cookies/headers, not body.
// Fail-open: refresh failures during a Redis outage shouldn't lock users out.
// ============================================================================

export const refreshTokenLimiters = [
  createRateLimitMiddleware(redis, {
    windowMs: FIFTEEN_MIN,
    maxRequests: 30,
    keyGenerator: getKeyByIP,
    keyPrefix: "rl:refresh:ip",
    failMode: "open",
    message: "Too many refresh attempts. Please try again shortly.",
  }),
];

// ============================================================================
// LOGOUT — Low
// Lenient — logout shouldn't be hard to do. Fail-open.
// ============================================================================

export const logoutLimiters = [
  createRateLimitMiddleware(redis, {
    windowMs: FIFTEEN_MIN,
    maxRequests: 30,
    keyGenerator: getKeyByIP,
    keyPrefix: "rl:logout:ip",
    failMode: "open",
  }),
];

// ============================================================================
// LOGOUT ALL — Medium (auth required)
// Per user since requireAuth has run before this. Fail-open.
// ============================================================================

export const logoutAllLimiters = [
  createRateLimitMiddleware(redis, {
    windowMs: ONE_HOUR,
    maxRequests: 5,
    keyGenerator: getKeyByUserId,
    keyPrefix: "rl:logout-all:user",
    failMode: "open",
    message: "Too many session termination requests. Please try again later.",
  }),
];

// ============================================================================
// ME — Auth-required user data
// Generous — this is just a profile read.
// ============================================================================

export const meLimiters = [
  createRateLimitMiddleware(redis, {
    windowMs: FIFTEEN_MIN,
    maxRequests: 100,
    keyGenerator: getKeyByUserId,
    keyPrefix: "rl:me:user",
    failMode: "open",
  }),
];

// ============================================================================
// PLACEHOLDERS — uncomment when these endpoints are built
// ============================================================================

export const paymentInitLimiters = [
  // Per-user limit — max 5 initializations per 15 minutes
  createRateLimitMiddleware(redis, {
    windowMs: FIFTEEN_MIN,
    maxRequests: 5,
    keyGenerator: getKeyByUserId, // keyed to the user, not IP
    keyPrefix: "rl:payment-init:user",
    failMode: "open",
    message: "Too many payment attempts. Please wait before trying again.",
  }),
  // Per-IP limit — catches unauthenticated abuse before auth runs
  createRateLimitMiddleware(redis, {
    windowMs: ONE_HOUR,
    maxRequests: 20,
    keyGenerator: getKeyByIP,
    keyPrefix: "rl:payment-init:ip",
    failMode: "open",
    message: "Too many requests from this device. Please try again later.",
  }),
];

export const paymentListLimiter = createRateLimitMiddleware(redis, {
  windowMs: ONE_MINUTE,
  maxRequests: 20,
  keyGenerator: getKeyByUserId,
  keyPrefix: "rl:payment-list:user",
  failMode: "open",
  message: "Too many requests. Please slow down.",
});

export const paymentReferenceLimiter = createRateLimitMiddleware(redis, {
  windowMs: ONE_MINUTE,
  maxRequests: 30,
  keyGenerator: getKeyByUserId,
  keyPrefix: "rl:payment-ref:user",
  failMode: "open",
  message: "Too many requests. Please slow down.",
});

//Not important at the moment, but will be used to protect payment reference lookup and listing endpoints in payment.controller.ts.
export const paystackIpWhitelist = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const allowedIPs = ["52.31.139.75", "52.49.173.169", "52.214.14.220"]; // Paystack's published IPs

  const requestIP = req.ip || req.socket.remoteAddress;

  if (!allowedIPs.includes(requestIP!)) {
    logger.warn("Webhook request from unknown IP", { ip: requestIP });
    res.status(403).json({ message: "Forbidden" });
    return;
  }

  next();
};
