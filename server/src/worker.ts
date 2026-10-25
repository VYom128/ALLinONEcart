import { connectDB, disconnectDB } from './config/db.js';
import { closeRedis, connectRedis } from './config/redis.js';
import { logger, serializeError } from './utils/logger.js';
import { exitOnUnhandledErrors, onShutdown } from './utils/process.js';

// Background jobs (BullMQ). Queues and processors are registered here from Phase 2.

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

logger.info('worker ready');

onShutdown('worker', async () => {
  await closeRedis();
  await disconnectDB();
});
