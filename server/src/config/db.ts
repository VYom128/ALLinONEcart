import mongoose from 'mongoose';
import { config } from './env.js';
import { logger, serializeError } from '../utils/logger.js';

mongoose.set('strictQuery', true);

/** Connection state reported by /health. */
export type DbStatus = 'connected' | 'disconnected' | 'connecting' | 'disconnecting';

let listenersAttached = false;

function attachListeners(): void {
  if (listenersAttached) return;
  listenersAttached = true;
  // Never log the URI: it can contain credentials.
  mongoose.connection.on('connected', () => logger.info('MongoDB connected'));
  mongoose.connection.on('disconnected', () => logger.warn('MongoDB disconnected'));
  mongoose.connection.on('reconnected', () => logger.info('MongoDB reconnected'));
  mongoose.connection.on('error', (err: unknown) =>
    logger.error({ err: serializeError(err) }, 'MongoDB error'),
  );
}

/**
 * Connects Mongoose, then checks that the server is a replica set (transactions need one)
 * and logs a clear error if it is not.
 * @param uri - defaults to `config.mongoUri`; tests pass the in-memory replica set's URI
 */
export async function connectDB(uri: string | undefined = config.mongoUri): Promise<void> {
  if (!uri) throw new Error('MONGO_URI is not set');
  attachListeners();
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10_000 });

  const hello = await mongoose.connection.db?.admin().command({ hello: 1 });
  if (!hello?.setName) {
    logger.error(
      'MongoDB is not running as a replica set: transactions will fail. ' +
        'Start the Docker one with `npm run services:up` and use MONGO_URI from server/.env.example.',
    );
  }
}

/** Closes the Mongoose connection (no-op when not connected). */
export async function disconnectDB(): Promise<void> {
  await mongoose.disconnect();
}

/** Current connection state from `mongoose.connection.readyState`. */
export function dbStatus(): DbStatus {
  switch (mongoose.connection.readyState) {
    case mongoose.ConnectionStates.connected:
      return 'connected';
    case mongoose.ConnectionStates.connecting:
      return 'connecting';
    case mongoose.ConnectionStates.disconnecting:
      return 'disconnecting';
    default:
      return 'disconnected';
  }
}
