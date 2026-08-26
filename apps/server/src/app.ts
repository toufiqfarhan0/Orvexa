import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { apiRouter, createApiRouter } from './routes/index.js';
import { config } from './config/env.js';
import { SchemaSentryMcpServer } from './mcp/schemasentry-mcp.server.js';
import { PgInspectionAdapter } from './db/adapters/pg-inspection.adapter.js';
import type { PostgresInspectionPort } from './db/ports/postgres-inspection.port.js';
import type { ApiErrorResponse } from '@orvexa/shared';
import type { MigrationSessionService } from './services/migration-session.service.js';
import type { MigrationAnalysisService } from './services/migration-analysis.service.js';
import type { MigrationRehearsalWorkflowService } from './rehearsal/services/migration-rehearsal-workflow.service.js';
import type { ApprovalService } from './approval/services/approval.service.js';
import type { LiveMigrationExecutionService } from './execution/services/live-migration-execution.service.js';
import type { MigrationSessionRepository } from './repositories/session.repository.interface.js';

export interface AppOptions {
  inspectionPort?: PostgresInspectionPort;
  mcpServer?: SchemaSentryMcpServer;
  sessionRepository?: MigrationSessionRepository;
  sessionService?: MigrationSessionService;
  analysisService?: MigrationAnalysisService;
  rehearsalService?: MigrationRehearsalWorkflowService;
  approvalService?: ApprovalService;
  executionService?: LiveMigrationExecutionService;
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

  // Mount API router (with dependency injection options if provided)
  const router =
    options?.sessionRepository ||
    options?.sessionService ||
    options?.analysisService ||
    options?.rehearsalService ||
    options?.approvalService ||
    options?.executionService
      ? createApiRouter({
          repository: options.sessionRepository,
          sessionService: options.sessionService,
          analysisService: options.analysisService,
          rehearsalService: options.rehearsalService,
          approvalService: options.approvalService,
          executionService: options.executionService,
        })
      : apiRouter;

  app.use('/api', router);

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
  app.use(
    (
      err: Error & { status?: number; type?: string },
      _req: Request,
      res: Response<ApiErrorResponse>,
      _next: NextFunction
    ) => {
      if (err.status === 400 || err.type === 'entity.parse.failed') {
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_JSON',
            message: 'Invalid JSON payload in request body.',
          },
        });
        return;
      }

      console.error('Unhandled server error:', err);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: config.nodeEnv === 'production' ? 'An internal error occurred.' : err.message,
        },
      });
    }
  );

  return app;
}
