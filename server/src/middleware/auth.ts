import type { NextFunction, Request, Response } from 'express';
import type { AdminIdentity } from '../services/statelessAuth.js';
import { readAdmin } from '../services/statelessAuth.js';

declare module 'express-serve-static-core' {
  interface Request {
    admin?: AdminIdentity;
  }
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const admin = readAdmin(req);
  if (!admin) {
    res.status(401).json({ success: false, data: null, message: 'Authentification requise.' });
    return;
  }
  req.admin = admin;
  return next();
}
