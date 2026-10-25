import { Router } from 'express';
import { healthRouter } from './health.routes.js';

/** Everything under /api/v1. Feature modules are mounted here as they are built. */
export const apiRouter = Router();

apiRouter.use(healthRouter);
