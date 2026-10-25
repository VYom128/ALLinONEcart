import { Router } from 'express';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { ERROR_CODES } from '../src/config/constants.js';
import { validate } from '../src/middlewares/validate.js';
import { expectErrorShape } from './helpers/errors.js';
import { api } from './helpers/testApp.js';

const routes = Router();
routes.post(
  '/test/people',
  validate({ body: z.object({ name: z.string().min(2), age: z.number().int().positive() }) }),
  (req, res) => {
    res.json({ body: req.body });
  },
);
routes.get(
  '/test/search',
  validate({ query: z.object({ q: z.string().min(1), limit: z.coerce.number().int().max(50) }) }),
  (req, res) => {
    res.json({ query: req.query });
  },
);
routes.get(
  '/test/people/:id',
  validate({ params: z.object({ id: z.string().regex(/^[a-f0-9]{24}$/) }) }),
  (req, res) => {
    res.json({ params: req.params });
  },
);

const agent = api(routes);

describe('validate()', () => {
  it('rejects an invalid body with 400 VALIDATION_ERROR and details for both fields', async () => {
    const res = await agent.post('/test/people').send({ name: 'A', age: -3 });

    expectErrorShape(res, 400, ERROR_CODES.VALIDATION_ERROR);
    const fields = res.body.error.details.map((d: { field: string }) => d.field).sort();
    expect(fields).toEqual(['body.age', 'body.name']);
    for (const detail of res.body.error.details) {
      expect(typeof detail.message).toBe('string');
    }
  });

  it('reports a missing body field', async () => {
    const res = await agent.post('/test/people').send({ name: 'Asha' });
    expectErrorShape(res, 400, ERROR_CODES.VALIDATION_ERROR);
    expect(res.body.error.details).toEqual([{ field: 'body.age', message: expect.any(String) }]);
  });

  it('replaces req.body with the parsed value and strips unknown fields', async () => {
    const res = await agent.post('/test/people').send({ name: 'Asha', age: 30, role: 'admin' });
    expect(res.status).toBe(200);
    expect(res.body.body).toEqual({ name: 'Asha', age: 30 });
  });

  it('validates and coerces the query', async () => {
    const ok = await agent.get('/test/search?q=shoes&limit=10&extra=1');
    expect(ok.status).toBe(200);
    expect(ok.body.query).toEqual({ q: 'shoes', limit: 10 });

    const bad = await agent.get('/test/search?limit=500');
    expectErrorShape(bad, 400, ERROR_CODES.VALIDATION_ERROR);
    const fields = bad.body.error.details.map((d: { field: string }) => d.field).sort();
    expect(fields).toEqual(['query.limit', 'query.q']);
  });

  it('validates params', async () => {
    const bad = await agent.get('/test/people/not-an-id');
    expectErrorShape(bad, 400, ERROR_CODES.VALIDATION_ERROR);
    expect(bad.body.error.details[0].field).toBe('params.id');

    const ok = await agent.get('/test/people/64b7f0c2a1b2c3d4e5f60718');
    expect(ok.status).toBe(200);
  });
});
