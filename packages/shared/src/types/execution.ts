/**
 * Status of the production execution phase.
 */
export type ExecutionStatus = 'SUCCESS' | 'FAILED' | 'CANCELLED';

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
  logs: string[];
  errorMessage?: string;
  executedBy: string;
}
