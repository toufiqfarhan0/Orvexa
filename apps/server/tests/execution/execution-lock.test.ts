import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ExecutionLock } from '../../src/execution/utils/execution-lock.js';
import { IllegalActionError } from '../../src/domain/errors.js';

describe('ExecutionLock (Unit Tests)', () => {
  beforeEach(() => {
    ExecutionLock.reset();
  });

  it('1. Acquires and releases lock cleanly for a session', () => {
    expect(ExecutionLock.isLocked('sess-1')).toBe(false);
    ExecutionLock.acquire('sess-1', 'Engineer-1');
    expect(ExecutionLock.isLocked('sess-1')).toBe(true);
    ExecutionLock.release('sess-1');
    expect(ExecutionLock.isLocked('sess-1')).toBe(false);
  });

  it('2. Throws IllegalActionError when acquiring a duplicate lock on active session', () => {
    ExecutionLock.acquire('sess-dup', 'Engineer-1');
    expect(() => ExecutionLock.acquire('sess-dup', 'Engineer-2')).toThrow(IllegalActionError);
    expect(() => ExecutionLock.acquire('sess-dup')).toThrow(
      /Execution is already in progress for session 'sess-dup'/
    );
  });

  it('3. Allows re-acquisition after release', () => {
    ExecutionLock.acquire('sess-reacquire', 'User-A');
    expect(ExecutionLock.isLocked('sess-reacquire')).toBe(true);
    ExecutionLock.release('sess-reacquire');
    expect(ExecutionLock.isLocked('sess-reacquire')).toBe(false);

    // Can be acquired again after release
    expect(() => ExecutionLock.acquire('sess-reacquire', 'User-B')).not.toThrow();
    expect(ExecutionLock.isLocked('sess-reacquire')).toBe(true);
  });

  it('4. Lock remains held indefinitely without arbitrary auto-release expiration', async () => {
    vi.useFakeTimers();
    try {
      ExecutionLock.acquire('sess-long-running', 'DBA');
      expect(ExecutionLock.isLocked('sess-long-running')).toBe(true);

      // Advance time by 300 seconds (well past the old 120s timer)
      vi.advanceTimersByTime(300000);

      // Lock MUST still be held because there is no unconditional auto-release
      expect(ExecutionLock.isLocked('sess-long-running')).toBe(true);
      expect(() => ExecutionLock.acquire('sess-long-running')).toThrow(IllegalActionError);

      ExecutionLock.release('sess-long-running');
      expect(ExecutionLock.isLocked('sess-long-running')).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it('5. Allows distinct sessions to lock independently', () => {
    ExecutionLock.acquire('sess-a', 'Actor-A');
    ExecutionLock.acquire('sess-b', 'Actor-B');

    expect(ExecutionLock.isLocked('sess-a')).toBe(true);
    expect(ExecutionLock.isLocked('sess-b')).toBe(true);

    ExecutionLock.release('sess-a');
    expect(ExecutionLock.isLocked('sess-a')).toBe(false);
    expect(ExecutionLock.isLocked('sess-b')).toBe(true);
  });
});
