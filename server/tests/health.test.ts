import { describe, expect, it } from 'vitest';
import { api } from './helpers/testApp.js';

const agent = api();

describe('GET /api/v1/health', () => {
  it('returns 200 with status, uptime, timestamp, db and redis', async () => {
    const res = await agent.get('/api/v1/health');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, message: 'OK' });
    expect(res.body.data.status).toBe('ok');
    expect(res.body.data.db).toBe('connected');
    expect(['connected', 'connecting', 'disconnected']).toContain(res.body.data.redis);
    expect(typeof res.body.data.uptime).toBe('number');
    expect(new Date(res.body.data.timestamp).toISOString()).toBe(res.body.data.timestamp);
    expect(res.body).not.toHaveProperty('meta');
  });

  it('sets the X-Request-Id header', async () => {
    const res = await agent.get('/api/v1/health');
    expect(res.headers['x-request-id']).toMatch(/^[A-Za-z0-9_-]{8,64}$/);
  });
});
