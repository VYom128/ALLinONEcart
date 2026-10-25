import type { Response } from 'supertest';
import { expect } from 'vitest';
import type { ErrorCode } from '../../src/config/constants.js';

/**
 * Asserts the full standard error body (spec §7.1):
 * `{ success: false, message, error: { code, details? }, requestId }`, and that `requestId`
 * matches the X-Request-Id header.
 * @param res - supertest response
 * @param status - expected HTTP status
 * @param code - expected `error.code`
 */
export function expectErrorShape(res: Response, status: number, code: ErrorCode): void {
  expect(res.status).toBe(status);
  expect(res.headers['content-type']).toMatch(/application\/json/);
  expect(res.body).toMatchObject({ success: false, error: { code } });
  expect(typeof res.body.message).toBe('string');
  expect(res.body.message.length).toBeGreaterThan(0);
  expect(typeof res.body.requestId).toBe('string');
  expect(res.body.requestId).toBe(res.headers['x-request-id']);
  expect(
    Object.keys(res.body)
      .filter((key) => key !== 'stack')
      .sort(),
  ).toEqual(['error', 'message', 'requestId', 'success']);
}
