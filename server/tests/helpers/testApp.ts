import { createServer } from 'node:http';
import type { RequestHandler } from 'express';
import supertest from 'supertest';
import { afterAll, beforeAll } from 'vitest';
import { createApp } from '../../src/app.js';

/**
 * Builds the app (with optional test-only routes) and returns a supertest agent for it.
 * The server listens on 127.0.0.1 for the whole file and closes in afterAll.
 * Call it once per file at the top level (it registers hooks), never inside a test,
 * and never use `request(app)` directly.
 * @param extraRoutes - test-only routes, mounted after the API routes
 */
export function api(extraRoutes?: RequestHandler) {
  const server = createServer(createApp(extraRoutes ? { extraRoutes } : {}));

  beforeAll(() => new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve())));
  afterAll(
    () =>
      new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
        server.closeAllConnections();
      }),
  );

  return supertest.agent(server);
}
