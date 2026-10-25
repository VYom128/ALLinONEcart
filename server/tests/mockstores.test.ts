import { describe, expect, it } from 'vitest';
import { useMockstores } from './helpers/mockstores.js';

const mockstores = useMockstores();

describe('mockstores', () => {
  it('answers GET /__health', async () => {
    const res = await fetch(`${mockstores.url}/__health`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: 'ok' });
  });

  it('serves saved store pages as HTML', async () => {
    const res = await fetch(`${mockstores.url}/generic/example.html`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toMatch(/text\/html/);
    expect(await res.text()).toContain('Example Product');
  });

  it('returns 404 for missing pages and paths outside stores/', async () => {
    expect((await fetch(`${mockstores.url}/generic/missing.html`)).status).toBe(404);
    expect((await fetch(`${mockstores.url}/%2e%2e/package.json`)).status).toBe(404);
  });
});
