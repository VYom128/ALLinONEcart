import { logger, serializeError } from './logger.js';

const FORCE_EXIT_AFTER_MS = 10_000;

/** Logs unhandled rejections and uncaught exceptions at fatal and exits with code 1. */
export function exitOnUnhandledErrors(): void {
  process.on('unhandledRejection', (reason) => {
    logger.fatal({ err: serializeError(reason) }, 'Unhandled promise rejection');
    process.exit(1);
  });
  process.on('uncaughtException', (err) => {
    logger.fatal({ err: serializeError(err) }, 'Uncaught exception');
    process.exit(1);
  });
}

/**
 * On SIGINT / SIGTERM runs `cleanup` once and exits 0, or exits 1 if it fails or takes longer
 * than 10 seconds.
 * @param name - process name for the log ('api', 'worker')
 * @param cleanup - stop accepting work, then close Redis and the database
 */
export function onShutdown(name: string, cleanup: () => Promise<void>): void {
  let shuttingDown = false;
  const shutdown = (signal: NodeJS.Signals) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info(`${name}: ${signal} received, shutting down`);

    setTimeout(() => {
      logger.error(
        `${name}: shutdown took longer than ${FORCE_EXIT_AFTER_MS / 1000} s, forcing exit`,
      );
      process.exit(1);
    }, FORCE_EXIT_AFTER_MS).unref();

    cleanup()
      .then(() => {
        logger.info(`${name}: stopped`);
        process.exit(0);
      })
      .catch((err: unknown) => {
        logger.error({ err: serializeError(err) }, `${name}: shutdown failed`);
        process.exit(1);
      });
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
}
