// `npm run smoke`: API smoke tests against a running API with the seed loaded (spec §15.3).
// Reuses an API that already answers on PORT and leaves it running; otherwise starts a
// temporary one in this process on a free port and stops only that one.
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { API_PREFIX, createApp } from '../src/app.js';
import { connectDB, disconnectDB } from '../src/config/db.js';
import { config } from '../src/config/env.js';
import { closeRedis, connectRedis } from '../src/config/redis.js';
import { logger } from '../src/utils/logger.js';
import { checks } from './checks/index.js';
import type { SmokeContext, SmokeResponse } from './types.js';

interface Target {
  baseUrl: string;
  stop: () => Promise<void>;
}

async function answersHealth(baseUrl: string): Promise<boolean> {
  try {
    const res = await fetch(`${baseUrl}/health`, { signal: AbortSignal.timeout(1_500) });
    const body = (await res.json()) as { success?: boolean; data?: { status?: string } };
    return res.ok && body.success === true && body.data?.status === 'ok';
  } catch {
    return false;
  }
}

/** A dev API restarting under `tsx watch` is briefly unreachable, so probe a few times. */
async function apiIsRunning(baseUrl: string, attempts = 6): Promise<boolean> {
  for (let i = 0; i < attempts; i += 1) {
    if (await answersHealth(baseUrl)) return true;
    if (i < attempts - 1) await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return false;
}

async function startTemporaryApi(): Promise<Target> {
  // Keep the ✓/✗ output readable: the temporary API only logs real errors.
  logger.level = 'error';
  await connectDB();
  await connectRedis();
  const server: Server = createServer(createApp());
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const { port } = server.address() as AddressInfo;

  // Redis connects in the background; give it a moment so the health check is meaningful.
  await new Promise((resolve) => setTimeout(resolve, 300));

  return {
    baseUrl: `http://127.0.0.1:${port}${API_PREFIX}`,
    stop: async () => {
      await new Promise<void>((resolve) => {
        server.close(() => resolve());
        server.closeAllConnections();
      });
      await closeRedis();
      await disconnectDB();
    },
  };
}

async function main(): Promise<number> {
  const existing = `http://127.0.0.1:${config.port}${API_PREFIX}`;
  let target: Target;
  if (await apiIsRunning(existing)) {
    console.log(`Using the API already running on port ${config.port} (it is left running).`);
    target = { baseUrl: existing, stop: async () => {} };
  } else {
    target = await startTemporaryApi();
    console.log(`No API on port ${config.port}; started a temporary one at ${target.baseUrl}.`);
  }

  const ctx: SmokeContext = {
    baseUrl: target.baseUrl,
    async request(path, init) {
      const res = await fetch(`${target.baseUrl}${path}`, {
        ...init,
        headers: { Accept: 'application/json', ...init?.headers },
        signal: AbortSignal.timeout(10_000),
      });
      const text = await res.text();
      const body: SmokeResponse['body'] = text ? JSON.parse(text) : null;
      return { status: res.status, headers: res.headers, body };
    },
  };

  let failed = 0;
  try {
    for (const check of checks) {
      try {
        await check.run(ctx);
        console.log(`  ✓ ${check.name}`);
      } catch (err) {
        failed += 1;
        console.log(`  ✗ ${check.name}\n      ${(err as Error).message.split('\n')[0]}`);
      }
    }
  } finally {
    await target.stop();
  }

  console.log(
    failed === 0
      ? `\nSmoke: all ${checks.length} checks passed.`
      : `\nSmoke: ${failed} of ${checks.length} checks failed.`,
  );
  return failed === 0 ? 0 : 1;
}

main().then(
  (code) => process.exit(code),
  (err: unknown) => {
    console.error(`Smoke run failed: ${(err as Error).message}`);
    process.exit(1);
  },
);
