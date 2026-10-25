import { Router } from 'express';
import { describe, expect, it } from 'vitest';
import { ERROR_CODES } from '../src/config/constants.js';
import { createRateLimiter } from '../src/middlewares/rateLimiters.js';
import { expectErrorShape } from './helpers/errors.js';
import { api } from './helpers/testApp.js';

const routes = Router();
routes.get('/test/limited', createRateLimiter({ windowMs: 60_000, max: 2 }), (_req, res) => {
  res.json({ ok: true });
});

const agent = api(routes);

describe('createRateLimiter', () => {
  it('allows max requests, then responds 429 RATE_LIMITED with retryAfterSeconds', async () => {
    expect((await agent.get('/test/limited')).status).toBe(200);
    expect((await agent.get('/test/limited')).status).toBe(200);

    const res = await agent.get('/test/limited');
    expectErrorShape(res, 429, ERROR_CODES.RATE_LIMITED);
    expect(res.body.error.details.retryAfterSeconds).toBeGreaterThan(0);
    expect(res.body.error.details.retryAfterSeconds).toBeLessThanOrEqual(60);
  });

  it('does not limit the API in tests (apiLimiter is skipped)', async () => {
    for (let i = 0; i < 5; i += 1) {
      expect((await agent.get('/api/v1/health')).status).toBe(200);
    }
  });
});
