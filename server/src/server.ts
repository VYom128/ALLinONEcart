import { createServer } from 'node:http';
import { API_PREFIX, createApp } from './app.js';
import { connectDB, disconnectDB } from './config/db.js';
import { config } from './config/env.js';
import { closeRedis, connectRedis } from './config/redis.js';
import { logger, serializeError } from './utils/logger.js';
import { exitOnUnhandledErrors, onShutdown } from './utils/process.js';

exitOnUnhandledErrors();

try {
  await connectDB();
} catch (err) {
  logger.fatal(
    { err: serializeError(err) },
    'Could not connect to MongoDB. Is `npm run services:up` running?',
  );
  process.exit(1);
}
await connectRedis();

const server = createServer(createApp());

server.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    // Never kill the other process: it may be the user's own dev server.
    logger.fatal(
      `Port ${config.port} is already in use. Stop that process or set PORT in server/.env.`,
    );
  } else {
    logger.fatal({ err: serializeError(err) }, 'HTTP server error');
  }
  process.exit(1);
});

server.listen(config.port, () => {
  logger.info(`API listening on http://localhost:${config.port}${API_PREFIX}`);
});

onShutdown('api', async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
    server.closeIdleConnections();
  });
  await closeRedis();
  await disconnectDB();
});
