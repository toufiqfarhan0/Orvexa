import { Router, Request, Response } from 'express';
import type { HealthCheckResponse } from '@orvexa/shared';
import { config } from '../config/env.js';

export const healthRouter = Router();

healthRouter.get('/', (_req: Request, res: Response<HealthCheckResponse>) => {
  const payload: HealthCheckResponse = {
    status: 'ok',
    service: config.serviceName,
    version: config.version,
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    environment: config.nodeEnv,
  };

  res.status(200).json(payload);
});
