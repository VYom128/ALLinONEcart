import type { ErrorRequestHandler } from 'express';
import mongoose from 'mongoose';
import { ZodError } from 'zod';
import { config } from '../config/env.js';
import { ERROR_CODES, ERROR_HTTP_STATUS, type ErrorCode } from '../config/constants.js';
import { ApiError } from '../utils/ApiError.js';
import { getRequestId } from './requestId.js';
import { logger, serializeError } from '../utils/logger.js';

/** One entry of `error.details` for validation failures. */
export interface FieldError {
  field: string;
  message: string;
}

/** Body of every error response (spec §7.1). */
export interface ErrorBody {
  success: false;
  message: string;
  error: { code: ErrorCode; details?: unknown };
  requestId: string | undefined;
  /** Development only. */
  stack?: string;
}

interface NormalizedError {
  status: number;
  code: ErrorCode;
  message: string;
  details?: unknown;
}

/** body-parser errors carry a `type` such as 'entity.parse.failed'. */
function bodyParserType(err: unknown): string | undefined {
  if (typeof err === 'object' && err !== null && 'type' in err && typeof err.type === 'string') {
    return err.type;
  }
  return undefined;
}

function isDuplicateKeyError(
  err: unknown,
): err is { code: 11000; keyPattern?: object; keyValue?: object } {
  return typeof err === 'object' && err !== null && 'code' in err && err.code === 11000;
}

/**
 * Mongoose messages include the rejected value, so the client gets the kind of failure only.
 * @param kind - Mongoose validator kind, e.g. 'required', 'enum', 'maxlength'
 */
function mongooseFieldMessage(kind: string): string {
  return kind === 'required' ? 'Required' : `Invalid value (${kind})`;
}

/** Maps any thrown value to status, code, message and details. */
function normalize(err: unknown): NormalizedError {
  if (err instanceof ApiError) {
    return { status: err.statusCode, code: err.code, message: err.message, details: err.details };
  }

  if (err instanceof ZodError) {
    const details: FieldError[] = err.issues.map((issue) => ({
      field: issue.path.join('.'),
      message: issue.message,
    }));
    return { ...of(ERROR_CODES.VALIDATION_ERROR), message: 'Validation failed', details };
  }

  if (err instanceof mongoose.Error.ValidationError) {
    const details: FieldError[] = Object.values(err.errors).map((fieldError) => ({
      field: fieldError.path,
      message: mongooseFieldMessage(
        fieldError instanceof mongoose.Error.ValidatorError ? fieldError.kind : 'cast',
      ),
    }));
    return { ...of(ERROR_CODES.VALIDATION_ERROR), message: 'Validation failed', details };
  }

  if (err instanceof mongoose.Error.CastError) {
    return { ...of(ERROR_CODES.BAD_REQUEST), message: `Invalid ${err.path}` };
  }

  if (isDuplicateKeyError(err)) {
    const fields = Object.keys(err.keyPattern ?? err.keyValue ?? {});
    return { ...of(ERROR_CODES.CONFLICT), message: 'Duplicate value', details: { fields } };
  }

  const parserType = bodyParserType(err);
  if (parserType === 'entity.parse.failed') {
    return { ...of(ERROR_CODES.BAD_REQUEST), message: 'Malformed JSON' };
  }
  if (parserType === 'entity.too.large') {
    return { ...of(ERROR_CODES.PAYLOAD_TOO_LARGE), message: 'Request body is too large' };
  }
  if (parserType) {
    // Other body-parser failures (unsupported charset or encoding, aborted request).
    return { ...of(ERROR_CODES.BAD_REQUEST), message: 'Invalid request body' };
  }

  return {
    ...of(ERROR_CODES.INTERNAL_ERROR),
    message:
      config.isProd || !(err instanceof Error) ? 'Something went wrong' : err.message || 'Error',
  };
}

function of(code: ErrorCode): { status: number; code: ErrorCode } {
  return { status: ERROR_HTTP_STATUS[code], code };
}

/**
 * Last middleware: turns every error into the standard error body
 * `{ success: false, message, error: { code, details? }, requestId }` (+ `stack` in development).
 * Logs 5xx at error and 4xx at warn with the request id and `serializeError()`; never the body
 * or the query string.
 */
export const errorHandler: ErrorRequestHandler = (err, req, res, next) => {
  if (res.headersSent) {
    next(err);
    return;
  }

  const { status, code, message, details } = normalize(err);
  const id = getRequestId(req);

  const log = { requestId: id, method: req.method, path: req.path, status, code };
  if (status >= 500) {
    logger.error({ ...log, err: serializeError(err) }, 'Request failed');
  } else {
    logger.warn({ ...log, err: serializeError(err) }, 'Request rejected');
  }

  const body: ErrorBody = {
    success: false,
    message,
    error: details === undefined ? { code } : { code, details },
    requestId: id,
  };
  if (config.isDev && err instanceof Error && err.stack) body.stack = err.stack;

  res.status(status).json(body);
};
