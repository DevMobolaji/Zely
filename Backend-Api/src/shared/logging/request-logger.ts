// src/core/logging/request-logger.ts
import { Request, Response, NextFunction } from "express";
import { v4 as uuidv4 } from "uuid";
import { logger } from "../utils/logger";

/**
 * Adds req.requestId and logs lifecycle:
 * - HTTP_REQUEST_START (info)
 * - HTTP_REQUEST_END / HTTP_REQUEST_CLIENT_ERROR / HTTP_REQUEST_ERROR
 */
export function requestLogger(req: Request & { requestId?: string }, res: Response, next: NextFunction) {
  const start = process.hrtime.bigint();
  const requestId = req.requestId as string 

  const baseMeta = {
    requestId,
    method: req.method,
    path: req.originalUrl || req.url,
    ip: req.ip,
    userAgent: req.get("User-Agent") || "",
  };

  logger.info("HTTP_REQUEST_START", baseMeta);

  res.on("finish", () => {
    const end = process.hrtime.bigint();
    const durationMs = Number(end - start) / 1_000_000;
    const finishedMeta = {
      requestId,
      statusCode: res.statusCode,
      durationMs: Math.round(durationMs * 100) / 100,
    };

    if (res.statusCode >= 500) {
      logger.error("HTTP_REQUEST_ERROR", finishedMeta);
    } else if (res.statusCode >= 400) {
      logger.warn("HTTP_REQUEST_CLIENT_ERROR", finishedMeta);
    } else {
      logger.info("HTTP_REQUEST_END", finishedMeta);
    }
  });

  next();
}


