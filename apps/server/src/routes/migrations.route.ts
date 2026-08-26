import { Router, Request, Response } from 'express';
import type {
  ApiSuccessResponse,
  ApiErrorResponse,
  MigrationSession,
  MigrationRehearsalEvidence,
  RehearsalProvisionOptions,
  SanitizedApprovalRequestResponse,
  SanitizedApprovalDecisionResponse,
  ApprovalRequest,
  ApprovalDecision,
  LiveExecutionEvidence,
  SanitizedLiveExecutionResponse,
  TargetDatabaseMetadata,
} from '@orvexa/shared';
import type { SanitizedRehearsalResponse } from '@orvexa/shared';
import { MigrationSessionService } from '../services/migration-session.service.js';
import { MigrationAnalysisService } from '../services/migration-analysis.service.js';
import { MigrationRehearsalWorkflowService } from '../rehearsal/services/migration-rehearsal-workflow.service.js';
import { ApprovalService } from '../approval/services/approval.service.js';
import { LiveMigrationExecutionService } from '../execution/services/live-migration-execution.service.js';
import { InMemoryMigrationSessionRepository } from '../repositories/in-memory-session.repository.js';
import type { MigrationSessionRepository } from '../repositories/session.repository.interface.js';
import { DisposablePostgresAdapter } from '../rehearsal/adapters/disposable-postgres.adapter.js';
import { PgInspectionAdapter } from '../db/adapters/pg-inspection.adapter.js';
import { PostgresExecutionAdapter } from '../execution/adapters/postgres-execution.adapter.js';
import { TrueForgeSandboxAdapter } from '../sandbox/adapters/trueforge-sandbox.adapter.js';
import {
  DomainError,
  SessionNotFoundError,
  ValidationError,
  InvalidStateTransitionError,
  IllegalActionError,
  ConfigurationError,
} from '../domain/errors.js';
import { config } from '../config/env.js';

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
  lastErrorMessage?: string;
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
  approvalService?: ApprovalService;
  executionService?: LiveMigrationExecutionService;
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
          stdout: sanitizeLogs(session.rehearsalEvidence.stdout || ''),
          stderr: sanitizeLogs(session.rehearsalEvidence.stderr || ''),
          schemaDifferences: session.rehearsalEvidence.schemaDifferences,
          affectedTables: session.rehearsalEvidence.affectedTables,
          cleanupStatus: session.rehearsalEvidence.cleanupStatus,
          targetUntouched: session.rehearsalEvidence.targetUntouched === true,
          failureReason: session.rehearsalEvidence.failureReason
            ? sanitizeErrorMessage(session.rehearsalEvidence.failureReason)
            : undefined,
        }
      : undefined,
    lastErrorMessage: session.lastErrorMessage
      ? sanitizeErrorMessage(session.lastErrorMessage)
      : undefined,
    approvalRequest: session.approvalRequest
      ? {
          approvalRequestId: session.approvalRequest.approvalRequestId,
          sessionId: session.approvalRequest.sessionId,
          migrationId: session.approvalRequest.migrationId,
          rehearsalId: session.approvalRequest.rehearsalId,
          requestedAt: session.approvalRequest.requestedAt,
          reasonsRequired: session.approvalRequest.reasonsRequired,
          proposedActionSummary: session.approvalRequest.proposedActionSummary,
          highestRiskLevel: session.approvalRequest.highestRiskLevel,
          riskSummary: session.approvalRequest.riskSummary,
          evidenceSummary: session.approvalRequest.evidenceSummary,
          rollbackPlanSummary: session.approvalRequest.rollbackPlanSummary,
          fingerprint: session.approvalRequest.fingerprint,
        }
      : undefined,
    approvalDecision: session.approvalDecision
      ? {
          decisionId: session.approvalDecision.decisionId,
          approvalRequestId: session.approvalDecision.approvalRequestId,
          sessionId: session.approvalDecision.sessionId,
          migrationId: session.approvalDecision.migrationId,
          rehearsalId: session.approvalDecision.rehearsalId,
          status: session.approvalDecision.status,
          approver: session.approvalDecision.approver,
          decidedAt: session.approvalDecision.decidedAt,
          fingerprint: session.approvalDecision.fingerprint,
          comment: session.approvalDecision.comment
            ? sanitizeErrorMessage(session.approvalDecision.comment)
            : undefined,
          rejectionReason: session.approvalDecision.rejectionReason
            ? sanitizeErrorMessage(session.approvalDecision.rejectionReason)
            : undefined,
        }
      : undefined,
    executionResult: session.executionResult
      ? {
          executionId: session.executionResult.executionId,
          status: session.executionResult.status,
          startedAt: session.executionResult.startedAt,
          completedAt: session.executionResult.completedAt,
          durationMs: session.executionResult.durationMs,
          statementsExecuted: session.executionResult.statementsExecuted,
          affectedRowCount: session.executionResult.affectedRowCount,
          statementResults: session.executionResult.statementResults,
          logs: (session.executionResult.logs || []).map((l) => sanitizeLogs(l)),
          errorMessage: session.executionResult.errorMessage
            ? sanitizeErrorMessage(session.executionResult.errorMessage)
            : undefined,
          errorCode: session.executionResult.errorCode,
          executedBy: session.executionResult.executedBy,
        }
      : undefined,
    verificationResult: session.verificationResult
      ? {
          verificationId: session.verificationResult.verificationId,
          status: session.verificationResult.status,
          verifiedAt: session.verificationResult.verifiedAt,
          durationMs: session.verificationResult.durationMs,
          checks: session.verificationResult.checks,
          healthSummary: session.verificationResult.healthSummary,
          errorMessage: session.verificationResult.errorMessage
            ? sanitizeErrorMessage(session.verificationResult.errorMessage)
            : undefined,
        }
      : undefined,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    history: session.history || [],
  };
}

/**
 * Sanitizes a LiveExecutionEvidence payload for public REST API consumption.
 */
export function sanitizeExecutionResponse(
  evidence: LiveExecutionEvidence,
  session: MigrationSession
): SanitizedLiveExecutionResponse {
  return {
    executionId: evidence.executionId,
    sessionId: evidence.sessionId,
    migrationId: evidence.migrationId,
    approvalId: evidence.approvalId,
    approvalFingerprint: evidence.approvalFingerprint,
    targetDatabase: {
      engine: evidence.targetDatabase?.engine || 'postgresql',
      version: evidence.targetDatabase?.version || 'unknown',
      databaseName: evidence.targetDatabase?.databaseName || 'unknown',
      schemaName: evidence.targetDatabase?.schemaName || 'public',
    },
    startedAt: evidence.startedAt,
    completedAt: evidence.completedAt,
    durationMs: evidence.durationMs,
    statementsAttempted: evidence.statementsAttempted,
    statementsSucceeded: evidence.statementsSucceeded,
    failedStatementIndex: evidence.failedStatementIndex,
    errorCode: evidence.errorCode,
    schemaDiff: evidence.schemaDiff || { hasChanges: false, summary: [] },
    verificationResult: evidence.verificationResult
      ? {
          verificationId: evidence.verificationResult.verificationId,
          status: evidence.verificationResult.status,
          verifiedAt: evidence.verificationResult.verifiedAt,
          durationMs: evidence.verificationResult.durationMs,
          checks: evidence.verificationResult.checks || [],
          healthSummary: evidence.verificationResult.healthSummary,
          errorMessage: evidence.verificationResult.errorMessage
            ? sanitizeErrorMessage(evidence.verificationResult.errorMessage)
            : undefined,
        }
      : undefined,
    finalStatus: evidence.finalStatus,
    session: sanitizeSessionForResponse(session),
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
    stdout: sanitizeLogs(evidence.stdout || ''),
    stderr: sanitizeLogs(evidence.stderr || ''),
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
    targetUntouched: evidence.targetUntouched === true,
    failureReason: evidence.failureReason
      ? sanitizeErrorMessage(evidence.failureReason)
      : undefined,
    session: sanitizeSessionForResponse(session),
  };
}

/**
 * Sanitizes an ApprovalRequest payload for public REST API consumption.
 */
export function sanitizeApprovalRequestResponse(
  approvalRequest: ApprovalRequest,
  session: MigrationSession
): SanitizedApprovalRequestResponse {
  return {
    approvalRequestId: approvalRequest.approvalRequestId,
    sessionId: approvalRequest.sessionId,
    migrationId: approvalRequest.migrationId,
    rehearsalId: approvalRequest.rehearsalId,
    requestedAt: approvalRequest.requestedAt,
    reasonsRequired: approvalRequest.reasonsRequired,
    proposedActionSummary: approvalRequest.proposedActionSummary,
    highestRiskLevel: approvalRequest.highestRiskLevel,
    riskSummary: approvalRequest.riskSummary,
    evidenceSummary: approvalRequest.evidenceSummary,
    rollbackPlanSummary: approvalRequest.rollbackPlanSummary,
    fingerprint: approvalRequest.fingerprint,
    status: session.status,
    session: sanitizeSessionForResponse(session),
  };
}

/**
 * Sanitizes an ApprovalDecision payload for public REST API consumption.
 */
export function sanitizeApprovalDecisionResponse(
  decision: ApprovalDecision,
  session: MigrationSession
): SanitizedApprovalDecisionResponse {
  return {
    decisionId: decision.decisionId,
    approvalRequestId: decision.approvalRequestId,
    sessionId: decision.sessionId,
    migrationId: decision.migrationId,
    rehearsalId: decision.rehearsalId,
    status: decision.status,
    approver: decision.approver,
    decidedAt: decision.decidedAt,
    fingerprint: decision.fingerprint,
    comment: decision.comment ? sanitizeErrorMessage(decision.comment) : undefined,
    rejectionReason: decision.rejectionReason
      ? sanitizeErrorMessage(decision.rejectionReason)
      : undefined,
    session: sanitizeSessionForResponse(session),
  };
}

/**
 * Validates and enforces strict numerical and type bounds on rehearsal provision options.
 */
export function validateRehearsalOptions(options: unknown): RehearsalProvisionOptions | undefined {
  if (options === undefined || options === null) {
    return undefined;
  }

  if (typeof options !== 'object' || Array.isArray(options)) {
    throw new ValidationError('Rehearsal options must be a JSON object.');
  }

  const optObj = options as Record<string, unknown>;
  const allowedKeys = new Set([
    'sourceTargetId',
    'targetTables',
    'includeFixtures',
    'fixtureRowLimit',
    'ttlMinutes',
  ]);

  for (const key of Object.keys(optObj)) {
    if (!allowedKeys.has(key)) {
      throw new ValidationError(`Unsupported rehearsal option: '${key}'.`);
    }
  }

  const result: RehearsalProvisionOptions = {};

  if (optObj.sourceTargetId !== undefined) {
    if (typeof optObj.sourceTargetId !== 'string' || optObj.sourceTargetId.length > 100) {
      throw new ValidationError('sourceTargetId must be a string up to 100 characters.');
    }
    result.sourceTargetId = optObj.sourceTargetId;
  }

  if (optObj.targetTables !== undefined) {
    if (
      !Array.isArray(optObj.targetTables) ||
      optObj.targetTables.some((t) => typeof t !== 'string' || t.length > 100) ||
      optObj.targetTables.length > 100
    ) {
      throw new ValidationError('targetTables must be an array of table name strings.');
    }
    result.targetTables = optObj.targetTables;
  }

  if (optObj.includeFixtures !== undefined) {
    if (typeof optObj.includeFixtures !== 'boolean') {
      throw new ValidationError('includeFixtures must be a boolean.');
    }
    result.includeFixtures = optObj.includeFixtures;
  }

  if (optObj.fixtureRowLimit !== undefined) {
    if (
      typeof optObj.fixtureRowLimit !== 'number' ||
      !Number.isInteger(optObj.fixtureRowLimit) ||
      !Number.isFinite(optObj.fixtureRowLimit) ||
      optObj.fixtureRowLimit < 0 ||
      optObj.fixtureRowLimit > 500
    ) {
      throw new ValidationError('fixtureRowLimit must be an integer between 0 and 500.');
    }
    result.fixtureRowLimit = optObj.fixtureRowLimit;
  }

  if (optObj.ttlMinutes !== undefined) {
    if (
      typeof optObj.ttlMinutes !== 'number' ||
      !Number.isInteger(optObj.ttlMinutes) ||
      !Number.isFinite(optObj.ttlMinutes) ||
      optObj.ttlMinutes < 1 ||
      optObj.ttlMinutes > 120
    ) {
      throw new ValidationError('ttlMinutes must be an integer between 1 and 120.');
    }
    result.ttlMinutes = optObj.ttlMinutes;
  }

  return result;
}

/**
 * Strips sensitive credentials, database URLs, and passwords from error messages.
 */
function sanitizeErrorMessage(message: string): string {
  return message
    .replace(/postgres(?:ql)?:\/\/[^:]+:[^@]+@[^/]+/gi, 'postgresql://***:***@***')
    .replace(/password\s*=\s*['"][^'"]+['"]/gi, 'password=***')
    .replace(/password\s*=\s*[^\s;]+/gi, 'password=***')
    .replace(/bearer\s+[a-zA-Z0-9_.-]+/gi, 'Bearer ***')
    .replace(/key\s*=\s*[a-zA-Z0-9_.-]+/gi, 'key=***');
}

/**
 * Strips secrets from log outputs.
 */
function sanitizeLogs(logs: string): string {
  return sanitizeErrorMessage(logs);
}

/**
 * Centralized HTTP error handler mapping domain errors to appropriate HTTP status codes.
 */
function validateOptionalString(
  value: unknown,
  fieldName: string,
  maxLength = 1000
): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value !== 'string') {
    throw new ValidationError(`Field '${fieldName}' must be a string if provided.`);
  }
  const trimmed = value.trim();
  if (trimmed.length > maxLength) {
    throw new ValidationError(
      `Field '${fieldName}' exceeds maximum allowed length (${maxLength} characters).`
    );
  }
  return trimmed.length > 0 ? trimmed : undefined;
}

function validateRequiredString(value: unknown, fieldName: string, maxLength = 100): string {
  if (value === undefined || value === null || typeof value !== 'string') {
    throw new ValidationError(`Field '${fieldName}' is required and must be a string.`);
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    throw new ValidationError(`Field '${fieldName}' cannot be empty.`);
  }
  if (trimmed.length > maxLength) {
    throw new ValidationError(
      `Field '${fieldName}' exceeds maximum allowed length (${maxLength} characters).`
    );
  }
  return trimmed;
}

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

  if (err instanceof ConfigurationError) {
    res.status(500).json({
      success: false,
      error: {
        code: 'CONFIGURATION_ERROR',
        message: err.message,
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
 * Resolves exactly one coherent repository instance for the migration router.
 * If multiple injected services expose DIFFERENT repository instances and no explicit
 * repository is provided, throws a ConfigurationError to fail fast.
 */
export function resolveUnifiedRepository(
  options?: MigrationsRouterOptions
): MigrationSessionRepository {
  if (options?.repository) {
    return options.repository;
  }

  const injectedRepos: { name: string; repo: MigrationSessionRepository }[] = [];

  const check = (name: string, svc?: unknown) => {
    if (
      svc &&
      typeof svc === 'object' &&
      'sessionRepository' in svc &&
      (svc as { sessionRepository?: MigrationSessionRepository }).sessionRepository
    ) {
      injectedRepos.push({
        name,
        repo: (svc as { sessionRepository: MigrationSessionRepository }).sessionRepository,
      });
    }
  };

  check('sessionService', options?.sessionService);
  check('analysisService', options?.analysisService);
  check('rehearsalService', options?.rehearsalService);
  check('approvalService', options?.approvalService);
  check('executionService', options?.executionService);

  if (injectedRepos.length > 0) {
    const first = injectedRepos[0];
    for (let i = 1; i < injectedRepos.length; i++) {
      if (injectedRepos[i].repo !== first.repo) {
        throw new ConfigurationError(
          `Conflicting repository instances detected across injected services (${first.name} vs ${injectedRepos[i].name}). Provide an explicit shared repository in MigrationsRouterOptions.`
        );
      }
    }
    return first.repo;
  }

  return new InMemoryMigrationSessionRepository();
}

function parseDatabaseNameFromUrl(rawUrl: string): string {
  try {
    const url = new URL(rawUrl);
    return url.pathname.replace(/^\//, '') || 'schemasentry_test';
  } catch {
    return 'schemasentry_test';
  }
}

/**
 * Creates the Express router for migration sessions, static analysis, rehearsal, approval, and live execution.
 * Uses a single shared repository instance when individual services are not explicitly provided.
 */
export function createMigrationsRouter(options?: MigrationsRouterOptions): Router {
  const router = Router();
  const repository = resolveUnifiedRepository(options);

  const defaultDbName = parseDatabaseNameFromUrl(config.databaseUrl);

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
  const approvalService =
    options?.approvalService ??
    new ApprovalService({
      sessionRepository: repository,
    });
  const executionService =
    options?.executionService ??
    new LiveMigrationExecutionService({
      sessionRepository: repository,
      executionPort: new PostgresExecutionAdapter({ connectionString: config.databaseUrl }),
      inspectionPortFactory: (target: TargetDatabaseMetadata) => {
        const raw = target.connectionString || config.databaseUrl;
        let connStr = raw;
        try {
          const url = new URL(raw);
          if (
            target.databaseName &&
            target.databaseName.trim().length > 0 &&
            target.databaseName !== 'orvexa_db' &&
            target.databaseName !== 'unknown'
          ) {
            url.pathname = `/${target.databaseName.trim()}`;
          }
          connStr = url.toString();
        } catch {
          connStr = raw;
        }
        return new PgInspectionAdapter({ connectionString: connStr });
      },
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
        const { sql, target, name } = req.body || {};

        if (!sql || typeof sql !== 'string' || sql.trim().length === 0) {
          throw new ValidationError('Migration SQL is required and must not be empty.');
        }

        const resolvedDbName =
          target?.databaseName && target.databaseName !== 'orvexa_db'
            ? target.databaseName
            : defaultDbName;

        const session = await sessionService.createSession({
          proposedMigration: {
            migrationId: `mig_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
            name: name || 'migration',
            rawSql: sql.trim(),
          },
          targetDatabase: {
            engine: 'postgresql',
            version: target?.version || 'PostgreSQL 16',
            databaseName: resolvedDbName,
            schemaName: target?.schemaName || 'public',
            isProductionLike: target?.isProductionLike ?? false,
            connectionString: target?.connectionString || config.databaseUrl,
          },
        });

        const sanitized = sanitizeSessionForResponse(session);

        res.status(201).json({
          success: true,
          data: sanitized,
        });
      } catch (err) {
        handleRouteError(err, res);
      }
    }
  );

  /**
   * POST /api/migrations/:sessionId/analyze - Trigger deterministic AST risk analysis
   */
  router.post(
    '/:sessionId/analyze',
    async (
      req: Request,
      res: Response<ApiSuccessResponse<SanitizedSessionResponse> | ApiErrorResponse>
    ) => {
      try {
        const sessionId = req.params.sessionId;

        if (!sessionId || typeof sessionId !== 'string') {
          throw new ValidationError('Session ID parameter is required.');
        }

        const { session } = await analysisService.analyzeMigrationSession(sessionId, {
          actor: 'API',
        });

        const sanitized = sanitizeSessionForResponse(session);

        res.status(200).json({
          success: true,
          data: sanitized,
        });
      } catch (err) {
        handleRouteError(err, res);
      }
    }
  );

  /**
   * POST /api/migrations/:sessionId/rehearsal - Execute isolated migration rehearsal workflow
   */
  router.post(
    '/:sessionId/rehearsal',
    async (
      req: Request,
      res: Response<ApiSuccessResponse<SanitizedRehearsalResponse> | ApiErrorResponse>
    ) => {
      const sessionId = req.params.sessionId;
      try {
        if (!sessionId || typeof sessionId !== 'string') {
          throw new ValidationError('Session ID parameter is required.');
        }

        const validatedOptions = validateRehearsalOptions(req.body?.options);

        // Pre-check active execution
        if (activeRehearsals.has(sessionId)) {
          throw new InvalidStateTransitionError(
            'SANDBOX_RUNNING',
            'SANDBOX_RUNNING',
            sessionId,
            `Rehearsal execution for session '${sessionId}' is already in progress.`
          );
        }

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

        // Atomic lock check before executing
        if (activeRehearsals.has(sessionId)) {
          throw new InvalidStateTransitionError(
            'SANDBOX_RUNNING',
            'SANDBOX_RUNNING',
            sessionId,
            `Rehearsal execution for session '${sessionId}' is already in progress.`
          );
        }

        activeRehearsals.add(sessionId);

        try {
          const evidence = await rehearsalService.runRehearsal({
            sessionId,
            migrationSql: session.request.proposedMigration.rawSql,
            options: validatedOptions,
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
   * POST /api/migrations/:sessionId/approval - Request human approval for a completed rehearsal
   */
  router.post(
    '/:sessionId/approval',
    async (
      req: Request,
      res: Response<ApiSuccessResponse<SanitizedApprovalRequestResponse> | ApiErrorResponse>
    ) => {
      const sessionId = req.params.sessionId;
      try {
        if (!sessionId || typeof sessionId !== 'string') {
          throw new ValidationError('Session ID parameter is required.');
        }

        if (req.body && (typeof req.body !== 'object' || Array.isArray(req.body))) {
          throw new ValidationError('Request body must be a JSON object.');
        }

        const actor = validateOptionalString(req.body?.actor, 'actor', 100);
        const comment = validateOptionalString(req.body?.comment, 'comment', 1000);

        const session = await sessionService.getSession(sessionId);

        if (
          session.status !== 'SANDBOX_REHEARSAL_COMPLETED' &&
          session.status !== 'AWAITING_APPROVAL'
        ) {
          throw new InvalidStateTransitionError(
            session.status,
            'AWAITING_APPROVAL',
            sessionId,
            `Cannot request approval from '${session.status}' status. Rehearsal must be completed first.`
          );
        }

        const approvalRequest = await approvalService.requestApproval({
          sessionId,
          actor: actor || 'Engineer',
          comment,
        });

        const updatedSession = await sessionService.getSession(sessionId);
        const sanitized = sanitizeApprovalRequestResponse(approvalRequest, updatedSession);

        res.status(200).json({
          success: true,
          data: sanitized,
        });
      } catch (err) {
        handleRouteError(err, res);
      }
    }
  );

  /**
   * POST /api/migrations/:sessionId/approve - Record explicit human approval decision
   */
  router.post(
    '/:sessionId/approve',
    async (
      req: Request,
      res: Response<ApiSuccessResponse<SanitizedApprovalDecisionResponse> | ApiErrorResponse>
    ) => {
      const sessionId = req.params.sessionId;
      try {
        if (!sessionId || typeof sessionId !== 'string') {
          throw new ValidationError('Session ID parameter is required.');
        }

        if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
          throw new ValidationError(
            'Request body must be a JSON object containing approval details.'
          );
        }

        const approver = validateRequiredString(req.body.approver, 'approver', 100);
        const comment = validateOptionalString(req.body.comment, 'comment', 1000);
        const fingerprint = validateOptionalString(req.body.fingerprint, 'fingerprint', 128);

        const session = await sessionService.getSession(sessionId);

        if (session.status !== 'AWAITING_APPROVAL') {
          throw new InvalidStateTransitionError(
            session.status,
            'APPROVED',
            sessionId,
            `Cannot approve session in '${session.status}' status. Session must be in AWAITING_APPROVAL status.`
          );
        }

        const decision = await approvalService.approve({
          sessionId,
          approver,
          comment,
          fingerprint,
        });

        const updatedSession = await sessionService.getSession(sessionId);
        const sanitized = sanitizeApprovalDecisionResponse(decision, updatedSession);

        res.status(200).json({
          success: true,
          data: sanitized,
        });
      } catch (err) {
        handleRouteError(err, res);
      }
    }
  );

  /**
   * POST /api/migrations/:sessionId/reject - Record explicit human rejection decision
   */
  router.post(
    '/:sessionId/reject',
    async (
      req: Request,
      res: Response<ApiSuccessResponse<SanitizedApprovalDecisionResponse> | ApiErrorResponse>
    ) => {
      const sessionId = req.params.sessionId;
      try {
        if (!sessionId || typeof sessionId !== 'string') {
          throw new ValidationError('Session ID parameter is required.');
        }

        if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
          throw new ValidationError(
            'Request body must be a JSON object containing rejection details.'
          );
        }

        const approver = validateRequiredString(req.body.approver, 'approver', 100);
        const rawReason =
          req.body.rejectionReason !== undefined ? req.body.rejectionReason : req.body.reason;
        const reason = validateRequiredString(rawReason, 'rejectionReason', 1000);
        const fingerprint = validateOptionalString(req.body.fingerprint, 'fingerprint', 128);

        const session = await sessionService.getSession(sessionId);

        if (session.status !== 'AWAITING_APPROVAL') {
          throw new InvalidStateTransitionError(
            session.status,
            'REJECTED',
            sessionId,
            `Cannot reject session in '${session.status}' status. Session must be in AWAITING_APPROVAL status.`
          );
        }

        const decision = await approvalService.reject({
          sessionId,
          approver,
          reason,
          fingerprint,
        });

        const updatedSession = await sessionService.getSession(sessionId);
        const sanitized = sanitizeApprovalDecisionResponse(decision, updatedSession);

        res.status(200).json({
          success: true,
          data: sanitized,
        });
      } catch (err) {
        handleRouteError(err, res);
      }
    }
  );

  /**
   * POST /api/migrations/:sessionId/execute - Execute approved migration on target database and run automated verification
   */
  router.post(
    '/:sessionId/execute',
    async (
      req: Request,
      res: Response<ApiSuccessResponse<SanitizedLiveExecutionResponse> | ApiErrorResponse>
    ) => {
      try {
        const sessionId = req.params.sessionId;

        if (!sessionId || typeof sessionId !== 'string' || sessionId.trim().length === 0) {
          throw new ValidationError('Session ID parameter is required.');
        }

        if (req.body !== undefined && req.body !== null) {
          if (typeof req.body !== 'object' || Array.isArray(req.body)) {
            throw new ValidationError('Request payload must be a valid JSON object.');
          }
        }

        if (req.body?.confirmExecution !== true) {
          throw new ValidationError(
            "Field 'confirmExecution' must be explicitly set to true to execute a live migration."
          );
        }

        const actor = validateOptionalString(req.body?.actor, 'actor', 100);
        let timeoutMs: number | undefined = undefined;
        if (req.body?.timeoutMs !== undefined && req.body?.timeoutMs !== null) {
          if (
            typeof req.body.timeoutMs !== 'number' ||
            !Number.isFinite(req.body.timeoutMs) ||
            !Number.isInteger(req.body.timeoutMs) ||
            req.body.timeoutMs < 1 ||
            req.body.timeoutMs > 600000
          ) {
            throw new ValidationError(
              "Field 'timeoutMs' must be a positive integer between 1 and 600000 milliseconds if provided."
            );
          }
          timeoutMs = req.body.timeoutMs;
        }

        const evidence = await executionService.execute({
          sessionId: sessionId.trim(),
          actor,
          timeoutMs,
          confirmExecution: true,
        });

        const updatedSession = await sessionService.getSession(sessionId.trim());
        const sanitized = sanitizeExecutionResponse(evidence, updatedSession);

        res.status(200).json({
          success: true,
          data: sanitized,
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
        const sessionId = req.params.sessionId;

        if (!sessionId || typeof sessionId !== 'string') {
          throw new ValidationError('Session ID parameter is required.');
        }

        const session = await sessionService.getSession(sessionId);
        const sanitized = sanitizeSessionForResponse(session);

        res.status(200).json({
          success: true,
          data: sanitized,
        });
      } catch (err) {
        handleRouteError(err, res);
      }
    }
  );

  /**
   * GET /api/migrations - List all active sessions
   */
  router.get(
    '/',
    async (
      _req: Request,
      res: Response<ApiSuccessResponse<SanitizedSessionResponse[]> | ApiErrorResponse>
    ) => {
      try {
        const sessions = await sessionService.listSessions();
        const sanitized = sessions.map(sanitizeSessionForResponse);

        res.status(200).json({
          success: true,
          data: sanitized,
        });
      } catch (err) {
        handleRouteError(err, res);
      }
    }
  );

  return router;
}

export const migrationsRouter = createMigrationsRouter();
