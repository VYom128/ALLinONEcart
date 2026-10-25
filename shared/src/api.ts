// Response bodies of the REST API (spec §7.1) and the health payload (spec §7.2).

/** Successful response: `{ success: true, message, data, meta? }`. */
export interface ApiSuccess<T> {
  success: true;
  message: string;
  data: T;
  meta?: Record<string, unknown>;
}

/** One validation problem: `{ field: 'body.title', message }`. */
export interface ApiFieldError {
  field: string;
  message: string;
}

/** Failed response: `{ success: false, message, error: { code, details? }, requestId }`. */
export interface ApiFailure {
  success: false;
  message: string;
  error: {
    /** One of the server's ERROR_CODES (spec §16). */
    code: string;
    details?: unknown;
  };
  requestId?: string;
}

export type ApiBody<T> = ApiSuccess<T> | ApiFailure;

export type DbStatus = 'connected' | 'disconnected' | 'connecting' | 'disconnecting';
export type RedisStatus = 'connected' | 'connecting' | 'disconnected';

/** `data` of GET /api/v1/health. */
export interface HealthData {
  status: 'ok';
  /** Seconds since the API process started. */
  uptime: number;
  /** Server time, ISO 8601 UTC. */
  timestamp: string;
  db: DbStatus;
  redis: RedisStatus;
}
