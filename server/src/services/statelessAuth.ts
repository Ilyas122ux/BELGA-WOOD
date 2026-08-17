import jwt from 'jsonwebtoken';
import type { Request, Response } from 'express';
import { env } from '../config/env.js';

export type AdminIdentity = {
  id: string;
  email: string;
  sessionVersion: string;
};

type TokenPayload = AdminIdentity & {
  iat: number;
  exp: number;
};

export const adminCookieName = 'jad_home_admin_session';
const maxAgeMs = 8 * 60 * 60_000;

export function signAdminSession(admin: AdminIdentity): string {
  return jwt.sign(admin, env.sessionSecret, {
    algorithm: 'HS256',
    expiresIn: '8h',
    issuer: 'jad-home',
    audience: 'jad-home-admin',
  });
}

export function verifyAdminSession(token: string | undefined): AdminIdentity | null {
  if (!token) return null;
  try {
    const payload = jwt.verify(token, env.sessionSecret, {
      algorithms: ['HS256'],
      issuer: 'jad-home',
      audience: 'jad-home-admin',
    }) as TokenPayload;
    if (payload.sessionVersion !== env.adminSessionVersion) return null;
    return { id: payload.id, email: payload.email, sessionVersion: payload.sessionVersion };
  } catch {
    return null;
  }
}

export function readAdmin(req: Request): AdminIdentity | null {
  return verifyAdminSession(req.cookies?.[adminCookieName] as string | undefined);
}

export function setAdminCookie(res: Response, admin: AdminIdentity): void {
  res.cookie(adminCookieName, signAdminSession(admin), {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: 'lax',
    path: '/',
    maxAge: maxAgeMs,
  });
}

export function clearAdminCookie(res: Response): void {
  res.clearCookie(adminCookieName, {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: 'lax',
    path: '/',
  });
}
