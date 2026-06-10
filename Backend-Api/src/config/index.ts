import dotenv from "dotenv";
import { z } from "zod";
dotenv.config();

/* =========================
   Environment schema
   ========================= */
const envSchema = z.object({
  // App
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().default(5000),
  API_VERSION: z.string().min(1),
  APP_NAME: z.string().min(1),

  // Security / Auth
  SESSION_SECRET: z.string().min(32),
  MAX_LOGIN_ATTEMPTS: z.coerce.number().int().default(5),
  LOCKOUT_DURATION: z.coerce.number().int().default(900_000),

  // JWT
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_RESET_SECRET: z.string().min(32),
  JWT_ACCESS_EXPIRY: z.string().default("15m"),
  JWT_REFRESH_EXPIRY: z.string().default("7d"),
  JWT_COOKIE_NAME: z.string().default("rToken"),

  // Database
  MONGODB_URI: z.string().min(1),

  // Redis (sessions, rate limit, cache)
  REDIS_HOST: z.string().min(1),
  REDIS_PORT: z.coerce.number().default(6379),
  REDIS_PASSWORD: z.string().optional(),
  REDIS_DB: z.coerce.number().default(0),
  REDIS_DB_1: z.coerce.number().default(1),
  REDIS_DB_2: z.coerce.number().default(2),
  REDIS_DB_3: z.coerce.number().default(3),
  HASH_PREFIX: z.string().min(1),
  LATEST_PREFIX: z.string().min(1),
  DEVICES_PREFIX: z.string().min(1),
  BLACKLIST_PREFIX: z.string().min(1),
  PWDVER_PREFIX: z.string().min(1),
  LASTUSED_PREFIX: z.string().min(1),

  // Kafka (events)
  KAFKA_BROKERS: z.string().min(1),
  KAFKA_CLIENT_ID: z.string().min(1),
  KAFKA_GROUP_ID: z.string().min(1),

  // Email (optional but supported)
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().optional(),
  EMAIL_FROM_NAME: z.string().optional(),
  TEST_RECIPIENT: z.string().optional(),

  // Rate limiting
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(900_000),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().default(100),

  // Logging
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),

  // Redis
  REDIS_MAX_RETRIES_PER_REQUEST: z.coerce.number().default(3),
  REDIS_ENABLE_READY_CHECK: z.boolean().default(true),
  REDIS_ENABLE_OFFLINE_QUEUE: z.boolean().default(true),

  //PEPPER
  PEPPER: z.string().min(1),

  //CORS
  CORS_ORIGIN: z.string().min(1),
  ALLOWED_DOMAINS: z.string().min(1),

  //KYC
  KYC_PROVIDER: z.string().min(1),
  DOJAH_API_KEY: z.string().min(1),
  DOJAH_APP_ID: z.string().min(1),
  DOJAH_BASE_URL: z.string().min(1),
});

//node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

const env = envSchema.parse(process.env);

/* =========================
   Runtime configuration
   ========================= */
export const config = {
  app: {
    env: env.NODE_ENV,
    port: env.PORT,
    apiVersion: env.API_VERSION,
    name: env.APP_NAME,
  },

  database: {
    mongodb: {
      uri: env.MONGODB_URI,
      options: {
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 5_000,
        socketTimeoutMS: 45_000,
      },
    },
  },

  redis: {
    host: env.REDIS_HOST,
    port: env.REDIS_PORT,
    password: env.REDIS_PASSWORD,
    db: env.REDIS_DB,
    db1: env.REDIS_DB_1,
    db2: env.REDIS_DB_2,
    db3: env.REDIS_DB_3,
    maxRetriesPerRequest: env.REDIS_MAX_RETRIES_PER_REQUEST,
    enableReadyCheck: env.REDIS_ENABLE_READY_CHECK,
    enableOfflineQueue: env.REDIS_ENABLE_OFFLINE_QUEUE,
    hashPrefix: env.HASH_PREFIX,
    latestPrefix: env.LATEST_PREFIX,
    userDevicesPrefix: env.DEVICES_PREFIX,
    blacklistPrefix: env.BLACKLIST_PREFIX,
    pwdverPrefix: env.PWDVER_PREFIX,
    lastusedPrefix: env.LASTUSED_PREFIX,
  },

  kafka: {
    brokers: env.KAFKA_BROKERS.split(","),
    clientId: env.KAFKA_CLIENT_ID,
    groupId: env.KAFKA_GROUP_ID,
    connectionTimeout: 10_000,
    requestTimeout: 30_000,
    retry: {
      initialRetryTime: 100,
      retries: 8,
    },
  },

  jwt: {
    accessSecret: env.JWT_ACCESS_SECRET,
    refreshSecret: env.JWT_REFRESH_SECRET,
    accessExpiry: env.JWT_ACCESS_EXPIRY,
    refreshExpiry: env.JWT_REFRESH_EXPIRY,
    refreshCookieName: env.JWT_COOKIE_NAME,
    resetSecret: env.JWT_RESET_SECRET,
  },

  kyc: {
    provider: env.KYC_PROVIDER ?? "ADMIN",
    dojah: {
      apiKey: env.DOJAH_API_KEY,
      appId: env.DOJAH_APP_ID,
      baseUrl: env.DOJAH_BASE_URL ?? "https://api.dojah.io",
    },
  },

  payment: {
    provider: process.env.PAYMENT_PROVIDER ?? "MOCK",
    paystack: {
      secretKey: process.env.PAYSTACK_SECRET_KEY,
      publicKey: process.env.PAYSTACK_PUBLIC_KEY,
      webhookSecret: process.env.PAYSTACK_WEBHOOK_SECRET,
      baseUrl: process.env.PAYSTACK_BASE_URL ?? "https://api.paystack.co",
    },
    callbackUrl:
      process.env.PAYMENT_CALLBACK_URL ??
      "http://localhost:3000/payment/callback",
    minAmount: parseInt(process.env.PAYMENT_MIN_AMOUNT_KOBO ?? "10000", 10), // ₦100 default
    maxAmount: parseInt(
      process.env.PAYMENT_MAX_AMOUNT_KOBO ?? "10000000000",
      10,
    ), // ₦100M default cap
  },

  security: {
    sessionSecret: env.SESSION_SECRET,
    maxLoginAttempts: env.MAX_LOGIN_ATTEMPTS,
    lockoutDuration: env.LOCKOUT_DURATION,
  },

  rateLimit: {
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    maxRequests: env.RATE_LIMIT_MAX_REQUESTS,
  },

  email: env.RESEND_API_KEY
    ? {
        apiKey: env.RESEND_API_KEY,
        from: env.EMAIL_FROM ?? "noreply@fintech.local",
        fromName: env.EMAIL_FROM_NAME ?? "Fintech",
        testRecipient: env.TEST_RECIPIENT ?? "",
      }
    : null,

  logging: {
    level: env.LOG_LEVEL,
  },
  cors: {
    origin: env.CORS_ORIGIN,
    domains:
      process.env.CORS_ALLOWED_ORIGINS?.split(",")
        .map((origin) => origin.trim())
        .filter(Boolean) ?? [],
  },

  pepper: env.PEPPER,
} as const;

/* =========================
   Startup validation
   ========================= */
if (config.app.env !== "test") {
  // Explicit safety checks (Zod already validated types)
  if (!config.jwt.accessSecret || !config.jwt.refreshSecret) {
    throw new Error("JWT secrets must be set");
  }

  if (!config.security.sessionSecret) {
    throw new Error("SESSION_SECRET must be set");
  }
}
