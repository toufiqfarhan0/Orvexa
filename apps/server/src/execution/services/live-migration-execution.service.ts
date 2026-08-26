import { randomUUID } from 'node:crypto';
import type {
  ExecuteMigrationDto,
  ExecutionResult,
  FullTableInspection,
  LiveExecutionEvidence,
  TargetDatabaseMetadata,
  VerificationCheck,
  VerificationResult,
} from '@orvexa/shared';
import type { MigrationSessionRepository } from '../../repositories/session.repository.interface.js';
import type { PostgresExecutionPort } from '../ports/postgres-execution.port.js';
import type { PostgresInspectionPort } from '../../db/ports/postgres-inspection.port.js';
import { PgInspectionAdapter } from '../../db/adapters/pg-inspection.adapter.js';
import { MigrationSessionEntity } from '../../domain/session.entity.js';
import { IllegalActionError, SessionNotFoundError, ValidationError } from '../../domain/errors.js';
import { ApprovalFingerprintGenerator } from '../../approval/utils/approval-fingerprint.js';
import { SqlStatementParser } from '../../analyzer/parser/sql-statement-parser.js';
import { SchemaDiffCalculator } from '../../rehearsal/utils/schema-diff-calculator.js';
import { ExecutionLock } from '../utils/execution-lock.js';
import { sanitizeConnectionString, isValidIdentifier } from '../../db/utils/sanitizer.js';
import { TrueForgeLogger } from '../../trueforge/trueforge.logger.js';
import { PostgresTransactionClassifier } from '../utils/transaction-classifier.js';

export interface LiveMigrationExecutionServiceOptions {
  sessionRepository: MigrationSessionRepository;
  executionPort: PostgresExecutionPort;
  inspectionPort?: PostgresInspectionPort;
  inspectionPortFactory?: (target: TargetDatabaseMetadata) => PostgresInspectionPort;
  logger?: TrueForgeLogger;
}

/**
 * LiveMigrationExecutionService
 *
 * Enforces strict pre-execution validation, cryptographic fingerprint re-verification,
 * execution locking, target-specific pre/post inspection snapshots, rehearsal diff parity comparison,
 * automated verification checks, exception failure state persistence, and immutable audit logging.
 */
export class LiveMigrationExecutionService {
  private readonly sessionRepo: MigrationSessionRepository;
  private readonly executionPort: PostgresExecutionPort;
  private readonly inspectionPort?: PostgresInspectionPort;
  private readonly inspectionPortFactory?: (
    target: TargetDatabaseMetadata
  ) => PostgresInspectionPort;
  private readonly logger: TrueForgeLogger;

  constructor(options: LiveMigrationExecutionServiceOptions) {
    this.sessionRepo = options.sessionRepository;
    this.executionPort = options.executionPort;
    this.inspectionPort = options.inspectionPort;
    this.inspectionPortFactory = options.inspectionPortFactory;
    this.logger = options.logger || new TrueForgeLogger('[Orvexa:LiveExecutionService]');
  }

  /**
   * Resolves a PostgresInspectionPort bound to the specific session target database.
   */
  private getInspectionPort(target: TargetDatabaseMetadata): {
    port: PostgresInspectionPort;
    cleanup?: () => Promise<void>;
  } {
    if (this.inspectionPortFactory) {
      const port = this.inspectionPortFactory(target);
      return {
        port,
        cleanup:
          typeof (port as unknown as { close?: () => Promise<void> }).close === 'function'
            ? () => (port as unknown as { close: () => Promise<void> }).close()
            : undefined,
      };
    }
    if (this.inspectionPort) {
      return { port: this.inspectionPort };
    }
    const raw =
      target.connectionString ||
      process.env.DATABASE_URL ||
      'postgresql://postgres:postgres@localhost:5432/postgres';
    let connStr = raw;
    try {
      const url = new URL(raw);
      if (target.databaseName && target.databaseName.trim().length > 0) {
        url.pathname = `/${target.databaseName.trim()}`;
      }
      connStr = url.toString();
    } catch {
      connStr = raw;
    }
    const adapter = new PgInspectionAdapter({ connectionString: connStr });
    return {
      port: adapter,
      cleanup: () => adapter.close(),
    };
  }

  /**
   * Performs comprehensive pre-execution validation prior to touching the target database.
   */
  private async validatePreExecution(sessionId: string): Promise<{
    session: MigrationSessionEntity;
    target: TargetDatabaseMetadata;
    statements: string[];
    fingerprintHash: string;
  }> {
    const session = await this.sessionRepo.findById(sessionId);
    if (!session) {
      throw new SessionNotFoundError(sessionId);
    }

    // 1. Must be in APPROVED status
    if (session.status !== 'APPROVED') {
      throw new IllegalActionError(
        `Cannot execute migration: Session '${sessionId}' is in '${session.status}' status. Human approval is strictly required.`,
        'Session must be in APPROVED status.'
      );
    }

    // 2. Must possess an active APPROVED decision
    if (!session.approvalDecision || session.approvalDecision.status !== 'APPROVED') {
      throw new IllegalActionError(
        'Cannot execute migration: No APPROVED decision recorded for session.',
        'ApprovalDecision with status APPROVED is required.'
      );
    }

    // 3. Approver must be recorded
    if (
      !session.approvalDecision.approver ||
      session.approvalDecision.approver.trim().length === 0
    ) {
      throw new IllegalActionError(
        'Cannot execute migration: Approver identity is missing from approval decision.',
        'Approver identity required.'
      );
    }

    // 4. Rehearsal result must exist and be SUCCESS
    if (!session.sandboxResult || session.sandboxResult.status !== 'SUCCESS') {
      throw new IllegalActionError(
        'Cannot execute migration: Rehearsal evidence is missing or did not succeed.',
        'Successful SandboxRehearsalResult required.'
      );
    }

    // 5. Rehearsal ID must match approved rehearsal ID
    if (session.sandboxResult.rehearsalId !== session.approvalDecision.rehearsalId) {
      throw new IllegalActionError(
        'Cannot execute migration: Rehearsal run does not match approved rehearsal ID.',
        'Rehearsal ID mismatch.'
      );
    }

    // 6. Cryptographic fingerprint must match active session state
    const currentFingerprint = ApprovalFingerprintGenerator.compute(session);
    if (session.approvalDecision.fingerprint !== currentFingerprint.fingerprintHash) {
      // Invalidate drifted approval
      session.invalidateApproval('Fingerprint mismatch detected prior to live execution.');
      await this.sessionRepo.save(session);

      throw new IllegalActionError(
        'Cannot execute migration: Cryptographic fingerprint mismatch. Migration SQL or target database was altered after approval.',
        'Fingerprint mismatch against approval decision.'
      );
    }

    // 7. Extract statements and verify non-empty
    const rawSql = session.request.proposedMigration.rawSql;
    const rawStatements = SqlStatementParser.splitStatements(rawSql);
    const statements = rawStatements.filter((s) => SqlStatementParser.hasExecutableContent(s));
    if (statements.length === 0) {
      throw new IllegalActionError(
        'Cannot execute migration: No executable SQL statements found.',
        'Empty SQL statements.'
      );
    }

    // 8. Fail-closed Statement Classification & DML check
    const batch = PostgresTransactionClassifier.classifyBatch(statements);
    if (!batch.valid) {
      const hasDml = batch.classifications.some((c) => c.operation === 'UNSUPPORTED_DML');
      if (hasDml) {
        throw new IllegalActionError(
          'Cannot execute migration: Data manipulation language (DML: INSERT/UPDATE/DELETE/MERGE) is unsupported for live execution in SchemaSentry. SchemaSentry strictly executes schema/DDL migrations.',
          'Unsupported DML migration.'
        );
      }
      throw new IllegalActionError(
        `Cannot execute migration: ${batch.unsupportedReasons.join('; ')}`,
        'Unsupported statement classification.'
      );
    }

    // 9. Target database metadata & schema validation
    const target = session.request.targetDatabase;
    if (target.schemaName && target.schemaName.trim() !== '') {
      if (!isValidIdentifier(target.schemaName)) {
        throw new IllegalActionError(
          `Cannot execute migration: Invalid target schema identifier '${target.schemaName}'.`,
          'Invalid schema identifier.'
        );
      }
    }

    // 10. Target connectivity check
    const connectivity = await this.executionPort.verifyTargetConnectivity(target);
    if (!connectivity.connected) {
      throw new IllegalActionError(
        `Cannot execute migration: Target database connectivity probe failed. ${connectivity.error || 'Connection refused.'}`,
        'Target unreachable.'
      );
    }

    return {
      session,
      target,
      statements,
      fingerprintHash: currentFingerprint.fingerprintHash,
    };
  }

  /**
   * Captures target schema metadata for parity diffing using the target-specific inspection port.
   */
  private async captureTargetSnapshot(
    target: TargetDatabaseMetadata,
    inspectionPort: PostgresInspectionPort
  ): Promise<FullTableInspection[]> {
    const schemaName = target.schemaName || 'public';
    const tables = await inspectionPort.inspectTables(schemaName);
    const fullInspections: FullTableInspection[] = [];
    for (const t of tables) {
      const full = await inspectionPort.inspectFullTable(t.schemaName || schemaName, t.tableName);
      fullInspections.push(full);
    }
    return fullInspections;
  }

  /**
   * Executes the controlled live migration workflow.
   */
  public async execute(dto: ExecuteMigrationDto): Promise<LiveExecutionEvidence> {
    const { sessionId, actor, timeoutMs, confirmExecution } = dto;

    // Validate explicit confirmation if provided at DTO level
    if (confirmExecution !== undefined && confirmExecution !== true) {
      throw new ValidationError(
        "Field 'confirmExecution' must be explicitly set to true to execute a live migration."
      );
    }

    // Validate timeoutMs: positive safe integer between 1 and 600,000 ms
    if (timeoutMs !== undefined && timeoutMs !== null) {
      if (
        typeof timeoutMs !== 'number' ||
        !Number.isFinite(timeoutMs) ||
        !Number.isInteger(timeoutMs) ||
        timeoutMs < 1 ||
        timeoutMs > 600000
      ) {
        throw new ValidationError(
          "Field 'timeoutMs' must be a positive integer between 1 and 600000 milliseconds if provided."
        );
      }
    }

    const executionId = `exec_${Date.now()}_${randomUUID().slice(0, 8)}`;
    const startedAt = new Date().toISOString();

    this.logger.info('Initiating live migration execution workflow', {
      sessionId,
      executionId,
      actor,
    });

    // 1. Acquire Execution Lock
    ExecutionLock.acquire(sessionId);

    let sessionEntity: MigrationSessionEntity | undefined;
    let effectiveActor = actor || 'ReleaseEngineer';
    let cleanupInspection: (() => Promise<void>) | undefined;

    try {
      // 2. Pre-Execution Validation
      const { session, target, statements, fingerprintHash } =
        await this.validatePreExecution(sessionId);

      sessionEntity = session;
      effectiveActor = actor || session.approvalDecision?.approver || 'ReleaseEngineer';

      // 3. Resolve Target-Specific Inspection Port
      const inspection = this.getInspectionPort(target);
      cleanupInspection = inspection.cleanup;

      // 4. Pre-Execution Snapshot on exact target database
      this.logger.info('Capturing pre-execution snapshot on target database', {
        databaseName: target.databaseName,
        schemaName: target.schemaName,
      });
      const preExecutionSnapshot = await this.captureTargetSnapshot(target, inspection.port);

      // 5. Transition state to EXECUTING
      session.beginExecution(effectiveActor);
      await this.sessionRepo.save(session);

      // 6. Execute Approved SQL against target
      this.logger.info('Executing approved statements on target database', {
        executionId,
        statementsCount: statements.length,
      });

      const effectiveTimeout = timeoutMs || 60000;
      const execOutcome = await this.executionPort.executeApprovedMigration(target, statements, {
        timeoutMs: effectiveTimeout,
      });

      const completedAt = new Date().toISOString();
      const durationMs = execOutcome.totalDurationMs;

      // 7. Handle Execution Failure
      if (!execOutcome.success) {
        this.logger.error('Live execution failed on target database', {
          executionId,
          error: execOutcome.errorMessage,
          errorCode: execOutcome.errorCode,
        });

        const execResult: ExecutionResult = {
          executionId,
          status: 'FAILED',
          startedAt,
          completedAt,
          durationMs,
          statementsExecuted: execOutcome.statementsExecuted,
          statementResults: execOutcome.statementResults,
          logs: [
            `Execution failed at statement ${execOutcome.statementsExecuted + 1}`,
            execOutcome.errorMessage || 'Unknown database error',
          ],
          errorMessage: execOutcome.errorMessage,
          errorCode: execOutcome.errorCode,
          executedBy: effectiveActor,
        };

        session.recordExecutionResult(execResult, effectiveActor);
        await this.sessionRepo.save(session);

        const postExecutionSnapshot = await this.captureTargetSnapshot(target, inspection.port);
        const schemaDiff = SchemaDiffCalculator.calculateDiff(
          preExecutionSnapshot,
          postExecutionSnapshot
        );

        const sanitizedTarget: TargetDatabaseMetadata = {
          ...target,
          connectionString: target.connectionString
            ? sanitizeConnectionString(target.connectionString)
            : undefined,
        };

        return {
          executionId,
          sessionId,
          migrationId: session.request.proposedMigration.migrationId,
          approvalId: session.approvalDecision?.decisionId || '',
          approvalFingerprint: fingerprintHash,
          targetDatabase: sanitizedTarget,
          startedAt,
          completedAt,
          durationMs,
          statementsAttempted: statements.length,
          statementsSucceeded: execOutcome.statementsExecuted,
          failedStatementIndex: execOutcome.statementsExecuted,
          errorCode: execOutcome.errorCode,
          preExecutionSnapshot: preExecutionSnapshot as unknown as Record<string, unknown>,
          postExecutionSnapshot: postExecutionSnapshot as unknown as Record<string, unknown>,
          schemaDiff,
          verificationResult: {
            verificationId: `ver_${Date.now()}`,
            status: 'FAILED',
            verifiedAt: completedAt,
            durationMs: 0,
            checks: [],
            healthSummary: {
              connectionPoolOk: false,
              schemaMatchesExpected: false,
              indexStatusValid: false,
              latencyUnderThreshold: false,
            },
            errorMessage: execOutcome.errorMessage,
          },
          finalStatus: 'EXECUTION_FAILED',
        };
      }

      // 8. Record Execution Success (Session transitions to VERIFYING)
      const execResult: ExecutionResult = {
        executionId,
        status: 'SUCCESS',
        startedAt,
        completedAt,
        durationMs,
        statementsExecuted: execOutcome.statementsExecuted,
        statementResults: execOutcome.statementResults,
        logs: [
          `Successfully executed ${execOutcome.statementsExecuted} statements on target database.`,
        ],
        executedBy: effectiveActor,
      };

      session.recordExecutionResult(execResult, effectiveActor);
      await this.sessionRepo.save(session);

      // 9. Capture Post-Execution Snapshot & Verification
      this.logger.info('Capturing post-execution snapshot and running verification probes', {
        executionId,
      });

      const verificationStart = performance.now();
      const postExecutionSnapshot = await this.captureTargetSnapshot(target, inspection.port);
      const schemaDiff = SchemaDiffCalculator.calculateDiff(
        preExecutionSnapshot,
        postExecutionSnapshot
      );

      // Automated Verification Checks
      const checks: VerificationCheck[] = [];

      // Check 1: Schema Parity against Approved Rehearsal Diff
      const expectedRehearsalDiff = session.rehearsalEvidence?.schemaDifferences;

      const diffComparison = SchemaDiffCalculator.compareDiffs(schemaDiff, expectedRehearsalDiff);
      const schemaParityPassed = diffComparison.matches;

      checks.push({
        checkId: `chk_${randomUUID().slice(0, 8)}`,
        name: 'Schema Parity Probe',
        category: 'SCHEMA_PARITY',
        passed: schemaParityPassed,
        message: schemaParityPassed
          ? `Schema modifications verified against rehearsal: ${schemaDiff.summary.length > 0 ? schemaDiff.summary.join('; ') : 'No structural modifications expected or detected.'}`
          : `Schema parity mismatch with approved rehearsal: ${diffComparison.mismatchReasons.join('; ')}`,
        durationMs: Math.round(performance.now() - verificationStart),
        details: {
          differencesCount: schemaDiff.summary.length,
          mismatchReasons: diffComparison.mismatchReasons,
        },
      });

      // Check 2: Connection Pool Health Probe
      const connectivity = await this.executionPort.verifyTargetConnectivity(target);
      checks.push({
        checkId: `chk_${randomUUID().slice(0, 8)}`,
        name: 'Target Connectivity & Latency Probe',
        category: 'CONNECTION_POOL',
        passed: connectivity.connected,
        message: connectivity.connected
          ? `Connection healthy (latency: ${connectivity.latencyMs}ms)`
          : `Connection unhealthy: ${connectivity.error}`,
        durationMs: connectivity.latencyMs,
      });

      // Check 3: Index Validity
      const invalidIndexes = postExecutionSnapshot.flatMap((t) =>
        (t.indexes || []).filter((idx) => idx.isValid === false)
      );
      const indexesValid = invalidIndexes.length === 0;
      checks.push({
        checkId: `chk_${randomUUID().slice(0, 8)}`,
        name: 'Index Validity Probe',
        category: 'INDEX_VALIDITY',
        passed: indexesValid,
        message: indexesValid
          ? 'All target indexes are in valid state'
          : `Found invalid indexes: ${invalidIndexes.map((i) => i.indexName).join(', ')}`,
        durationMs: 5,
      });

      const allPassed = checks.every((c) => c.passed);
      const verificationDurationMs = Math.round(performance.now() - verificationStart);

      const verificationResult: VerificationResult = {
        verificationId: `ver_${Date.now()}_${randomUUID().slice(0, 8)}`,
        status: allPassed ? 'PASSED' : 'FAILED',
        verifiedAt: new Date().toISOString(),
        durationMs: verificationDurationMs,
        checks,
        healthSummary: {
          connectionPoolOk: connectivity.connected,
          schemaMatchesExpected: schemaParityPassed,
          indexStatusValid: indexesValid,
          latencyUnderThreshold: connectivity.latencyMs < 1000,
        },
        errorMessage: allPassed ? undefined : 'One or more verification checks failed.',
      };

      // 10. Record Verification Result (Session transitions to COMPLETED or VERIFICATION_FAILED)
      session.recordVerificationResult(verificationResult, effectiveActor);
      await this.sessionRepo.save(session);

      const finalStatus = allPassed ? 'COMPLETED' : 'VERIFICATION_FAILED';

      this.logger.info('Live migration workflow completed', {
        sessionId,
        executionId,
        finalStatus,
      });

      const sanitizedTarget: TargetDatabaseMetadata = {
        ...target,
        connectionString: target.connectionString
          ? sanitizeConnectionString(target.connectionString)
          : undefined,
      };

      return {
        executionId,
        sessionId,
        migrationId: session.request.proposedMigration.migrationId,
        approvalId: session.approvalDecision?.decisionId || '',
        approvalFingerprint: fingerprintHash,
        targetDatabase: sanitizedTarget,
        startedAt,
        completedAt,
        durationMs,
        statementsAttempted: statements.length,
        statementsSucceeded: execOutcome.statementsExecuted,
        preExecutionSnapshot,
        postExecutionSnapshot,
        schemaDiff,
        verificationResult,
        finalStatus,
      };
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      if (sessionEntity) {
        if (sessionEntity.status === 'EXECUTING') {
          this.logger.error(
            'Unexpected exception during EXECUTING phase, persisting EXECUTION_FAILED',
            {
              sessionId,
              error: error.message,
            }
          );
          sessionEntity.recordExecutionFailure(
            error.message || 'Unexpected execution failure',
            effectiveActor
          );
          try {
            await this.sessionRepo.save(sessionEntity);
          } catch (saveErr) {
            this.logger.error('Failed to persist EXECUTION_FAILED state on session', {
              error: saveErr instanceof Error ? saveErr.message : String(saveErr),
            });
          }
        } else if (sessionEntity.status === 'VERIFYING') {
          this.logger.error(
            'Unexpected exception during VERIFYING phase, persisting VERIFICATION_FAILED',
            {
              sessionId,
              error: error.message,
            }
          );
          sessionEntity.recordVerificationFailure(
            error.message || 'Unexpected verification failure',
            effectiveActor
          );
          try {
            await this.sessionRepo.save(sessionEntity);
          } catch (saveErr) {
            this.logger.error('Failed to persist VERIFICATION_FAILED state on session', {
              error: saveErr instanceof Error ? saveErr.message : String(saveErr),
            });
          }
        }
      }
      throw error;
    } finally {
      // Release execution lock in finally block
      ExecutionLock.release(sessionId);
      if (cleanupInspection) {
        try {
          await cleanupInspection();
        } catch {
          // Ignore inspection cleanup error
        }
      }
    }
  }
}
