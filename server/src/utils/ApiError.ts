import { ERROR_CODES, ERROR_HTTP_STATUS, type ErrorCode } from '../config/constants.js';

/**
 * An expected failure that the error handler turns into the standard error body
 * `{ success: false, message, error: { code, details }, requestId }`.
 */
export class ApiError extends Error {
  /** Marks errors we threw on purpose (as opposed to bugs). */
  readonly isOperational = true;

  /**
   * @param statusCode - HTTP status, normally `ERROR_HTTP_STATUS[code]`
   * @param message - safe for the client; never include secrets or user text
   * @param code - one of `ERROR_CODES`
   * @param details - optional structured details, e.g. `[{ field, message }]`
   */
  constructor(
    readonly statusCode: number,
    message: string,
    readonly code: ErrorCode,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  /** 400 BAD_REQUEST – malformed input, bad id. */
  static badRequest(message: string, details?: unknown): ApiError {
    return ApiError.of(ERROR_CODES.BAD_REQUEST, message, details);
  }

  /** 401 UNAUTHORIZED – missing, invalid or expired access token. */
  static unauthorized(message: string, details?: unknown): ApiError {
    return ApiError.of(ERROR_CODES.UNAUTHORIZED, message, details);
  }

  /** 403 FORBIDDEN – the role is not allowed. Another user's record is a 404, not this. */
  static forbidden(message: string, details?: unknown): ApiError {
    return ApiError.of(ERROR_CODES.FORBIDDEN, message, details);
  }

  /** 404 NOT_FOUND – missing, or owned by another user. */
  static notFound(message: string, details?: unknown): ApiError {
    return ApiError.of(ERROR_CODES.NOT_FOUND, message, details);
  }

  /** 409 CONFLICT – duplicate key, version conflict. */
  static conflict(message: string, details?: unknown): ApiError {
    return ApiError.of(ERROR_CODES.CONFLICT, message, details);
  }

  /** 422 BUSINESS_RULE_VIOLATION – a generic business rule failed. */
  static unprocessable(message: string, details?: unknown): ApiError {
    return ApiError.of(ERROR_CODES.BUSINESS_RULE_VIOLATION, message, details);
  }

  /** 429 RATE_LIMITED – pass `{ retryAfterSeconds }` as details. */
  static tooManyRequests(message: string, details?: unknown): ApiError {
    return ApiError.of(ERROR_CODES.RATE_LIMITED, message, details);
  }

  /** 500 INTERNAL_ERROR – unexpected failure (message hidden in production). */
  static internal(message: string, details?: unknown): ApiError {
    return ApiError.of(ERROR_CODES.INTERNAL_ERROR, message, details);
  }

  /** 503 SERVICE_UNAVAILABLE – database, Redis or an upstream is down. */
  static serviceUnavailable(message: string, details?: unknown): ApiError {
    return ApiError.of(ERROR_CODES.SERVICE_UNAVAILABLE, message, details);
  }

  /**
   * Builds an ApiError for any code, with the status taken from `ERROR_HTTP_STATUS`.
   * Use it for codes without a helper, e.g. `ApiError.of(ERROR_CODES.DUPLICATE_ITEM, '…')`.
   */
  static of(code: ErrorCode, message: string, details?: unknown): ApiError {
    return new ApiError(ERROR_HTTP_STATUS[code], message, code, details);
  }
}
