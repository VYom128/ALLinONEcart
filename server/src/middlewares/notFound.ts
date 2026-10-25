import type { RequestHandler } from 'express';
import { ApiError } from '../utils/ApiError.js';

/** Turns any unmatched route into 404 NOT_FOUND "Route not found: METHOD /path" (no query). */
export const notFound: RequestHandler = (req, _res, next) => {
  next(ApiError.notFound(`Route not found: ${req.method} ${req.path}`));
};
