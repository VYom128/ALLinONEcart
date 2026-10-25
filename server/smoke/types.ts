/** A response as seen by smoke checks. */
export interface SmokeResponse {
  status: number;
  headers: Headers;
  // Parsed JSON body (smoke checks assert on its shape).
  body: any; // eslint-disable-line @typescript-eslint/no-explicit-any
}

/** What every check gets: the API base URL and a small JSON request helper. */
export interface SmokeContext {
  /** e.g. http://127.0.0.1:5001/api/v1 */
  baseUrl: string;
  request: (path: string, init?: RequestInit) => Promise<SmokeResponse>;
}

/** One smoke check. `run` throws (e.g. via `assert`) to fail. */
export interface SmokeCheck {
  name: string;
  run: (ctx: SmokeContext) => Promise<void>;
}
