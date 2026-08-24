import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { apiRouter } from './routes/index.js';
import { config } from './config/env.js';
import { SchemaSentryMcpServer } from './mcp/schemasentry-mcp.server.js';
import { PgInspectionAdapter } from './db/adapters/pg-inspection.adapter.js';
import type { PostgresInspectionPort } from './db/ports/postgres-inspection.port.js';
import type { ApiErrorResponse } from '@orvexa/shared';

export interface AppOptions {
  inspectionPort?: PostgresInspectionPort;
  mcpServer?: SchemaSentryMcpServer;
}

export function createApp(options?: AppOptions): Express {
  const app = express();

  // Security and base middlewares
  app.use(helmet());
  app.use(
    cors({
      origin: config.corsOrigin === '*' ? '*' : [config.corsOrigin, 'http://localhost:5173'],
      credentials: true,
    })
  );
  app.use(express.json());

  // Mount SchemaSentry MCP Server
  const inspectionPort =
    options?.inspectionPort || new PgInspectionAdapter({ connectionString: config.databaseUrl });
  const mcpServer = options?.mcpServer || new SchemaSentryMcpServer({ inspectionPort });
  app.use('/api/mcp', mcpServer.createRouter());

  // Mount API router
  app.use('/api', apiRouter);

  // 404 Handler
  app.use((_req: Request, res: Response<ApiErrorResponse>) => {
    res.status(404).json({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: 'The requested resource was not found.',
      },
    });
  });

  // Global Error Handler
  app.use((err: Error, _req: Request, res: Response<ApiErrorResponse>, _next: NextFunction) => {
    console.error('Unhandled server error:', err);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: config.nodeEnv === 'production' ? 'An internal error occurred.' : err.message,
      },
    });
  });

  return app;
}
