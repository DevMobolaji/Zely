// src/core/logging/skip-rules.ts
import { Request } from "express";

export const SKIP_PATHS = new Set<string>([
  "/metrics",
  "/health",
  "/healthz",
  "/ready",
  "/live",
]);

export const SKIP_USER_AGENT_PREFIXES = ["Prometheus/", "kube-probe/"];

export const isObservabilityNoise = (req: Request): boolean => {
  if (SKIP_PATHS.has(req.path)) return true;
  const ua = req.get("User-Agent") ?? "";
  return SKIP_USER_AGENT_PREFIXES.some((prefix) => ua.startsWith(prefix));
};