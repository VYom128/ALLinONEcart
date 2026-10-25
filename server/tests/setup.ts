// Runs before every test file: one in-memory MongoDB replica set per file (spec §15.1).
// Redis needs nothing here: getRedis() returns ioredis-mock when NODE_ENV=test.
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { afterAll, beforeAll } from 'vitest';

process.env.NODE_ENV = 'test';

let replSet: MongoMemoryReplSet | undefined;

beforeAll(async () => {
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } });
  // Imported after NODE_ENV is set, so the config loads in test mode.
  const { connectDB } = await import('../src/config/db.js');
  await connectDB(replSet.getUri());
});

afterAll(async () => {
  const { disconnectDB } = await import('../src/config/db.js');
  const { closeRedis } = await import('../src/config/redis.js');
  await disconnectDB();
  await closeRedis();
  await replSet?.stop();
});
