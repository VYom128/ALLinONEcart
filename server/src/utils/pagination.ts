import { ApiError } from './ApiError.js';

export const DEFAULT_PAGE_LIMIT = 20;
export const MAX_PAGE_LIMIT = 100;

/** Page pagination for the admin panel (`?page=&limit=`). */
export interface PageParams {
  page: number;
  limit: number;
  skip: number;
}

function toPositiveInt(value: unknown): number | undefined {
  const n = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  return typeof n === 'number' && Number.isInteger(n) && n > 0 ? n : undefined;
}

/**
 * Reads `page` and `limit` from a query object. Missing or invalid values fall back to the
 * defaults (page 1, limit 20); limit is capped at 100.
 * @param query - `req.query` or an already-validated object
 */
export function parsePagination(query: { page?: unknown; limit?: unknown }): PageParams {
  const page = toPositiveInt(query.page) ?? 1;
  const limit = Math.min(toPositiveInt(query.limit) ?? DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT);
  return { page, limit, skip: (page - 1) * limit };
}

/** Position in a user-facing feed: the sort date and the document id as a tie-breaker. */
export interface Cursor {
  date: Date;
  id: string;
}

const OBJECT_ID = /^[a-f0-9]{24}$/i;

/**
 * Encodes a feed position as an opaque base64url string of `"<isoDate>|<id>"`.
 * @param cursor - sort date and ObjectId (hex string)
 */
export function encodeCursor({ date, id }: Cursor): string {
  return Buffer.from(`${date.toISOString()}|${id}`, 'utf8').toString('base64url');
}

/**
 * Decodes a cursor from `?cursor=`. Throws 400 BAD_REQUEST "Invalid cursor" if it was not
 * produced by {@link encodeCursor}.
 * @param cursor - the opaque string sent by the client
 */
export function decodeCursor(cursor: string): Cursor {
  const [iso, id, ...rest] = Buffer.from(cursor, 'base64url').toString('utf8').split('|');
  const date = new Date(iso ?? '');
  if (rest.length > 0 || !id || !OBJECT_ID.test(id) || Number.isNaN(date.getTime())) {
    throw ApiError.badRequest('Invalid cursor');
  }
  if (date.toISOString() !== iso) throw ApiError.badRequest('Invalid cursor');
  return { date, id };
}
