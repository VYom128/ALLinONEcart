import { describe, expect, it } from 'vitest';
import { api } from './helpers/testApp.js';

const agent = api();
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('request id', () => {
  it('echoes a valid incoming X-Request-Id', async () => {
    const res = await agent.get('/api/v1/health').set('X-Request-Id', 'trace_ABC-123');
    expect(res.headers['x-request-id']).toBe('trace_ABC-123');
  });

  it.each([
    ['too short', 'abc'],
    ['bad characters', 'has spaces & symbols!'],
    ['too long', 'a'.repeat(65)],
  ])('replaces an invalid incoming id (%s) with a UUID', async (_label, incoming) => {
    const res = await agent.get('/api/v1/health').set('X-Request-Id', incoming);
    expect(res.headers['x-request-id']).not.toBe(incoming);
    expect(res.headers['x-request-id']).toMatch(UUID);
  });

  it('generates a UUID when none is sent, and uses it in error bodies', async () => {
    const res = await agent.get('/api/v1/missing');
    expect(res.headers['x-request-id']).toMatch(UUID);
    expect(res.body.requestId).toBe(res.headers['x-request-id']);
  });
});
