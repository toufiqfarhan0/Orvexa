import { Router, Request, Response } from 'express';
import type {
  CreateMigrationSessionDto,
  MigrationSession,
  ProposedMigration,
  TargetDatabaseMetadata,
  ApiSuccessResponse,
  ApiErrorResponse,
  MigrationRehearsalEvidence,
  SanitizedRehearsalResponse,
} from '@orvexa/shared';
import { MigrationSessionService } from '../services/migration-session.service.js';
import { MigrationAnalysisService } from '../services/migration-analysis.service.js';
import { InMemoryMigrationSessionRepository } from '../repositories/in-memory-session.repository.js';
import type { MigrationSessionRepository } from '../repositories/session.repository.interface.js';
import { MigrationRehearsalWorkflowService } from '../rehearsal/services/migration-rehearsal-workflow.service.js';
import { DisposablePostgresAdapter } from '../rehearsal/adapters/disposable-postgres.adapter.js';
import { PgInspectionAdapter } from '../db/adapters/pg-inspection.adapter.js';
import { TrueForgeSandboxAdapter } from '../sandbox/adapters/trueforge-sandbox.adapter.js';
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
  rehearsalEvidence?: unknown;
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
  rehearsalService?: MigrationRehearsalWorkflowService;
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
    rehearsalEvidence: session.rehearsalEvidence
      ? {
          rehearsalId: session.rehearsalEvidence.rehearsalId,
          sessionId: session.rehearsalEvidence.sessionId,
          sandboxId: session.rehearsalEvidence.sandboxId,
          executionId: session.rehearsalEvidence.executionId || session.rehearsalEvidence.sandboxId,
          status: session.rehearsalEvidence.status,
          startedAt: session.rehearsalEvidence.startedAt,
          completedAt: session.rehearsalEvidence.completedAt,
          durationMs: session.rehearsalEvidence.durationMs,
          exitCode: session.rehearsalEvidence.exitCode,
          statementsAttempted: session.rehearsalEvidence.statementsAttempted,
          statementsSucceeded: session.rehearsalEvidence.statementsSucceeded,
          statementsFailed: session.rehearsalEvidence.statementsFailed,
          stdout: session.rehearsalEvidence.stdout,
          stderr: session.rehearsalEvidence.stderr,
          schemaDifferences: session.rehearsalEvidence.schemaDifferences,
          affectedTables: session.rehearsalEvidence.affectedTables,
          cleanupStatus: session.rehearsalEvidence.cleanupStatus,
          targetUntouched: session.rehearsalEvidence.targetUntouched ?? true,
        }
      : undefined,
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
 * Sanitizes a MigrationRehearsalEvidence payload for public REST API consumption.
 */
export function sanitizeRehearsalResponse(
  evidence: MigrationRehearsalEvidence,
  session: MigrationSession
): SanitizedRehearsalResponse {
  return {
    sessionId: evidence.sessionId,
    migrationId: evidence.migrationId,
    rehearsalId: evidence.rehearsalId,
    status: evidence.status,
    startedAt: evidence.startedAt,
    completedAt: evidence.completedAt,
    durationMs: evidence.durationMs,
    executionId: evidence.executionId || evidence.sandboxId,
    sandboxId: evidence.sandboxId,
    exitCode: evidence.exitCode,
    statementsAttempted: evidence.statementsAttempted,
    statementsSucceeded: evidence.statementsSucceeded,
    statementsFailed: evidence.statementsFailed,
    stdout: evidence.stdout,
    stderr: evidence.stderr,
    schemaDiff: evidence.schemaDifferences,
    preMigrationSnapshot: (evidence.preMigrationInspection || []).map((t) => ({
      tableName:
        t.table?.tableName || (t as unknown as { tableName?: string }).tableName || 'unknown',
      columnCount: t.columns.length,
    })),
    postMigrationSnapshot: (evidence.postMigrationInspection || []).map((t) => ({
      tableName:
        t.table?.tableName || (t as unknown as { tableName?: string }).tableName || 'unknown',
      columnCount: t.columns.length,
    })),
    cleanupStatus: evidence.cleanupStatus,
    targetUntouched: evidence.targetUntouched ?? true,
    session: sanitizeSessionForResponse(session),
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

  const rawMessage = err instanceof Error ? err.message : String(err);

  if (
    rawMessage.toLowerCase().includes('sandbox capability is disabled') ||
    rawMessage.toLowerCase().includes('sandbox unavailable') ||
    rawMessage.toLowerCase().includes('trueforge sandbox')
  ) {
    res.status(503).json({
      success: false,
      error: {
        code: 'SANDBOX_UNAVAILABLE',
        message: sanitizeErrorMessage(rawMessage),
      },
    });
    return;
  }

  if (
    rawMessage.toLowerCase().includes('provisioning') ||
    rawMessage.toLowerCase().includes('disposable')
  ) {
    res.status(500).json({
      success: false,
      error: {
        code: 'DATABASE_PROVISIONING_FAILED',
        message: sanitizeErrorMessage(rawMessage),
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
 * Creates the Express router for migration sessions, static analysis, and rehearsal.
 * Uses a single shared repository instance when individual services are not explicitly provided.
 */
export function createMigrationsRouter(options?: MigrationsRouterOptions): Router {
  const router = Router();
  const repository = options?.repository ?? new InMemoryMigrationSessionRepository();
  const sessionService = options?.sessionService ?? new MigrationSessionService(repository);
  const analysisService = options?.analysisService ?? new MigrationAnalysisService(repository);
  const rehearsalService =
    options?.rehearsalService ??
    new MigrationRehearsalWorkflowService({
      rehearsalDbPort: new DisposablePostgresAdapter({ connectionString: config.databaseUrl }),
      inspectionPort: new PgInspectionAdapter({ connectionString: config.databaseUrl }),
      sandboxPort: new TrueForgeSandboxAdapter(),
      sessionRepository: repository,
    });

  const activeRehearsals = new Set<string>();

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
   * POST /api/migrations/:sessionId/rehearsal - Execute real migration rehearsal workflow
   */
  router.post(
    '/:sessionId/rehearsal',
    async (
      req: Request,
      res: Response<ApiSuccessResponse<SanitizedRehearsalResponse> | ApiErrorResponse>
    ) => {
      const { sessionId } = req.params;
      if (!sessionId || typeof sessionId !== 'string') {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Session ID parameter is required.',
          },
        });
        return;
      }

      if (activeRehearsals.has(sessionId)) {
        res.status(409).json({
          success: false,
          error: {
            code: 'ILLEGAL_STATE_TRANSITION',
            message: `A rehearsal is already in progress for session '${sessionId}'.`,
          },
        });
        return;
      }

      try {
        const session = await sessionService.getSession(sessionId);

        if (session.status !== 'SANDBOX_READY') {
          throw new InvalidStateTransitionError(
            session.status,
            'SANDBOX_RUNNING',
            session.sessionId,
            `Cannot start rehearsal from '${session.status}' status. Session must be in SANDBOX_READY status.`
          );
        }

        if (
          !session.analysisResult ||
          !session.analysisResult.isSafeForSandbox ||
          (session.analysisResult.blockers && session.analysisResult.blockers.length > 0)
        ) {
          throw new IllegalActionError(
            `Cannot start rehearsal for session '${sessionId}': Analysis identified blocking issues.`,
            'All blockers must be resolved before sandbox rehearsal.'
          );
        }

        activeRehearsals.add(sessionId);

        try {
          const evidence = await rehearsalService.runRehearsal({
            sessionId,
            migrationSql: session.request.proposedMigration.rawSql,
            options: req.body?.options,
          });

          // Retrieve updated session from repository
          const updatedSession = await sessionService.getSession(sessionId);
          const sanitized = sanitizeRehearsalResponse(evidence, updatedSession);

          res.status(200).json({
            success: true,
            data: sanitized,
          });
        } finally {
          activeRehearsals.delete(sessionId);
        }
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
