import { describe, expect, it } from 'vitest';
import { ApiError } from '../../src/utils/ApiError.js';
import { decodeCursor, encodeCursor, parsePagination } from '../../src/utils/pagination.js';

describe('parsePagination', () => {
  it('uses page 1 and limit 20 by default', () => {
    expect(parsePagination({})).toEqual({ page: 1, limit: 20, skip: 0 });
  });

  it('reads string values and computes skip', () => {
    expect(parsePagination({ page: '3', limit: '25' })).toEqual({ page: 3, limit: 25, skip: 50 });
  });

  it('caps limit at 100', () => {
    expect(parsePagination({ limit: '500' }).limit).toBe(100);
  });

  it('falls back to defaults for invalid values', () => {
    expect(parsePagination({ page: '-1', limit: 'abc' })).toEqual({ page: 1, limit: 20, skip: 0 });
    expect(parsePagination({ page: '1.5', limit: '0' })).toEqual({ page: 1, limit: 20, skip: 0 });
  });
});

describe('cursors', () => {
  const cursor = { date: new Date('2026-10-25T08:00:00.000Z'), id: '64b7f0c2a1b2c3d4e5f60718' };

  it('round-trips date and id', () => {
    const encoded = encodeCursor(cursor);
    expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/); // opaque base64url
    expect(decodeCursor(encoded)).toEqual(cursor);
  });

  it.each([
    ['not base64 data', 'garbage'],
    ['bad date', Buffer.from('nope|64b7f0c2a1b2c3d4e5f60718').toString('base64url')],
    ['bad id', Buffer.from('2026-10-25T08:00:00.000Z|xyz').toString('base64url')],
    [
      'extra part',
      Buffer.from('2026-10-25T08:00:00.000Z|64b7f0c2a1b2c3d4e5f60718|x').toString('base64url'),
    ],
  ])('rejects a cursor with %s as 400 BAD_REQUEST', (_label, value) => {
    expect(() => decodeCursor(value)).toThrow(ApiError);
    try {
      decodeCursor(value);
    } catch (err) {
      expect((err as ApiError).statusCode).toBe(400);
      expect((err as ApiError).code).toBe('BAD_REQUEST');
    }
  });
});
