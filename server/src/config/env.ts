import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { z } from 'zod';

// server/.env, resolved from this file so it works from src/ (tsx) and dist/ (node) alike.
dotenv.config({ path: fileURLToPath(new URL('../../.env', import.meta.url)), quiet: true });

/** Empty strings count as "not set", so `MONGO_URI=` behaves like a missing variable. */
const optionalString = z
  .string()
  .trim()
  .optional()
  .transform((value) => value || undefined);

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(5001),
  MONGO_URI: optionalString.refine((v) => v === undefined || /^mongodb(\+srv)?:\/\//.test(v), {
    message: 'Must start with mongodb:// or mongodb+srv://',
  }),
  REDIS_URL: optionalString.refine((v) => v === undefined || /^rediss?:\/\//.test(v), {
    message: 'Must start with redis:// or rediss://',
  }),
  CLIENT_URLS: z
    .string()
    .default('http://localhost:5173')
    .transform((value) =>
      value
        .split(',')
        .map((url) => url.trim())
        .filter(Boolean),
    )
    .pipe(z.array(z.url({ message: 'Must be a comma-separated list of URLs' }))),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(900_000),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(300),
});

/** Required everywhere except tests (which use an in-memory replica set and ioredis-mock). */
const REQUIRED_OUTSIDE_TEST = ['MONGO_URI', 'REDIS_URL'] as const;

/** Validated, typed server configuration. */
export interface Config {
  readonly nodeEnv: 'development' | 'test' | 'production';
  readonly isDev: boolean;
  readonly isTest: boolean;
  readonly isProd: boolean;
  readonly port: number;
  /** Always set outside tests (validated); tests use an in-memory replica set instead. */
  readonly mongoUri: string | undefined;
  /** Always set outside tests (validated); tests use ioredis-mock instead. */
  readonly redisUrl: string | undefined;
  readonly clientUrls: readonly string[];
  readonly logLevel: 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace' | 'silent';
  readonly rateLimit: { readonly windowMs: number; readonly max: number };
}

export type ParseEnvResult = { ok: true; config: Config } | { ok: false; errors: string[] };

/**
 * Validates an environment object and builds the frozen config.
 * Error lines contain variable names and reasons only, never the values.
 * @param source - usually `process.env`; tests pass their own object.
 */
export function parseEnv(source: NodeJS.ProcessEnv): ParseEnvResult {
  const result = envSchema.safeParse(source);
  const errors = result.success
    ? []
    : result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`);

  // Checked here rather than in a schema refinement: Zod skips object refinements once any
  // field fails, and every invalid variable should be reported in one go.
  if ((source.NODE_ENV ?? 'development') !== 'test') {
    for (const key of REQUIRED_OUTSIDE_TEST) {
      if (!source[key]?.trim()) errors.push(`${key}: Required unless NODE_ENV=test`);
    }
  }

  if (!result.success || errors.length > 0) return { ok: false, errors };

  const env = result.data;
  const config: Config = Object.freeze({
    nodeEnv: env.NODE_ENV,
    isDev: env.NODE_ENV === 'development',
    isTest: env.NODE_ENV === 'test',
    isProd: env.NODE_ENV === 'production',
    port: env.PORT,
    mongoUri: env.MONGO_URI,
    redisUrl: env.REDIS_URL,
    clientUrls: Object.freeze([...env.CLIENT_URLS]),
    logLevel: env.LOG_LEVEL,
    rateLimit: Object.freeze({ windowMs: env.RATE_LIMIT_WINDOW_MS, max: env.RATE_LIMIT_MAX }),
  });
  return { ok: true, config };
}

/**
 * Loads the config from `process.env`, or prints the invalid variables and exits with code 1.
 * Writes to stderr directly because the logger itself depends on this config.
 */
function loadConfig(): Config {
  const result = parseEnv(process.env);
  if (result.ok) return result.config;

  process.stderr.write(
    `Invalid environment configuration (see server/.env.example):\n${result.errors
      .map((line) => `  - ${line}`)
      .join('\n')}\n`,
  );
  process.exit(1);
}

/** The only place server code reads configuration from. Never read `process.env` elsewhere. */
export const config: Config = loadConfig();
