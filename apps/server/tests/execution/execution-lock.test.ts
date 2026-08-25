import { describe, it, expect, beforeEach } from 'vitest';
import { ExecutionLock } from '../../src/execution/utils/execution-lock.js';
import { IllegalActionError } from '../../src/domain/errors.js';

describe('ExecutionLock (Unit Tests)', () => {
  beforeEach(() => {
    ExecutionLock.reset();
  });

  it('1. Acquires and releases lock cleanly for a session', () => {
    expect(ExecutionLock.isLocked('sess-1')).toBe(false);
    ExecutionLock.acquire('sess-1');
    expect(ExecutionLock.isLocked('sess-1')).toBe(true);
    ExecutionLock.release('sess-1');
    expect(ExecutionLock.isLocked('sess-1')).toBe(false);
  });

  it('2. Throws IllegalActionError when acquiring a duplicate lock on active session', () => {
    ExecutionLock.acquire('sess-dup');
    expect(() => ExecutionLock.acquire('sess-dup')).toThrow(IllegalActionError);
    expect(() => ExecutionLock.acquire('sess-dup')).toThrow(
      /Execution is already in progress for session/
    );
  });

  it('3. Allows distinct sessions to lock independently', () => {
    ExecutionLock.acquire('sess-a');
    ExecutionLock.acquire('sess-b');

    expect(ExecutionLock.isLocked('sess-a')).toBe(true);
    expect(ExecutionLock.isLocked('sess-b')).toBe(true);

    ExecutionLock.release('sess-a');
    expect(ExecutionLock.isLocked('sess-a')).toBe(false);
    expect(ExecutionLock.isLocked('sess-b')).toBe(true);
  });
});
