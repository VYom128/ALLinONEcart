import type { FetchBaseQueryError } from '@reduxjs/toolkit/query';
import type { ApiFailure } from '@allinone/shared';

/** Every failed request, whatever went wrong, ends up in this shape. */
export interface AppError {
  /** HTTP status, or 0 when no response arrived (network error, timeout). */
  status: number;
  /** Safe to show to the user. */
  message: string;
  /** Server ERROR_CODES value, or NETWORK_ERROR / TIMEOUT / BAD_RESPONSE / HTTP_ERROR / UNKNOWN. */
  code: string;
  details?: unknown;
  requestId?: string;
}

function isApiFailure(data: unknown): data is ApiFailure {
  if (typeof data !== 'object' || data === null) return false;
  const body = data as Partial<ApiFailure>;
  return (
    body.success === false &&
    typeof body.message === 'string' &&
    typeof body.error === 'object' &&
    body.error !== null &&
    typeof body.error.code === 'string'
  );
}

/**
 * Turns an RTK Query fetch error into an {@link AppError}.
 * @param error - the error from fetchBaseQuery
 * @param response - the HTTP response, when one arrived (for the X-Request-Id header)
 */
export function normalizeError(error: FetchBaseQueryError, response?: Response): AppError {
  const headerRequestId = response?.headers.get('x-request-id') ?? undefined;

  switch (error.status) {
    case 'FETCH_ERROR':
      return { status: 0, code: 'NETWORK_ERROR', message: "Can't reach the server" };
    case 'TIMEOUT_ERROR':
      return { status: 0, code: 'TIMEOUT', message: 'The server took too long to respond' };
    case 'PARSING_ERROR':
      return {
        status: error.originalStatus,
        code: 'BAD_RESPONSE',
        message: 'Unexpected response from the server',
        ...(headerRequestId ? { requestId: headerRequestId } : {}),
      };
    case 'CUSTOM_ERROR':
      return { status: 0, code: 'UNKNOWN', message: 'Something went wrong' };
    default: {
      if (isApiFailure(error.data)) {
        const requestId = error.data.requestId ?? headerRequestId;
        return {
          status: error.status,
          code: error.data.error.code,
          message: error.data.message,
          ...(error.data.error.details !== undefined ? { details: error.data.error.details } : {}),
          ...(requestId ? { requestId } : {}),
        };
      }
      return {
        status: error.status,
        code: 'HTTP_ERROR',
        message: `Request failed (${error.status})`,
        ...(headerRequestId ? { requestId: headerRequestId } : {}),
      };
    }
  }
}
