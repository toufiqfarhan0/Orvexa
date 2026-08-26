import { Router, Request, Response } from 'express';
import type { HealthCheckResponse } from '@orvexa/shared';
import { config } from '../config/env.js';

export const healthRouter = Router();

healthRouter.get('/', (_req: Request, res: Response<HealthCheckResponse>) => {
  const hasDatabaseUrl = Boolean(config.databaseUrl && config.databaseUrl.trim().length > 0);
  const hasDaytona = Boolean(
    process.env.DAYTONA_API_KEY && process.env.DAYTONA_API_KEY.trim().length > 0
  );
  const hasTrueForge = Boolean(
    config.trueforge.baseUrl && config.trueforge.baseUrl.trim().length > 0
  );

  const payload: HealthCheckResponse = {
    status: 'ok',
    service: config.serviceName,
    version: config.version,
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    environment: config.nodeEnv,
    subsystems: {
      database: {
        status: hasDatabaseUrl ? 'healthy' : 'unconfigured',
        provider: 'postgresql',
        message: hasDatabaseUrl
          ? 'PostgreSQL target database connection configured'
          : 'DATABASE_URL not configured',
      },
      sandbox: {
        status: hasDaytona || hasTrueForge ? 'healthy' : 'unconfigured',
        provider: hasDaytona ? 'daytona' : 'trueforge',
        message: hasDaytona
          ? 'Daytona remote sandbox execution available'
          : hasTrueForge
            ? `TrueForge sandbox harness configured at ${config.trueforge.baseUrl}`
            : 'No DAYTONA_API_KEY or remote TRUEFORGE_BASE_URL configured for sandbox execution',
      },
    },
  };

  res.status(200).json(payload);
});
