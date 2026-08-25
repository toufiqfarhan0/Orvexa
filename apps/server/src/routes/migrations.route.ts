import { Router, Request, Response } from 'express';
import type {
  CreateMigrationSessionDto,
  MigrationSession,
  ProposedMigration,
  TargetDatabaseMetadata,
  ApiSuccessResponse,
  ApiErrorResponse,
} from '@orvexa/shared';
import { MigrationSessionService } from '../services/migration-session.service.js';
import { MigrationAnalysisService } from '../services/migration-analysis.service.js';
import { InMemoryMigrationSessionRepository } from '../repositories/in-memory-session.repository.js';
import type { MigrationSessionRepository } from '../repositories/session.repository.interface.js';
import {
  DomainError,
  SessionNotFoundError,
  ValidationError,
  InvalidStateTransitionError,
  IllegalActionError,
} from '../domain/errors.js';
import { validateCreateSessionDto } from '../domain/validators.js';
import { config } from '../config/env.js';
import { sanitizeErrorMessage } from '../db/utils/sanitizer.js';

export interface SanitizedTargetMetadata {
  engine: string;
  version: string;
  databaseName: string;
  schemaName: string;
}

export interface SanitizedSessionResponse {
  sessionId: string;
  status: string;
  migrationId: string;
  target: SanitizedTargetMetadata;
  proposedMigration: {
    migrationId: string;
    name: string;
    rawSql: string;
  };
  analysisResult?: unknown;
  riskAssessment?: unknown;
  sandboxEligibility?: {
    eligible: boolean;
    requiresSandbox: boolean;
    blockersCount: number;
    warningsCount: number;
  };
  sandboxResult?: unknown;
  approvalRequest?: unknown;
  approvalDecision?: unknown;
  executionResult?: unknown;
  verificationResult?: unknown;
  createdAt: string;
  updatedAt: string;
  history: unknown[];
}

export interface MigrationsRouterOptions {
  repository?: MigrationSessionRepository;
  sessionService?: MigrationSessionService;
  analysisService?: MigrationAnalysisService;
}

/**
 * Sanitizes a MigrationSession domain model for public REST API consumption,
 * ensuring sensitive credentials, database URLs, and passwords are never exposed.
 */
export function sanitizeSessionForResponse(session: MigrationSession): SanitizedSessionResponse {
  return {
    sessionId: session.sessionId,
    status: session.status,
    migrationId: session.request.proposedMigration.migrationId,
    target: {
      engine: session.request.targetDatabase.engine,
      version: session.request.targetDatabase.version,
      databaseName: session.request.targetDatabase.databaseName,
      schemaName: session.request.targetDatabase.schemaName,
    },
    proposedMigration: {
      migrationId: session.request.proposedMigration.migrationId,
      name: session.request.proposedMigration.name,
      rawSql: session.request.proposedMigration.rawSql,
    },
    analysisResult: session.analysisResult,
    riskAssessment: session.riskAssessment,
    sandboxEligibility: session.analysisResult
      ? {
          eligible: session.analysisResult.isSafeForSandbox ?? false,
          requiresSandbox: session.analysisResult.isSafeForSandbox ?? false,
          blockersCount: session.analysisResult.blockers?.length ?? 0,
          warningsCount:
            session.analysisResult.findings?.filter(
              (f) => f.severity === 'MEDIUM' || f.severity === 'HIGH'
            ).length ?? 0,
        }
      : undefined,
    sandboxResult: session.sandboxResult,
    approvalRequest: session.approvalRequest,
    approvalDecision: session.approvalDecision,
    executionResult: session.executionResult,
    verificationResult: session.verificationResult,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    history: session.history || [],
  };
}

/**
 * Maps domain and runtime errors to standard HTTP error responses,
 * strictly preventing credential, stack trace, or internal server error leakage.
 */
function handleRouteError(err: unknown, res: Response<ApiErrorResponse>): void {
  if (err instanceof SessionNotFoundError) {
    res.status(404).json({
      success: false,
      error: {
        code: 'SESSION_NOT_FOUND',
        message: err.message,
      },
    });
    return;
  }

  if (err instanceof ValidationError) {
    res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: err.message,
        details: err.validationErrors,
      },
    });
    return;
  }

  if (err instanceof InvalidStateTransitionError || err instanceof IllegalActionError) {
    res.status(409).json({
      success: false,
      error: {
        code: 'ILLEGAL_STATE_TRANSITION',
        message: err.message,
      },
    });
    return;
  }

  if (err instanceof DomainError) {
    res.status(400).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
      },
    });
    return;
  }

  const isProduction = config.nodeEnv === 'production' || process.env.NODE_ENV === 'production';
  const rawMessage = err instanceof Error ? err.message : 'Internal Server Error';
  const message = isProduction ? 'An internal error occurred.' : sanitizeErrorMessage(rawMessage);

  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message,
    },
  });
}

/**
 * Creates the Express router for migration sessions and static analysis.
 * Uses a single shared repository instance when individual services are not explicitly provided.
 */
export function createMigrationsRouter(options?: MigrationsRouterOptions): Router {
  const router = Router();
  const repository = options?.repository ?? new InMemoryMigrationSessionRepository();
  const sessionService = options?.sessionService ?? new MigrationSessionService(repository);
  const analysisService = options?.analysisService ?? new MigrationAnalysisService(repository);

  /**
   * POST /api/migrations - Create a new migration session
   */
  router.post(
    '/',
    async (
      req: Request,
      res: Response<ApiSuccessResponse<SanitizedSessionResponse> | ApiErrorResponse>
    ) => {
      try {
        const body = req.body;
        if (!body || typeof body !== 'object') {
          throw new ValidationError('Request body must be a JSON object.');
        }

        const rawSql = typeof body.sql === 'string' ? body.sql.trim() : '';
        if (!rawSql) {
          throw new ValidationError('Migration raw SQL (sql) must be a non-empty string.');
        }

        const targetInput = body.target && typeof body.target === 'object' ? body.target : {};
        const databaseName =
          typeof targetInput.databaseName === 'string' && targetInput.databaseName.trim()
            ? targetInput.databaseName.trim()
            : 'orvexa_db';

        const schemaName =
          typeof targetInput.schemaName === 'string' && targetInput.schemaName.trim()
            ? targetInput.schemaName.trim()
            : 'public';

        const version =
          typeof targetInput.version === 'string' && targetInput.version.trim()
            ? targetInput.version.trim()
            : 'PostgreSQL 16';

        const targetDb: TargetDatabaseMetadata = {
          engine: 'postgresql',
          version,
          databaseName,
          schemaName,
          isProductionLike: false,
        };

        const proposedMigration: ProposedMigration = {
          migrationId: `mig_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
          name:
            typeof body.name === 'string' && body.name.trim()
              ? body.name.trim()
              : `migration_${Date.now()}`,
          rawSql,
          targetSchema: schemaName,
        };

        const createDto: CreateMigrationSessionDto = {
          targetDatabase: targetDb,
          proposedMigration,
        };

        // Validate domain constraints
        validateCreateSessionDto(createDto);

        // Execute domain service
        const session = await sessionService.createSession(createDto);

        res.status(201).json({
          success: true,
          data: sanitizeSessionForResponse(session),
        });
      } catch (err) {
        handleRouteError(err, res);
      }
    }
  );

  /**
   * POST /api/migrations/:sessionId/analyze - Trigger deterministic AST analysis
   */
  router.post(
    '/:sessionId/analyze',
    async (
      req: Request,
      res: Response<ApiSuccessResponse<SanitizedSessionResponse> | ApiErrorResponse>
    ) => {
      try {
        const { sessionId } = req.params;
        if (!sessionId || typeof sessionId !== 'string') {
          throw new ValidationError('Session ID parameter is required.');
        }

        const result = await analysisService.analyzeMigrationSession(sessionId, {
          actor: 'web-console',
        });

        res.status(200).json({
          success: true,
          data: sanitizeSessionForResponse(result.session),
        });
      } catch (err) {
        handleRouteError(err, res);
      }
    }
  );

  /**
   * GET /api/migrations/:sessionId - Retrieve current session state and evidence
   */
  router.get(
    '/:sessionId',
    async (
      req: Request,
      res: Response<ApiSuccessResponse<SanitizedSessionResponse> | ApiErrorResponse>
    ) => {
      try {
        const { sessionId } = req.params;
        if (!sessionId || typeof sessionId !== 'string') {
          throw new ValidationError('Session ID parameter is required.');
        }

        const session = await sessionService.getSession(sessionId);

        res.status(200).json({
          success: true,
          data: sanitizeSessionForResponse(session),
        });
      } catch (err) {
        handleRouteError(err, res);
      }
    }
  );

  return router;
}

export const migrationsRouter = createMigrationsRouter();
