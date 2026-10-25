import { describe, expect, it } from 'vitest';
import { parseEnv } from '../../src/config/env.js';

const VALID = {
  NODE_ENV: 'development',
  MONGO_URI: 'mongodb://localhost:27018/allinone?replicaSet=rs0&directConnection=true',
  REDIS_URL: 'redis://localhost:6379',
};

describe('parseEnv', () => {
  it('builds a frozen config with defaults', () => {
    const result = parseEnv(VALID);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.config).toMatchObject({
      nodeEnv: 'development',
      isDev: true,
      isTest: false,
      isProd: false,
      port: 5001,
      clientUrls: ['http://localhost:5173'],
      logLevel: 'info',
      rateLimit: { windowMs: 900_000, max: 300 },
    });
    expect(Object.isFrozen(result.config)).toBe(true);
    expect(Object.isFrozen(result.config.clientUrls)).toBe(true);
  });

  it('parses CLIENT_URLS as a comma-separated list', () => {
    const result = parseEnv({ ...VALID, CLIENT_URLS: 'http://a.test, https://b.test' });
    expect(result.ok && result.config.clientUrls).toEqual(['http://a.test', 'https://b.test']);
  });

  it('fails with the variable name only when MONGO_URI is missing outside test', () => {
    const secretPassword = 'redis-pass-SECRET';
    const result = parseEnv({
      NODE_ENV: 'production',
      REDIS_URL: `redis://user:${secretPassword}@localhost:6379`,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors).toEqual(['MONGO_URI: Required unless NODE_ENV=test']);
    expect(result.errors.join('\n')).not.toContain(secretPassword);
  });

  it('reports every invalid variable at once, without values', () => {
    const result = parseEnv({
      NODE_ENV: 'production',
      PORT: 'abc',
      MONGO_URI: 'postgres://x:pw-SECRET@h',
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    const names = result.errors.map((line) => line.split(':')[0]);
    expect(names).toEqual(expect.arrayContaining(['PORT', 'MONGO_URI', 'REDIS_URL']));
    expect(result.errors.join('\n')).not.toContain('pw-SECRET');
  });

  it('does not require MONGO_URI or REDIS_URL in test', () => {
    expect(parseEnv({ NODE_ENV: 'test' }).ok).toBe(true);
  });

  it('rejects an unknown NODE_ENV or LOG_LEVEL', () => {
    expect(parseEnv({ ...VALID, NODE_ENV: 'staging' }).ok).toBe(false);
    expect(parseEnv({ ...VALID, LOG_LEVEL: 'loud' }).ok).toBe(false);
  });
});
