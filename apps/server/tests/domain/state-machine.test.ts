import { describe, it, expect } from 'vitest';
import {
  canTransition,
  assertValidTransition,
  isTerminalStatus,
  VALID_STATE_TRANSITIONS,
} from '../../src/domain/state-machine.js';
import { InvalidStateTransitionError } from '../../src/domain/errors.js';
import type { MigrationSessionStatus } from '@orvexa/shared';

describe('Domain State Machine (State Transitions)', () => {
  it('allows valid progressive transitions in the migration lifecycle', () => {
    expect(canTransition('DRAFT', 'ANALYZING')).toBe(true);
    expect(canTransition('ANALYZING', 'SANDBOX_RUNNING')).toBe(true);
    expect(canTransition('SANDBOX_RUNNING', 'AWAITING_APPROVAL')).toBe(true);
    expect(canTransition('AWAITING_APPROVAL', 'APPROVED')).toBe(true);
    expect(canTransition('AWAITING_APPROVAL', 'REJECTED')).toBe(true);
    expect(canTransition('APPROVED', 'EXECUTING')).toBe(true);
    expect(canTransition('EXECUTING', 'VERIFYING')).toBe(true);
    expect(canTransition('VERIFYING', 'COMPLETED')).toBe(true);
  });

  it('allows valid failure branch transitions', () => {
    expect(canTransition('ANALYZING', 'ANALYSIS_FAILED')).toBe(true);
    expect(canTransition('SANDBOX_RUNNING', 'SANDBOX_FAILED')).toBe(true);
    expect(canTransition('EXECUTING', 'EXECUTION_FAILED')).toBe(true);
    expect(canTransition('VERIFYING', 'VERIFICATION_FAILED')).toBe(true);
  });

  it('allows valid recovery transitions from failure states', () => {
    expect(canTransition('ANALYSIS_FAILED', 'ANALYZING')).toBe(true);
    expect(canTransition('SANDBOX_FAILED', 'SANDBOX_RUNNING')).toBe(true);
    expect(canTransition('SANDBOX_FAILED', 'ANALYZING')).toBe(true);
    expect(canTransition('REJECTED', 'ANALYZING')).toBe(true);
    expect(canTransition('REJECTED', 'DRAFT')).toBe(true);
    expect(canTransition('EXECUTION_FAILED', 'DRAFT')).toBe(true);
  });

  it('disallows illegal skipping transitions', () => {
    // Cannot skip from DRAFT directly to EXECUTING or COMPLETED
    expect(canTransition('DRAFT', 'EXECUTING')).toBe(false);
    expect(canTransition('DRAFT', 'COMPLETED')).toBe(false);
    expect(canTransition('DRAFT', 'APPROVED')).toBe(false);

    // Cannot skip from ANALYZING directly to APPROVED
    expect(canTransition('ANALYZING', 'APPROVED')).toBe(false);

    // Cannot skip from AWAITING_APPROVAL directly to EXECUTING without approval
    expect(canTransition('AWAITING_APPROVAL', 'EXECUTING')).toBe(false);

    // Cannot jump from REJECTED directly to EXECUTING
    expect(canTransition('REJECTED', 'EXECUTING')).toBe(false);
  });

  it('marks COMPLETED as a strictly terminal state with 0 outgoing transitions', () => {
    expect(isTerminalStatus('COMPLETED')).toBe(true);
    expect(VALID_STATE_TRANSITIONS['COMPLETED'].size).toBe(0);

    const allStatuses: MigrationSessionStatus[] = [
      'DRAFT',
      'ANALYZING',
      'ANALYSIS_FAILED',
      'SANDBOX_RUNNING',
      'SANDBOX_FAILED',
      'AWAITING_APPROVAL',
      'APPROVED',
      'REJECTED',
      'EXECUTING',
      'EXECUTION_FAILED',
      'VERIFYING',
      'VERIFICATION_FAILED',
    ];

    for (const status of allStatuses) {
      expect(canTransition('COMPLETED', status)).toBe(false);
      expect(() => assertValidTransition('COMPLETED', status, 'session-123')).toThrow(
        InvalidStateTransitionError
      );
    }
  });

  it('assertValidTransition throws InvalidStateTransitionError with informative error code and message', () => {
    expect(() =>
      assertValidTransition(
        'DRAFT',
        'COMPLETED',
        'test-session-42',
        'Direct completion not allowed'
      )
    ).toThrowError(InvalidStateTransitionError);

    try {
      assertValidTransition(
        'DRAFT',
        'COMPLETED',
        'test-session-42',
        'Direct completion not allowed'
      );
    } catch (err) {
      expect(err).toBeInstanceOf(InvalidStateTransitionError);
      const error = err as InvalidStateTransitionError;
      expect(error.code).toBe('INVALID_STATE_TRANSITION');
      expect(error.fromStatus).toBe('DRAFT');
      expect(error.toStatus).toBe('COMPLETED');
      expect(error.sessionId).toBe('test-session-42');
      expect(error.message).toContain(
        "Session [test-session-42] Cannot transition from 'DRAFT' to 'COMPLETED'"
      );
    }
  });
});
