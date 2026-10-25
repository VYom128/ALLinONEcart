import { Router } from 'express';
import { dbStatus, type DbStatus } from '../config/db.js';
import { redisStatus, type RedisStatus } from '../config/redis.js';
import { sendSuccess } from '../utils/ApiResponse.js';

/** Payload of GET /health (spec §7.2). */
export interface HealthData {
  status: 'ok';
  /** Seconds since the process started. */
  uptime: number;
  /** Server time, ISO 8601 UTC. */
  timestamp: string;
  db: DbStatus;
  redis: RedisStatus;
}

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
