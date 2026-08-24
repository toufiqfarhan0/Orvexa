import type { MigrationSessionStatus } from '@orvexa/shared';
import { InvalidStateTransitionError } from './errors.js';

/**
 * Deterministic transition map defining every valid transition between migration session statuses.
 */
export const VALID_STATE_TRANSITIONS: Readonly<
  Record<MigrationSessionStatus, ReadonlySet<MigrationSessionStatus>>
> = {
  DRAFT: new Set<MigrationSessionStatus>(['ANALYZING']),

  ANALYZING: new Set<MigrationSessionStatus>(['SANDBOX_RUNNING', 'ANALYSIS_FAILED']),

  ANALYSIS_FAILED: new Set<MigrationSessionStatus>(['ANALYZING', 'DRAFT']),

  SANDBOX_RUNNING: new Set<MigrationSessionStatus>(['AWAITING_APPROVAL', 'SANDBOX_FAILED']),

  SANDBOX_FAILED: new Set<MigrationSessionStatus>(['SANDBOX_RUNNING', 'ANALYZING', 'DRAFT']),

  AWAITING_APPROVAL: new Set<MigrationSessionStatus>(['APPROVED', 'REJECTED']),

  APPROVED: new Set<MigrationSessionStatus>(['EXECUTING']),

  REJECTED: new Set<MigrationSessionStatus>(['DRAFT', 'ANALYZING']),

  EXECUTING: new Set<MigrationSessionStatus>(['VERIFYING', 'EXECUTION_FAILED']),

  EXECUTION_FAILED: new Set<MigrationSessionStatus>(['EXECUTING', 'DRAFT']),

  VERIFYING: new Set<MigrationSessionStatus>(['COMPLETED', 'VERIFICATION_FAILED']),

  VERIFICATION_FAILED: new Set<MigrationSessionStatus>(['VERIFYING', 'COMPLETED']),

  COMPLETED: new Set<MigrationSessionStatus>([]), // Terminal state
};

/**
 * Checks whether a transition from one status to another is legally permitted.
 */
export function canTransition(
  fromStatus: MigrationSessionStatus,
  toStatus: MigrationSessionStatus
): boolean {
  const allowed = VALID_STATE_TRANSITIONS[fromStatus];
  return allowed ? allowed.has(toStatus) : false;
}

/**
 * Asserts that a state transition is valid, throwing an InvalidStateTransitionError if not.
 */
export function assertValidTransition(
  fromStatus: MigrationSessionStatus,
  toStatus: MigrationSessionStatus,
  sessionId?: string,
  reason?: string
): void {
  if (!canTransition(fromStatus, toStatus)) {
    throw new InvalidStateTransitionError(fromStatus, toStatus, sessionId, reason);
  }
}

/**
 * Returns true if the status is an immutable terminal state.
 */
export function isTerminalStatus(status: MigrationSessionStatus): boolean {
  return VALID_STATE_TRANSITIONS[status].size === 0;
}
