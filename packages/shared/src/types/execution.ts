import type { SchemaDiffResult } from './rehearsal.js';
import type { VerificationResult } from './verification.js';
import type { TargetDatabaseMetadata } from './migration.js';
import type { FullTableInspection } from './database-inspection.js';

/**
 * Status of the production execution phase.
 */
export type ExecutionStatus = 'SUCCESS' | 'FAILED' | 'CANCELLED';

/**
 * Statement execution detail during live execution.
 */
export interface LiveStatementResult {
  statementIndex: number;
  sql: string;
  executionTimeMs: number;
  rowsAffected?: number;
  command?: string;
  status: 'SUCCESS' | 'FAILED';
  errorMessage?: string;
  errorCode?: string;
}

/**
 * Result record from executing the approved migration against the target database.
 */
export interface ExecutionResult {
  executionId: string;
  status: ExecutionStatus;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  statementsExecuted: number;
  affectedRowCount?: number;
  statementResults?: LiveStatementResult[];
  logs: string[];
  errorMessage?: string;
  errorCode?: string;
  executedBy: string;
}

/**
 * Comprehensive execution evidence produced post live execution and verification.
 */
export interface LiveExecutionEvidence {
  executionId: string;
  sessionId: string;
  migrationId: string;
  approvalId: string;
  approvalFingerprint: string;
  targetDatabase: TargetDatabaseMetadata;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  statementsAttempted: number;
  statementsSucceeded: number;
  failedStatementIndex?: number;
  errorCode?: string;
  preExecutionSnapshot: FullTableInspection[] | Record<string, unknown>;
  postExecutionSnapshot: FullTableInspection[] | Record<string, unknown>;
  schemaDiff: SchemaDiffResult;
  verificationResult: VerificationResult;
  finalStatus: 'COMPLETED' | 'EXECUTION_FAILED' | 'VERIFICATION_FAILED';
}

/**
 * Input DTO for triggering live migration execution.
 */
export interface ExecuteMigrationDto {
  sessionId: string;
  actor?: string;
  timeoutMs?: number;
}

/**
 * Public REST API response contract for live execution endpoint,
 * strictly omitting raw credentials, secrets, or internal database connections.
 */
export interface SanitizedLiveExecutionResponse {
  executionId: string;
  sessionId: string;
  migrationId: string;
  approvalId: string;
  approvalFingerprint: string;
  targetDatabase: {
    engine: string;
    version: string;
    databaseName: string;
    schemaName: string;
  };
  startedAt: string;
  completedAt: string;
  durationMs: number;
  statementsAttempted: number;
  statementsSucceeded: number;
  failedStatementIndex?: number;
  errorCode?: string;
  schemaDiff: SchemaDiffResult;
  verificationResult?: VerificationResult;
  finalStatus: 'COMPLETED' | 'EXECUTION_FAILED' | 'VERIFICATION_FAILED';
  session?: unknown;
}
