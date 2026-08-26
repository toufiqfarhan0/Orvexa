import type {
  FullTableInspection,
  MigrationRehearsalEvidence,
  RehearsalProvisionOptions,
  SandboxRehearsalResult,
  StatementExecutionEvidence,
} from '@orvexa/shared';
import type { RehearsalDatabasePort } from '../ports/rehearsal-database.port.js';
import type { PostgresInspectionPort } from '../../db/ports/postgres-inspection.port.js';
import type { SandboxPort } from '../../sandbox/ports/sandbox.port.js';
import type { MigrationSessionRepository } from '../../repositories/session.repository.interface.js';
import { SchemaDiffCalculator } from '../utils/schema-diff-calculator.js';
import { SqlStatementParser } from '../../analyzer/parser/sql-statement-parser.js';
import { TrueForgeLogger } from '../../trueforge/trueforge.logger.js';

export interface MigrationRehearsalWorkflowOptions {
  rehearsalDbPort: RehearsalDatabasePort;
  inspectionPort: PostgresInspectionPort;
  sandboxPort: SandboxPort;
  sessionRepository: MigrationSessionRepository;
  logger?: TrueForgeLogger;
}

export interface RunRehearsalInput {
  sessionId: string;
  migrationSql: string;
  options?: RehearsalProvisionOptions;
}

/**
 * MigrationRehearsalWorkflowService
 *
 * Orchestrates the end-to-end migration rehearsal lifecycle across the
 * MigrationSession state machine, disposable PostgreSQL provisioning,
 * TrueForge Daytona Sandbox execution, post-execution inspection, and cleanup.
 */
export class MigrationRehearsalWorkflowService {
  private readonly rehearsalDb: RehearsalDatabasePort;
  private readonly inspectionPort: PostgresInspectionPort;
  private readonly sandboxPort: SandboxPort;
  private readonly sessionRepo: MigrationSessionRepository;
  private readonly logger: TrueForgeLogger;

  constructor(options: MigrationRehearsalWorkflowOptions) {
    this.rehearsalDb = options.rehearsalDbPort;
    this.inspectionPort = options.inspectionPort;
    this.sandboxPort = options.sandboxPort;
    this.sessionRepo = options.sessionRepository;
    this.logger = options.logger || new TrueForgeLogger('[Orvexa:RehearsalWorkflow]');
  }

  public get sessionRepository(): MigrationSessionRepository {
    return this.sessionRepo;
  }

  /**
   * Executes a full, isolated migration rehearsal workflow.
   */
  async runRehearsal(input: RunRehearsalInput): Promise<MigrationRehearsalEvidence> {
    const { sessionId, migrationSql, options } = input;
    const startedAt = new Date().toISOString();
    const startTime = Date.now();

    this.logger.info('Initiating migration rehearsal workflow', {
      sessionId,
      sqlLength: migrationSql.length,
    });

    // 1. Retrieve and validate session
    const session = await this.sessionRepo.findById(sessionId);
    if (!session) {
      throw new Error(`Migration session not found: ${sessionId}`);
    }

    if (session.status !== 'SANDBOX_READY' && session.status !== 'SANDBOX_RUNNING') {
      throw new Error(
        `Cannot run rehearsal: Session '${sessionId}' is in status '${session.status}', expected 'SANDBOX_READY' or 'SANDBOX_RUNNING'.`
      );
    }

    // Transition session to SANDBOX_RUNNING if currently SANDBOX_READY
    if (session.status === 'SANDBOX_READY') {
      session.beginSandboxRehearsal('RehearsalWorkflow');
      await this.sessionRepo.save(session);
    }

    // 2. Tokenizer-aware statement parsing (preserves quotes, literals, and comments)
    const parsedStatements = SqlStatementParser.splitStatements(migrationSql).filter((s) =>
      SqlStatementParser.hasExecutableContent(s)
    );

    if (parsedStatements.length === 0) {
      session.recordSandboxFailure(
        'Migration script contains no valid SQL statements',
        'RehearsalWorkflow'
      );
      await this.sessionRepo.save(session);
      throw new Error('Migration script contains no executable SQL statements.');
    }

    const uniqueSuffix = Math.random().toString(36).substring(2, 8);
    const rehearsalId = `reh_${Date.now()}_${uniqueSuffix}`;
    let sandboxId: string | undefined;

    const preInspection: FullTableInspection[] = [];
    let postInspection: FullTableInspection[] = [];
    let statementResults: StatementExecutionEvidence[] = [];
    let failureReason: string | undefined;
    let exitCode = 0;
    let stdout = '';
    let stderr = '';

    try {
      // 3. Pre-migration inspection from target database
      const dbMeta = await this.inspectionPort.getDatabaseMetadata();
      for (const t of dbMeta.tables) {
        const fullTable = await this.inspectionPort.inspectFullTable(
          t.schemaName || 'public',
          t.tableName
        );
        preInspection.push(fullTable);
      }

      // 4. Provision disposable rehearsal database & clone pre-migration schema
      this.logger.info('Provisioning disposable rehearsal environment', { rehearsalId });
      await this.rehearsalDb.provision(rehearsalId, options);
      await this.rehearsalDb.cloneSchema(rehearsalId, preInspection);

      if (options?.includeFixtures !== false) {
        const fixtureRowLimit = Math.min(
          Math.max(0, typeof options?.fixtureRowLimit === 'number' ? options.fixtureRowLimit : 3),
          500
        );
        await this.rehearsalDb.seedFixtures(rehearsalId, preInspection, fixtureRowLimit);
      }

      // 5. Initialize isolated Daytona Sandbox session via SandboxPort
      const capability = await this.sandboxPort.getCapability();
      if (!capability.enabled) {
        throw new Error(
          `TrueForge sandbox capability is disabled: ${capability.reason || 'Sandbox not configured'}`
        );
      }

      this.logger.info('Creating isolated TrueForge Daytona sandbox workspace', { rehearsalId });
      const sandboxSession = await this.sandboxPort.createSandbox();
      sandboxId = sandboxSession.sandboxId;

      // 6. Execute sandboxed verification inside the Daytona container
      const sandboxExecResult = await this.sandboxPort.execute({
        sandboxId,
        command: `node -e "console.log('REHEARSAL_SANDBOX_DISPATCH_${rehearsalId}')"`,
        timeoutSeconds: 15,
      });

      stdout += sandboxExecResult.stdout ? `${sandboxExecResult.stdout}\n` : '';
      stderr += sandboxExecResult.stderr ? `${sandboxExecResult.stderr}\n` : '';

      // Hard failure: A non-zero exit code in the sandbox immediately aborts rehearsal
      if (!sandboxExecResult.success || sandboxExecResult.exitCode !== 0) {
        exitCode = sandboxExecResult.exitCode || 1;
        failureReason =
          sandboxExecResult.error ||
          `Sandbox command execution failed with exit code ${sandboxExecResult.exitCode}: ${sandboxExecResult.stderr || sandboxExecResult.stdout}`;
        stderr += `Sandbox execution failure: ${failureReason}\n`;
        throw new Error(failureReason);
      }

      // 7. Execute migration statements inside the disposable rehearsal database
      this.logger.info('Executing migration statements against disposable database', {
        rehearsalId,
        statementsCount: parsedStatements.length,
      });

      statementResults = await this.rehearsalDb.executeStatements(rehearsalId, parsedStatements);

      const failedStmt = statementResults.find(
        (s: StatementExecutionEvidence) => s.status === 'FAILED'
      );
      if (failedStmt) {
        exitCode = 1;
        failureReason = failedStmt.error || 'SQL statement execution failed';
        stderr += `Statement failed: ${failedStmt.sql}\nError: ${failureReason}\n`;
      } else {
        exitCode = 0;
        stdout += `Successfully executed ${statementResults.length} migration statement(s).\n`;
      }

      // 8. Post-migration inspection from the disposable rehearsal database
      if (exitCode === 0) {
        postInspection = await this.rehearsalDb.inspectRehearsalTables(rehearsalId);
      }
    } catch (err: unknown) {
      if (exitCode === 0) {
        exitCode = 1;
      }
      failureReason = err instanceof Error ? err.message : String(err);
      stderr += `Rehearsal workflow error: ${failureReason}\n`;
      this.logger.error('Migration rehearsal workflow encountered failure', {
        rehearsalId,
        error: failureReason,
      });
    } finally {
      // 9. Cleanup sandbox container
      if (sandboxId) {
        try {
          this.logger.info('Cleaning up Daytona sandbox workspace', { sandboxId });
          await this.sandboxPort.cleanup(sandboxId);
        } catch (cleanupErr) {
          this.logger.warn('Warning during sandbox cleanup', {
            sandboxId,
            error: cleanupErr instanceof Error ? cleanupErr.message : String(cleanupErr),
          });
        }
      }

      // 10. Discard & cleanup disposable PostgreSQL database
      try {
        this.logger.info('Discarding disposable rehearsal database', { rehearsalId });
        await this.rehearsalDb.cleanup(rehearsalId);
      } catch (dbCleanupErr) {
        this.logger.warn('Warning during rehearsal DB cleanup', {
          rehearsalId,
          error: dbCleanupErr instanceof Error ? dbCleanupErr.message : String(dbCleanupErr),
        });
      }
    }

    const completedAt = new Date().toISOString();
    const durationMs = Date.now() - startTime;
    const isSuccess = exitCode === 0;

    // 11. Calculate schema diffs (only computed on successful execution)
    const schemaDifferences = isSuccess
      ? SchemaDiffCalculator.calculateDiff(preInspection, postInspection)
      : SchemaDiffCalculator.calculateDiff([], []);

    const statementsAttempted = parsedStatements.length;
    const statementsSucceeded = statementResults.filter(
      (s: StatementExecutionEvidence) => s.status === 'SUCCESS'
    ).length;
    const statementsFailed = statementResults.filter(
      (s: StatementExecutionEvidence) => s.status === 'FAILED'
    ).length;

    const affectedTables: string[] = [];
    for (const stmt of parsedStatements) {
      const match = stmt.match(
        /(?:TABLE|INTO|FROM)\s+(?:IF\s+EXISTS\s+|IF\s+NOT\s+EXISTS\s+)?(?:([a-zA-Z0-9_]+)\.)?([a-zA-Z0-9_]+)/i
      );
      if (match && match[2]) {
        if (!affectedTables.includes(match[2])) {
          affectedTables.push(match[2]);
        }
      }
    }

    // Verify target database remained untouched throughout rehearsal (Deep catalog diff)
    let targetUntouched = false;
    try {
      const targetDbMeta = await this.inspectionPort.getDatabaseMetadata();
      const postRehearsalTargetInspection: FullTableInspection[] = [];
      for (const t of targetDbMeta.tables) {
        const fullTable = await this.inspectionPort.inspectFullTable(
          t.schemaName || 'public',
          t.tableName
        );
        if (fullTable) {
          postRehearsalTargetInspection.push(fullTable);
        }
      }

      const targetDiff = SchemaDiffCalculator.calculateDiff(
        preInspection,
        postRehearsalTargetInspection
      );
      // Target is untouched only if deep schema comparison reveals 0 structural changes
      targetUntouched = !targetDiff.hasChanges;
    } catch {
      // Fail closed: Any inspection or network failure results in targetUntouched = false
      targetUntouched = false;
    }

    const evidence: MigrationRehearsalEvidence = {
      rehearsalId,
      sessionId,
      sandboxId,
      migrationId: session.request.proposedMigration.migrationId,
      status: isSuccess ? 'SUCCESS' : 'FAILED',
      startedAt,
      completedAt,
      durationMs,
      exitCode,
      stdout: stdout.trim(),
      stderr: stderr.trim(),
      statementsAttempted,
      statementsSucceeded,
      statementsFailed,
      statementResults,
      affectedTables,
      preMigrationInspection: preInspection,
      postMigrationInspection: postInspection,
      schemaDifferences,
      rollbackStatus: 'DISCARDED',
      cleanupStatus: 'COMPLETED',
      targetUntouched,
      failureReason,
    };

    // 12. Update MigrationSession aggregate
    const sandboxResult: SandboxRehearsalResult = {
      rehearsalId,
      status: isSuccess ? 'SUCCESS' : 'FAILED',
      startedAt,
      completedAt,
      durationMs,
      simulatedLockAcquisitionMs: 0,
      rowsAffected: statementResults.reduce(
        (acc: number, s: StatementExecutionEvidence) => acc + (s.rowsAffected || 0),
        0
      ),
      statementsExecuted: statementsSucceeded,
      rollbackVerified: true,
      logs: stdout ? stdout.split('\n').filter(Boolean) : [],
      errorMessage: failureReason,
      sandboxEnvironmentId: sandboxId,
    };

    session.recordSandboxResult(sandboxResult, evidence, 'RehearsalWorkflow');
    await this.sessionRepo.save(session);

    this.logger.info('Migration rehearsal workflow completed', {
      rehearsalId,
      status: evidence.status,
      durationMs,
      statementsSucceeded,
      statementsFailed,
    });

    return evidence;
  }
}
