import { describe, expect, it } from 'vitest';
import { ERROR_CODES } from '../src/config/constants.js';
import { expectErrorShape } from './helpers/errors.js';
import { api } from './helpers/testApp.js';

const agent = api();

describe('unknown routes', () => {
  it('returns 404 NOT_FOUND with the standard error shape', async () => {
    const res = await agent.get('/api/v1/does-not-exist');
    expectErrorShape(res, 404, ERROR_CODES.NOT_FOUND);
    expect(res.body.message).toBe('Route not found: GET /api/v1/does-not-exist');
  });

  it('leaves the query string out of the message', async () => {
    const res = await agent.post('/nowhere?token=abc123');
    expectErrorShape(res, 404, ERROR_CODES.NOT_FOUND);
    expect(res.body.message).toBe('Route not found: POST /nowhere');
  });
});
