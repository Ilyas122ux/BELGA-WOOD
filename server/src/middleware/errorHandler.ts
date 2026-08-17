import type { ErrorRequestHandler } from 'express';
import { MulterError } from 'multer';
import { ZodError } from 'zod';
import { env } from '../config/env.js';

export const errorHandler: ErrorRequestHandler = (error, _req, res, next) => {
  if (res.headersSent) {
    return next(error);
  }
  if (error instanceof ZodError) {
    return res.status(400).json({ success: false, data: error.flatten(), message: 'Les données fournies sont invalides.' });
  }
  if (error instanceof MulterError) {
    return res.status(400).json({ success: false, data: null, message: error.code === 'LIMIT_FILE_SIZE' ? 'Une image dépasse 8 Mo.' : error.message });
  }
  const message = error instanceof Error ? error.message : 'Une erreur interne est survenue.';
  const isConflict = /déjà utilisé/i.test(message);
  const isMissing = /introuvable/i.test(message);
  const errorStatus = Number((error as { status?: unknown; statusCode?: unknown })?.statusCode || (error as { status?: unknown })?.status);
  const status = errorStatus >= 400 && errorStatus < 600 ? errorStatus : isConflict ? 409 : isMissing ? 404 : 500;
  const publicMessage = status === 500 && env.isProduction
    ? 'Une erreur interne est survenue.'
    : message;
  return res.status(status).json({ success: false, data: null, message: publicMessage });
};
