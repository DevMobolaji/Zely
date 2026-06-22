import { Request, Response, NextFunction } from "express";
import { logger } from "../utils/logger";

const SKIP_PATHS = new Set<string>([
  "/metrics",
  "/health",
  "/healthz",
  "/ready",
  "/live",
]);

const shouldSkip = (req: Request): boolean => {
  if (SKIP_PATHS.has(req.path)) return true;
  const ua = req.get("User-Agent") ?? "";
  if (ua.startsWith("Prometheus/")) return true;
  if (req.path.startsWith("/admin/queues")) return true;
  return false;
};

export function requestLogger(
  req: Request & { requestId?: string },
  res: Response,
  next: NextFunction,
) {
  if (shouldSkip(req)) return next();

  const start = process.hrtime.bigint();
  const requestId = req.requestId as string;

  res.on("finish", () => {
    const durationMs =
      Math.round((Number(process.hrtime.bigint() - start) / 1_000_000) * 100) /
      100;
    const { statusCode } = res;
    const msg = `${req.method} ${req.originalUrl || req.url} ${statusCode} ${durationMs}ms [${requestId?.slice(0, 8)}]`;

    if (statusCode >= 500) logger.error(msg);
    else if (statusCode >= 400) logger.warn(msg);
    else logger.info(msg);
  });

  next();
}
