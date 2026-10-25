// `npm run seed` loads the fixed seed data (spec §15.5); `npm run seed -- --reset` wipes first.
// Seeders are idempotent upserts through the services, with fixed ids and values.
import mongoose from 'mongoose';
import { connectDB, disconnectDB } from '../config/db.js';
import { config } from '../config/env.js';

/** One seeder: loads one kind of data. Must be idempotent (safe to run again). */
export interface Seeder {
  name: string;
  run: () => Promise<void>;
}

/** Run in order. Each phase adds its seeders here (stores, categories, users, …). */
const SEEDERS: Seeder[] = [];

async function wipeAll(): Promise<void> {
  const db = mongoose.connection.db;
  if (!db) throw new Error('Not connected');
  const collections = await db.listCollections({}, { nameOnly: true }).toArray();
  for (const { name } of collections) {
    if (name.startsWith('system.')) continue;
    await db.collection(name).deleteMany({});
  }
  console.log(`Reset: emptied ${collections.length} collection(s).`);
}

async function printCounts(): Promise<void> {
  const db = mongoose.connection.db;
  if (!db) throw new Error('Not connected');
  const names = (await db.listCollections({}, { nameOnly: true }).toArray())
    .map((c) => c.name)
    .filter((name) => !name.startsWith('system.'))
    .sort();
  if (names.length === 0) {
    console.log('Documents per collection: (no collections yet)');
    return;
  }
  console.log('Documents per collection:');
  for (const name of names) {
    console.log(`  ${name}: ${await db.collection(name).countDocuments()}`);
  }
}

async function main(): Promise<void> {
  if (config.isProd) {
    console.error('Refusing to seed: NODE_ENV=production.');
    process.exitCode = 1;
    return;
  }
  const reset = process.argv.slice(2).includes('--reset');

  await connectDB();
  try {
    if (reset) await wipeAll();
    for (const seeder of SEEDERS) {
      await seeder.run();
      console.log(`  ✓ ${seeder.name}`);
    }
    console.log(`Seed: ${SEEDERS.length} seeder(s) ran.`);
    await printCounts();
  } finally {
    await disconnectDB();
  }
}

main().catch((err: unknown) => {
  console.error(`Seed failed: ${(err as Error).message}`);
  process.exitCode = 1;
});
