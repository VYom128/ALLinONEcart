import mongoose, { type ClientSession } from 'mongoose';

/**
 * Runs `work` in a MongoDB transaction and returns its result. Commits on success, aborts on
 * error (and rethrows). The driver retries transient errors by calling `work` again, so `work`
 * must only do database writes with the given session – no emails, jobs or other side effects.
 * Pass `{ session }` to every query inside.
 * @param work - the writes to run atomically
 */
export async function withTransaction<T>(work: (session: ClientSession) => Promise<T>): Promise<T> {
  const session = await mongoose.startSession();
  try {
    return await session.withTransaction(() => work(session));
  } finally {
    await session.endSession();
  }
}
