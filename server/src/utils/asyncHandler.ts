import type { NextFunction, Request, RequestHandler, Response } from 'express';

type Params = Request['params'];
type Query = Request['query'];

/**
 * Wraps an async route handler so a rejected promise (or a synchronous throw) goes to `next()`
 * and reaches the error handler, instead of becoming an unhandled rejection.
 * @param handler - async controller function
 */
export function asyncHandler<P = Params, ResBody = unknown, ReqBody = unknown, ReqQuery = Query>(
  handler: (
    req: Request<P, ResBody, ReqBody, ReqQuery>,
    res: Response<ResBody>,
    next: NextFunction,
  ) => Promise<unknown>,
): RequestHandler<P, ResBody, ReqBody, ReqQuery> {
  return (req, res, next) => {
    Promise.resolve()
      .then(() => handler(req, res, next))
      .catch(next);
  };
}
