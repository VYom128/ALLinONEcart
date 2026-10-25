import { Router } from 'express';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import type * as LoggerModule from '../src/utils/logger.js';

// Replace the silent test logger with one that records every line.
const captured = vi.hoisted(() => ({ lines: [] as string[] }));
vi.mock('../src/utils/logger.js', async (importOriginal) => {
  const original = await importOriginal<typeof LoggerModule>();
  const stream = { write: (line: string) => void captured.lines.push(line) };
  return { ...original, logger: original.createLogger({ level: 'trace' }, stream) };
});

const { validate } = await import('../src/middlewares/validate.js');
const { api } = await import('./helpers/testApp.js');

const SECRETS = {
  password: 'hunter2-Sup3rSecret',
  phone: '+919876543210',
  query: 'query-secret-value',
  token: 'tok_live_abcdef123456',
};

const routes = Router();
routes.post(
  '/test/login',
  validate({ body: z.object({ phone: z.string(), password: z.string().min(50) }) }),
  (_req, res) => {
    res.json({ ok: true });
  },
);
routes.post('/test/crash', () => {
  throw new Error('crash');
});

const agent = api(routes);

describe('logging', () => {
  it('never logs bodies, phone numbers, passwords, tokens or query strings', async () => {
    const body = { phone: SECRETS.phone, password: SECRETS.password };

    await agent.post(`/test/login?q=${SECRETS.query}`).send(body); // 400 → warn
    await agent.post(`/test/crash?q=${SECRETS.query}`).send(body); // 500 → error
    await agent
      .post(`/api/v1/missing?q=${SECRETS.query}`)
      .set('Authorization', `Bearer ${SECRETS.token}`)
      .set('Cookie', `session=${SECRETS.token}`)
      .send(body); // 404 → warn

    const output = captured.lines.join('');
    // The requests were logged...
    expect(output).toContain('"path":"/test/login"');
    expect(output).toContain('"path":"/test/crash"');
    expect(output).toContain('"code":"VALIDATION_ERROR"');
    // ...without any of the sensitive values.
    for (const secret of Object.values(SECRETS)) {
      expect(output).not.toContain(secret);
    }
    expect(output).not.toContain('9876543210');
    expect(output).not.toContain('?q=');
  });
});
