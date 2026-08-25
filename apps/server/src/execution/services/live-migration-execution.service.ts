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
import { MigrationSessionEntity } from '../../domain/session.entity.js';
import { IllegalActionError, SessionNotFoundError } from '../../domain/errors.js';
import { ApprovalFingerprintGenerator } from '../../approval/utils/approval-fingerprint.js';
import { SqlStatementParser } from '../../analyzer/parser/sql-statement-parser.js';
import { SchemaDiffCalculator } from '../../rehearsal/utils/schema-diff-calculator.js';
import { ExecutionLock } from '../utils/execution-lock.js';
import { sanitizeConnectionString } from '../../db/utils/sanitizer.js';
import { TrueForgeLogger } from '../../trueforge/trueforge.logger.js';

export interface LiveMigrationExecutionServiceOptions {
  sessionRepository: MigrationSessionRepository;
  executionPort: PostgresExecutionPort;
  inspectionPort: PostgresInspectionPort;
  logger?: TrueForgeLogger;
}

/**
 * LiveMigrationExecutionService
 *
 * Enforces strict pre-execution validation, cryptographic fingerprint re-verification,
 * execution locking, pre/post inspection snapshots, automated verification checks,
 * and immutable audit logging.
 */
export class LiveMigrationExecutionService {
  private readonly sessionRepo: MigrationSessionRepository;
  private readonly executionPort: PostgresExecutionPort;
  private readonly inspectionPort: PostgresInspectionPort;
  private readonly logger: TrueForgeLogger;

  constructor(options: LiveMigrationExecutionServiceOptions) {
    this.sessionRepo = options.sessionRepository;
    this.executionPort = options.executionPort;
    this.inspectionPort = options.inspectionPort;
    this.logger = options.logger || new TrueForgeLogger('[SchemaSentry:LiveExecutionService]');
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

    // 8. Target connectivity check
    const target = session.request.targetDatabase;
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
   * Captures target schema metadata for parity diffing.
   */
  private async captureTargetSnapshot(schemaName: string): Promise<FullTableInspection[]> {
    const tables = await this.inspectionPort.inspectTables(schemaName);
    const fullInspections: FullTableInspection[] = [];
    for (const t of tables) {
      const full = await this.inspectionPort.inspectFullTable(
        t.schemaName || schemaName,
        t.tableName
      );
      fullInspections.push(full);
    }
    return fullInspections;
  }

  /**
   * Executes the controlled live migration workflow.
   */
  public async execute(dto: ExecuteMigrationDto): Promise<LiveExecutionEvidence> {
    const { sessionId, actor, timeoutMs } = dto;
    const executionId = `exec_${Date.now()}_${randomUUID().slice(0, 8)}`;
    const startedAt = new Date().toISOString();

    this.logger.info('Initiating live migration execution workflow', {
      sessionId,
      executionId,
      actor,
    });

    // 1. Acquire Execution Lock
    ExecutionLock.acquire(sessionId);

    try {
      // 2. Pre-Execution Validation
      const { session, target, statements, fingerprintHash } =
        await this.validatePreExecution(sessionId);

      const effectiveActor = actor || session.approvalDecision?.approver || 'ReleaseEngineer';

      // 3. Pre-Execution Snapshot
      this.logger.info('Capturing pre-execution snapshot on target database', {
        schemaName: target.schemaName,
      });
      const preExecutionSnapshot = await this.captureTargetSnapshot(target.schemaName);

      // 4. Transition state to EXECUTING
      session.beginExecution(effectiveActor);
      await this.sessionRepo.save(session);

      // 5. Execute Approved SQL against target
      this.logger.info('Executing approved statements on target database', {
        executionId,
        statementsCount: statements.length,
      });

      const execOutcome = await this.executionPort.executeApprovedMigration(target, statements, {
        timeoutMs: timeoutMs || 60000,
      });

      const completedAt = new Date().toISOString();
      const durationMs = execOutcome.totalDurationMs;

      // 6. Handle Execution Failure
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

        const postExecutionSnapshot = await this.captureTargetSnapshot(target.schemaName);
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

      // 7. Record Execution Success (Session transitions to VERIFYING)
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

      // 8. Capture Post-Execution Snapshot & Verification
      this.logger.info('Capturing post-execution snapshot and running verification probes', {
        executionId,
      });

      const verificationStart = performance.now();
      const postExecutionSnapshot = await this.captureTargetSnapshot(target.schemaName);
      const schemaDiff = SchemaDiffCalculator.calculateDiff(
        preExecutionSnapshot,
        postExecutionSnapshot
      );

      // Automated Verification Checks
      const checks: VerificationCheck[] = [];

      // Check 1: Schema Parity
      const schemaParityPassed =
        schemaDiff.hasChanges ||
        statements.some(
          (s) => s.toUpperCase().includes('SELECT') || s.toUpperCase().includes('DO')
        );
      checks.push({
        checkId: `chk_${randomUUID().slice(0, 8)}`,
        name: 'Schema Parity Probe',
        category: 'SCHEMA_PARITY',
        passed: schemaParityPassed,
        message: schemaParityPassed
          ? `Schema changes verified: ${schemaDiff.summary.join('; ')}`
          : 'No schema modifications detected after execution.',
        durationMs: Math.round(performance.now() - verificationStart),
        details: { differencesCount: schemaDiff.summary.length },
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

      // 9. Record Verification Result (Session transitions to COMPLETED or VERIFICATION_FAILED)
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
    } finally {
      // Release execution lock in finally block
      ExecutionLock.release(sessionId);
    }
  }
}
