import { Router } from 'express';
import type { HealthData } from '../config/constants.js';
import { dbStatus } from '../config/db.js';
import { redisStatus } from '../config/redis.js';
import { sendSuccess } from '../utils/ApiResponse.js';

export const healthRouter = Router();

// Always 200 while the API runs; db and redis report their own state.
healthRouter.get('/health', (_req, res) => {
  const data: HealthData = {
    status: 'ok',
    uptime: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
    db: dbStatus(),
    redis: redisStatus(),
  };
  sendSuccess(res, { data });
});
