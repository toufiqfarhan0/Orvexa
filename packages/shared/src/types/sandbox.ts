/**
 * Status of the sandbox rehearsal run.
 */
export type SandboxRehearsalStatus = 'SUCCESS' | 'FAILED' | 'TIMED_OUT';

/**
 * Result metrics and logs from a dry-run / rehearsal executed in an isolated PostgreSQL sandbox.
 */
export interface SandboxRehearsalResult {
  rehearsalId: string;
  status: SandboxRehearsalStatus;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  simulatedLockAcquisitionMs: number;
  rowsAffected: number;
  statementsExecuted: number;
  rollbackVerified: boolean;
  logs: string[];
  errorMessage?: string;
  sandboxEnvironmentId?: string;
}
