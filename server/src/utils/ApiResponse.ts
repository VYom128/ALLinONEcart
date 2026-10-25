import type { Response } from 'express';

/** Body of every successful response (spec §7.1). */
export interface SuccessBody<T> {
  success: true;
  message: string;
  data: T;
  meta?: Record<string, unknown>;
}

/** Options for {@link sendSuccess}. */
export interface SendSuccessOptions<T> {
  statusCode?: number;
  message?: string;
  data?: T;
  meta?: Record<string, unknown>;
}

/**
 * Sends `{ success: true, message, data, meta? }`. `meta` is left out when undefined.
 * `data` must already be serialized – never pass raw Mongoose documents.
 * @param res - Express response
 * @param options - status (default 200), message (default 'OK'), data (default null), meta
 */
export function sendSuccess<T = null>(
  res: Response,
  { statusCode = 200, message = 'OK', data, meta }: SendSuccessOptions<T> = {},
): Response {
  const body: SuccessBody<T | null> = { success: true, message, data: data ?? null };
  if (meta !== undefined) body.meta = meta;
  return res.status(statusCode).json(body);
}
