import { describe, expect, it } from 'vitest';
import { ERROR_CODES } from '../src/config/constants.js';
import { expectErrorShape } from './helpers/errors.js';
import { api } from './helpers/testApp.js';

const agent = api();

describe('malformed JSON', () => {
  it('returns 400 BAD_REQUEST "Malformed JSON"', async () => {
    const res = await agent
      .post('/api/v1/health')
      .set('Content-Type', 'application/json')
      .send('{"name": "Asha",');
    expectErrorShape(res, 400, ERROR_CODES.BAD_REQUEST);
    expect(res.body.message).toBe('Malformed JSON');
  });
});
