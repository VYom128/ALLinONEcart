import assert from 'node:assert/strict';
import type { SmokeCheck } from '../types.js';

/** Phase 0: health, the standard 404 and request ids (spec §15.3). */
export const phase0Checks: SmokeCheck[] = [
  {
    name: 'GET /health is ok with db and redis connected',
    async run({ request }) {
      const res = await request('/health');
      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.status, 'ok');
      assert.equal(res.body.data.db, 'connected', `db is ${res.body.data.db}`);
      assert.equal(res.body.data.redis, 'connected', `redis is ${res.body.data.redis}`);
    },
  },
  {
    name: 'unknown route returns the standard 404 with a requestId',
    async run({ request }) {
      const res = await request('/smoke-does-not-exist');
      assert.equal(res.status, 404);
      assert.equal(res.body.success, false);
      assert.equal(res.body.error.code, 'NOT_FOUND');
      assert.equal(typeof res.body.message, 'string');
      assert.equal(typeof res.body.requestId, 'string');
      assert.equal(res.body.requestId, res.headers.get('x-request-id'));
    },
  },
  {
    name: 'X-Request-Id is echoed',
    async run({ request }) {
      const id = `smoke-${Date.now()}`;
      const res = await request('/health', { headers: { 'X-Request-Id': id } });
      assert.equal(res.headers.get('x-request-id'), id);
    },
  },
];
