import type { FetchBaseQueryError } from '@reduxjs/toolkit/query';
import { normalizeError } from '../normalizeError';

const withRequestId = (id: string) => new Response(null, { headers: { 'X-Request-Id': id } });

describe('normalizeError', () => {
  it('turns a network failure into status 0 NETWORK_ERROR', () => {
    const error: FetchBaseQueryError = {
      status: 'FETCH_ERROR',
      error: 'TypeError: Network request failed',
    };
    expect(normalizeError(error)).toEqual({
      status: 0,
      code: 'NETWORK_ERROR',
      message: "Can't reach the server",
    });
  });

  it('turns a timeout into status 0 TIMEOUT', () => {
    const error: FetchBaseQueryError = { status: 'TIMEOUT_ERROR', error: 'AbortError' };
    expect(normalizeError(error)).toMatchObject({ status: 0, code: 'TIMEOUT' });
  });

  it('reads the standard API error body', () => {
    const error: FetchBaseQueryError = {
      status: 400,
      data: {
        success: false,
        message: 'Validation failed',
        error: {
          code: 'VALIDATION_ERROR',
          details: [{ field: 'body.title', message: 'Required' }],
        },
        requestId: 'req-12345678',
      },
    };
    expect(normalizeError(error)).toEqual({
      status: 400,
      code: 'VALIDATION_ERROR',
      message: 'Validation failed',
      details: [{ field: 'body.title', message: 'Required' }],
      requestId: 'req-12345678',
    });
  });

  it('leaves details out when the server sent none', () => {
    const error: FetchBaseQueryError = {
      status: 404,
      data: {
        success: false,
        message: 'Not found',
        error: { code: 'NOT_FOUND' },
        requestId: 'r-1',
      },
    };
    expect(normalizeError(error)).not.toHaveProperty('details');
  });

  it('falls back to the X-Request-Id header', () => {
    const error: FetchBaseQueryError = {
      status: 500,
      data: { success: false, message: 'Something went wrong', error: { code: 'INTERNAL_ERROR' } },
    };
    expect(normalizeError(error, withRequestId('hdr-1234567')).requestId).toBe('hdr-1234567');
  });

  it('handles a non-JSON response', () => {
    const error: FetchBaseQueryError = {
      status: 'PARSING_ERROR',
      originalStatus: 502,
      data: '<html>Bad gateway</html>',
      error: 'SyntaxError',
    };
    expect(normalizeError(error, withRequestId('hdr-7654321'))).toEqual({
      status: 502,
      code: 'BAD_RESPONSE',
      message: 'Unexpected response from the server',
      requestId: 'hdr-7654321',
    });
  });

  it('handles an HTTP error whose body is not the standard shape', () => {
    const error: FetchBaseQueryError = { status: 503, data: { oops: true } };
    expect(normalizeError(error)).toEqual({
      status: 503,
      code: 'HTTP_ERROR',
      message: 'Request failed (503)',
    });
  });
});
