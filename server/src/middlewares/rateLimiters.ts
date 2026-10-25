import type { Request, RequestHandler } from 'express';
import { rateLimit } from 'express-rate-limit';
import { config } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';

/** Options for {@link createRateLimiter}. */
export interface RateLimiterOptions {
  windowMs: number;
  max: number;
  /** Return true to let a request through without counting it. */
  skip?: (req: Request) => boolean;
}

/**
 * Creates a per-IP rate limiter. Over the limit it responds 429 RATE_LIMITED in the standard
 * error format with `details.retryAfterSeconds` (via the error handler).
 * Uses the in-memory store for now.
 * @param options - window, max requests per window, optional skip
 */
export function createRateLimiter({ windowMs, max, skip }: RateLimiterOptions): RequestHandler {
  return rateLimit({
    windowMs,
    limit: max,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    ...(skip ? { skip } : {}),
    handler: (req, _res, next) => {
      const resetTime = (req as Request & { rateLimit?: { resetTime?: Date } }).rateLimit
        ?.resetTime;
      const retryAfterMs = resetTime ? resetTime.getTime() - Date.now() : windowMs;
      next(
        ApiError.tooManyRequests('Too many requests, please try again later', {
          retryAfterSeconds: Math.max(1, Math.ceil(retryAfterMs / 1000)),
        }),
      );
    },
  });
}

/** Global API limiter (spec §7.1: 300 requests / 15 min / IP by default). Off in tests. */
export const apiLimiter = createRateLimiter({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  skip: () => config.isTest,
});
