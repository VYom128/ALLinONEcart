import { pino, type DestinationStream, type Logger, type LoggerOptions } from 'pino';
import { config } from '../config/env.js';

const SECRET_KEYS = ['password', 'token', 'accessToken', 'refreshToken', 'otp', 'otpCode', 'phone'];

/**
 * Paths Pino replaces with "[Redacted]" (spec §11.6). Pino wildcards match one level only, so
 * each key is listed both at the top level and one level down. Bodies are never logged at all;
 * the body paths are a safety net. `*.code` is not redacted: it would also hide error codes.
 */
export const REDACT_PATHS: readonly string[] = [
  'req.headers.authorization',
  'req.headers.cookie',
  'res.headers["set-cookie"]',
  'req.body',
  'res.body',
  ...SECRET_KEYS,
  ...SECRET_KEYS.map((key) => `*.${key}`),
];

/** A logged error: only these fields, never the raw error object. */
export interface SerializedError {
  name: string;
  message: string;
  stack?: string;
  code?: string | number;
}

/** Mongo and Mongoose put the offending values into these messages, so they are replaced. */
function safeMessage(err: Error & { code?: unknown; path?: unknown; errors?: unknown }): string {
  if (err.code === 11000) return 'Duplicate key error';
  if (err.name === 'CastError') return `Cast failed for path "${String(err.path)}"`;
  if (err.name === 'ValidationError' && err.errors && typeof err.errors === 'object') {
    return `Validation failed for: ${Object.keys(err.errors).join(', ')}`;
  }
  return err.message;
}

/**
 * Turns anything thrown into a small, log-safe object: `{ name, message, stack, code? }`.
 * Raw errors can carry request bodies or values, so they are never logged directly.
 * @param err - any thrown value
 */
export function serializeError(err: unknown): SerializedError {
  if (!(err instanceof Error)) {
    return { name: 'NonError', message: `Non-error value thrown (${typeof err})` };
  }

  const withCode = err as Error & { code?: unknown };
  const message = safeMessage(withCode);
  let stack = err.stack;
  if (stack && message !== err.message) {
    // The first line of the stack repeats the original message; keep only the frames.
    const frames = stack.indexOf('\n    at ');
    stack = frames === -1 ? undefined : `${err.name}: ${message}${stack.slice(frames)}`;
  }

  const serialized: SerializedError = { name: err.name, message };
  if (stack) serialized.stack = stack;
  if (typeof withCode.code === 'string' || typeof withCode.code === 'number') {
    serialized.code = withCode.code;
  }
  return serialized;
}

/**
 * Logger serializer for `err` / `error` keys: serializes raw errors, and passes through values
 * that already went through {@link serializeError} (callers are asked to call it explicitly).
 */
function errSerializer(value: unknown): SerializedError {
  if (
    !(value instanceof Error) &&
    typeof value === 'object' &&
    value !== null &&
    typeof (value as SerializedError).name === 'string' &&
    typeof (value as SerializedError).message === 'string'
  ) {
    return value as SerializedError;
  }
  return serializeError(value);
}

/**
 * Creates a Pino logger with the app's redaction and error serializer.
 * @param options - level and whether to pretty-print (pino-pretty)
 * @param destination - optional stream; tests pass one to capture output
 */
export function createLogger(
  options: { level: LoggerOptions['level']; pretty?: boolean },
  destination?: DestinationStream,
): Logger {
  const loggerOptions: LoggerOptions = {
    level: options.level,
    redact: { paths: [...REDACT_PATHS], censor: '[Redacted]' },
    serializers: { err: errSerializer, error: errSerializer },
  };
  if (options.pretty && !destination) {
    loggerOptions.transport = {
      target: 'pino-pretty',
      options: { colorize: true, translateTime: 'SYS:HH:MM:ss.l', ignore: 'pid,hostname' },
    };
  }
  return destination ? pino(loggerOptions, destination) : pino(loggerOptions);
}

/**
 * The app logger. Development: pretty, production: JSON, test: silent.
 * Use this, never `console`.
 */
export const logger: Logger = createLogger({
  level: config.isTest ? 'silent' : config.logLevel,
  pretty: config.isDev,
});
