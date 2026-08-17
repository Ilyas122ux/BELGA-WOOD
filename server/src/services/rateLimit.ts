import type { Request, RequestHandler } from 'express';
import crypto from 'node:crypto';
import { getStore } from '@netlify/blobs';
import { env } from '../config/env.js';

const memory = new Map<string, { count: number; resetAt: number }>();

type LimitOptions = {
  name: string;
  windowMs: number;
  limit: number;
};

function clientKey(req: Request): string {
  return (req.ip || req.get('x-forwarded-for') || 'unknown').split(',')[0]!.trim();
}

async function incrementMemory(name: string, key: string, windowMs: number): Promise<number> {
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

type Bucket = { count: number; resetAt: number };

async function incrementPersistent(name: string, key: string, windowMs: number): Promise<number> {
  try {
    const store = getStore({ name: 'belga-wood-rate-limits', consistency: 'strong' });
    const now = Date.now();
    const bucketKey = `${name}/${crypto.createHash('sha256').update(key).digest('hex')}`;
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const current = await store.getWithMetadata(bucketKey, { type: 'json', consistency: 'strong' }) as
        | { data: Bucket; etag?: string }
        | null;
      const active = current?.data && current.data.resetAt > now;
      const next: Bucket = active
        ? { count: current.data.count + 1, resetAt: current.data.resetAt }
        : { count: 1, resetAt: now + windowMs };
      const result = await store.setJSON(
        bucketKey,
        next,
        current?.etag ? { onlyIfMatch: current.etag } : { onlyIfNew: true },
      );
      if (result.modified) return next.count;
    }
  } catch {
    // Production authentication fails closed if persistent storage is unavailable.
  }
  throw Object.assign(new Error('Le contrôle de sécurité est momentanément indisponible.'), { status: 503 });
}

const increment = (name: string, key: string, windowMs: number) =>
  env.isProduction
    ? incrementPersistent(name, key, windowMs)
    : incrementMemory(name, key, windowMs);

export function durableRateLimit(options: LimitOptions): RequestHandler {
  return (req, res, next) => {
    void increment(options.name, clientKey(req), options.windowMs)
      .then((count) => {
        if (count > options.limit) {
          res.status(429).json({ success: false, data: null, message: 'Trop de tentatives. Reessayez plus tard.' });
          return;
        }
        next();
      })
      .catch(next);
  };
}
