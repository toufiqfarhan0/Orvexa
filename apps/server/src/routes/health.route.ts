import { Router, Request, Response } from 'express';
import type { HealthCheckResponse } from '@orvexa/shared';
import { config } from '../config/env.js';
import { TrueForgeAdapter } from '../trueforge/trueforge.adapter.js';

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

/**
 * Probes TrueForge agent runtime readiness (useful for detecting Render free-tier cold starts).
 */
healthRouter.get('/agent', async (_req: Request, res: Response) => {
  const { baseUrl, token, apiKey, modelProvider, modelName } = config.trueforge;

  if (!baseUrl || baseUrl.trim().length === 0) {
    return res.status(200).json({
      ready: false,
      configured: false,
      message: 'TrueForge base URL not configured',
    });
  }

  try {
    const adapter = new TrueForgeAdapter({
      baseUrl,
      token: token || apiKey,
      defaultModelProvider: modelProvider,
      defaultModelName: modelName,
      timeoutMs: 3000,
    });

    const conn = await adapter.verifyConnectivity();
    if (conn.reachable) {
      return res.status(200).json({
        ready: true,
        configured: true,
        latencyMs: conn.latencyMs,
        message: 'TrueForge agent runtime is online and responsive',
      });
    } else {
      return res.status(200).json({
        ready: false,
        configured: true,
        latencyMs: conn.latencyMs,
        warmingUp: true,
        message:
          'TrueForge agent runtime is warming up (Render free tier cold start). Please wait ~20-30s.',
      });
    }
  } catch {
    return res.status(200).json({
      ready: false,
      configured: true,
      warmingUp: true,
      message: 'TrueForge agent is initializing on Render. Please wait a moment.',
    });
  }
});
