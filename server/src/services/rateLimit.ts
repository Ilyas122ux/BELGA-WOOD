import crypto from "node:crypto";
import type { Request, RequestHandler } from "express";
import { env } from "../config/env.js";

const memory = new Map<string, { count: number; resetAt: number }>();

type LimitOptions = { name: string; windowMs: number; limit: number };
type PersistentRateLimitRepository = {
  recordRateLimitAttempt?: (
    name: string,
    keyHash: string,
    windowMs: number,
  ) => Promise<number>;
};

function clientKey(req: Request): string {
  return (req.ip || req.get("x-forwarded-for") || "unknown")
    .split(",")[0]!
    .trim();
}

async function incrementMemory(name: string, key: string, windowMs: number) {
  const now = Date.now();
  const bucket = `${name}:${key}:${Math.floor(now / windowMs)}`;
  const current = memory.get(bucket);
  if (!current || current.resetAt <= now) {
    memory.set(bucket, { count: 1, resetAt: now + windowMs });
    return 1;
  }
  current.count += 1;
  return current.count;
}

export function durableRateLimit(
  options: LimitOptions,
  repository?: PersistentRateLimitRepository,
): RequestHandler {
  return (req, res, next) => {
    const key = clientKey(req);
    const increment = env.isProduction
      ? repository?.recordRateLimitAttempt
        ? () =>
            repository.recordRateLimitAttempt!(
              options.name,
              crypto.createHash("sha256").update(key).digest("hex"),
              options.windowMs,
            )
        : () => Promise.reject(new Error("persistent store unavailable"))
      : () => incrementMemory(options.name, key, options.windowMs);

    void increment()
      .then((count) => {
        if (count > options.limit) {
          res.status(429).json({
            success: false,
            data: null,
            message: "Trop de tentatives. Reessayez plus tard.",
          });
          return;
        }
        next();
      })
      .catch(() =>
        next(
          Object.assign(
            new Error("Le contrôle de sécurité est momentanément indisponible."),
            { status: 503 },
          ),
        ),
      );
  };
}
