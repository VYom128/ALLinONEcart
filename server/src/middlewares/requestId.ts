import { randomUUID } from 'node:crypto';
import type { RequestHandler } from 'express';

/** Header used to pass request ids in and out. */
export const REQUEST_ID_HEADER = 'X-Request-Id';

const VALID_REQUEST_ID = /^[A-Za-z0-9_-]{8,64}$/;

/**
 * Gives every request an id: reuses an incoming `X-Request-Id` only if it matches
 * `[A-Za-z0-9_-]{8,64}`, otherwise generates a UUID. Sets `req.id` and the response header.
 */
export const requestId: RequestHandler = (req, res, next) => {
  const incoming = req.get(REQUEST_ID_HEADER);
  req.id = incoming && VALID_REQUEST_ID.test(incoming) ? incoming : randomUUID();
  res.setHeader(REQUEST_ID_HEADER, req.id);
  next();
};

/**
 * The request id as a string (pino-http types `req.id` loosely as string | number | object).
 * @param req - any request that went through {@link requestId}
 */
export function getRequestId(req: { id?: unknown }): string | undefined {
  return typeof req.id === 'string' ? req.id : undefined;
}
