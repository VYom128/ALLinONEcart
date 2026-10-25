import { readFile } from 'node:fs/promises';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Saved store pages live here: stores/<store>/<page>.html (spec §15.4). */
export const STORES_DIR = fileURLToPath(new URL('../stores/', import.meta.url));

const CONTENT_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
};

/** Options for {@link startMockstores}. */
export interface MockstoresOptions {
  /** 0 picks a free port (default). */
  port?: number;
  /** Defaults to 127.0.0.1 so the server is never reachable from the network. */
  host?: string;
}

/** A running mockstores server. */
export interface Mockstores {
  /** Base URL without a trailing slash, e.g. http://127.0.0.1:53211 */
  url: string;
  close: () => Promise<void>;
}

function send(res: ServerResponse, status: number, type: string, body: string | Buffer): void {
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(body);
}

async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const path = decodeURIComponent(new URL(req.url ?? '/', 'http://mockstores').pathname);

  if (path === '/__health') {
    send(res, 200, CONTENT_TYPES['.json']!, JSON.stringify({ status: 'ok' }));
    return;
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    send(res, 405, 'text/plain; charset=utf-8', 'Method not allowed');
    return;
  }

  // Resolve inside STORES_DIR only; "/../" tricks fall through to 404.
  const file = normalize(join(STORES_DIR, path));
  if (!file.startsWith(STORES_DIR) || file.endsWith(sep)) {
    send(res, 404, 'text/plain; charset=utf-8', 'Not found');
    return;
  }

  try {
    const body = await readFile(file);
    const type = CONTENT_TYPES[extname(file).toLowerCase()] ?? 'application/octet-stream';
    send(res, 200, type, body);
  } catch {
    send(res, 404, 'text/plain; charset=utf-8', 'Not found');
  }
}

/**
 * Starts the mockstores server, which serves saved store pages from `stores/**` and
 * `GET /__health`. Tests use `{ port: 0 }` for a random free port.
 * @param options - port (default 0) and host (default 127.0.0.1)
 */
export async function startMockstores({
  port = 0,
  host = '127.0.0.1',
}: MockstoresOptions = {}): Promise<Mockstores> {
  const server = createServer((req, res) => {
    handle(req, res).catch(() => send(res, 500, 'text/plain; charset=utf-8', 'Internal error'));
  });

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => resolve());
  });

  const { port: actualPort } = server.address() as AddressInfo;
  return {
    url: `http://${host}:${actualPort}`,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
        server.closeAllConnections();
      }),
  };
}
