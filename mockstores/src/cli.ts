import { startMockstores } from './server.js';

// `npm run dev -w mockstores`: serves the saved store pages for local development.
const port = Number(process.env.MOCKSTORES_PORT ?? 4010);

try {
  const { url, close } = await startMockstores({ port });
  console.log(`mockstores listening on ${url} (pages from mockstores/stores)`);
  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.once(signal, () => void close().then(() => process.exit(0)));
  }
} catch (err) {
  const code = (err as NodeJS.ErrnoException).code;
  console.error(
    code === 'EADDRINUSE'
      ? `mockstores: port ${port} is already in use. Set MOCKSTORES_PORT to another port.`
      : `mockstores failed to start: ${(err as Error).message}`,
  );
  process.exit(1);
}
