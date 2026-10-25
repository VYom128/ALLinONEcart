import { describe, it } from 'vitest';
import { ERROR_CODES } from '../src/config/constants.js';
import { expectErrorShape } from './helpers/errors.js';
import { api } from './helpers/testApp.js';

const agent = api();

describe('payload too large', () => {
  it('returns 413 PAYLOAD_TOO_LARGE for a JSON body over 1 MB', async () => {
    const res = await agent
      .post('/api/v1/health')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ blob: 'x'.repeat(1024 * 1024 + 10) }));
    expectErrorShape(res, 413, ERROR_CODES.PAYLOAD_TOO_LARGE);
  });

  it('accepts a body just under the limit', async () => {
    const res = await agent
      .post('/api/v1/health')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ blob: 'x'.repeat(1024 * 1024 - 100) }));
    // No POST /health route: getting past the body parser means a 404, not a 413.
    expectErrorShape(res, 404, ERROR_CODES.NOT_FOUND);
  });
});
