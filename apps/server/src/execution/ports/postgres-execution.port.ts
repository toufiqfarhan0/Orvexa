import type { TargetDatabaseMetadata } from '@orvexa/shared';

/**
 * Result of an individual statement executed against the live target database.
 */
export interface StatementExecutionOutcome {
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
 * Aggregated live execution outcome.
 */
export interface LiveExecutionResult {
  success: boolean;
  statementsExecuted: number;
  statementsFailed: number;
  totalDurationMs: number;
  statementResults: StatementExecutionOutcome[];
  errorMessage?: string;
  errorCode?: string;
}

/**
 * Port contract for executing approved migrations against a controlled PostgreSQL target.
 * Guarantees bounded timeouts, non-destructive safety, and strict execution logging.
 */
export interface PostgresExecutionPort {
  /**
   * Verifies target database reachability and measure connection latency.
   */
  verifyTargetConnectivity(
    target: TargetDatabaseMetadata
  ): Promise<{ connected: boolean; latencyMs: number; error?: string }>;

  /**
   * Executes the exact sequence of approved statements against the target database.
   */
  executeApprovedMigration(
    target: TargetDatabaseMetadata,
    statements: string[],
    options?: { timeoutMs?: number; statementTimeoutMs?: number }
  ): Promise<LiveExecutionResult>;
}
