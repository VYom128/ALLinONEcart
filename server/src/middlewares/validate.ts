import type { RequestHandler } from 'express';
import { z } from 'zod';

/** Zod schemas for the parts of a request to validate. Each is optional. */
export interface RequestSchemas {
  body?: z.ZodType;
  query?: z.ZodType;
  params?: z.ZodType;
}

/**
 * Validates `req.body`, `req.query` and `req.params` and replaces them with the parsed values
 * (Zod object schemas strip unknown fields). On failure it passes the ZodError to `next()`;
 * issue paths start with the location (`body.title`), and the error handler formats them.
 * @param schemas - the schemas to apply
 */
export function validate(schemas: RequestSchemas): RequestHandler {
  const shape: Record<string, z.ZodType> = {};
  if (schemas.body) shape.body = schemas.body;
  if (schemas.query) shape.query = schemas.query;
  if (schemas.params) shape.params = schemas.params;
  const schema = z.object(shape);

  return (req, _res, next) => {
    const result = schema.safeParse({ body: req.body, query: req.query, params: req.params });
    if (!result.success) {
      next(result.error);
      return;
    }

    const parsed = result.data as { body?: unknown; query?: unknown; params?: unknown };
    if ('body' in shape) req.body = parsed.body;
    if ('query' in shape) req.query = parsed.query as typeof req.query;
    if ('params' in shape) req.params = parsed.params as typeof req.params;
    next();
  };
}
