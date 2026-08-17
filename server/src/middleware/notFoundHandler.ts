import type { RequestHandler } from 'express';

export const notFoundHandler: RequestHandler = (req, res, next) => {
  if (res.headersSent) return next();
  return res.status(404).json({
    success: false,
    data: null,
    message: `Ressource introuvable: ${req.originalUrl}`,
  });
};
