import compression from 'compression';
import cors from 'cors';
import express, { type Express, type RequestHandler } from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import { config } from './config/env.js';
import { errorHandler } from './middlewares/errorHandler.js';
import { notFound } from './middlewares/notFound.js';
import { apiLimiter } from './middlewares/rateLimiters.js';
import { requestId } from './middlewares/requestId.js';
import { apiRouter } from './routes/index.js';
import { logger } from './utils/logger.js';

export const API_PREFIX = '/api/v1';

/** Options for {@link createApp}. */
export interface CreateAppOptions {
  /** Test-only routes, mounted after the API routes and before the 404 handler. */
  extraRoutes?: RequestHandler;
}

/** Path without the query string: query strings are never logged (spec §11.6). */
function pathOf(url: string | undefined): string {
  return (url ?? '').split('?')[0] ?? '';
}

/**
 * Builds the Express app without listening (server.ts listens; tests use supertest).
 * Order: requestId → pino-http → helmet → cors → compression → json(1mb) → apiLimiter →
 * routes → extraRoutes → notFound → errorHandler (spec §3.3).
 */
export function createApp({ extraRoutes }: CreateAppOptions = {}): Express {
  const app = express();
  app.set('trust proxy', 1);

  app.use(requestId);
  app.use(
    pinoHttp({
      logger,
      genReqId: (req) => req.id,
      // Logs method, path, status and duration only: no headers, body or query string.
      serializers: {
        req: (req: { id: unknown; method: string; url?: string }) => ({
          id: req.id,
          method: req.method,
          path: pathOf(req.url),
        }),
        res: (res: { statusCode: number }) => ({ statusCode: res.statusCode }),
      },
      // The error handler already logs failures with details at warn / error.
      customLogLevel: (_req, res, err) =>
        err || res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info',
      autoLogging: {
        ignore: (req) => config.isDev && pathOf(req.url) === `${API_PREFIX}/health`,
      },
    }),
  );
  app.use(helmet());
  app.use(cors({ origin: [...config.clientUrls], credentials: true }));
  app.use(compression());
  app.use(express.json({ limit: '1mb' }));

  app.use('/api', apiLimiter);
  app.use(API_PREFIX, apiRouter);
  if (extraRoutes) app.use(extraRoutes);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
