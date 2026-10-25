import {
  createApi,
  fetchBaseQuery,
  type BaseQueryFn,
  type FetchArgs,
} from '@reduxjs/toolkit/query/react';
import { API_URL } from '@/config/env';
import { normalizeError, type AppError } from './normalizeError';

const REQUEST_TIMEOUT_MS = 15_000;

const rawBaseQuery = fetchBaseQuery({
  baseUrl: API_URL,
  timeout: REQUEST_TIMEOUT_MS,
  prepareHeaders: (headers) => {
    headers.set('Accept', 'application/json');
    return headers;
  },
});

/** fetchBaseQuery with every error normalised to {@link AppError}. */
const baseQuery: BaseQueryFn<string | FetchArgs, unknown, AppError> = async (
  args,
  api,
  extraOptions,
) => {
  const result = await rawBaseQuery(args, api, extraOptions);
  if (result.error) {
    return { error: normalizeError(result.error, result.meta?.response), meta: result.meta };
  }
  return result;
};

/**
 * The one RTK Query API. Features add endpoints with `api.injectEndpoints()` in their own
 * `features/<feature>/api.ts`. All server data goes through here.
 */
export const api = createApi({
  reducerPath: 'api',
  baseQuery,
  tagTypes: [],
  endpoints: () => ({}),
});
