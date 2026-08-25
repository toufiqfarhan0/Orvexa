import { IllegalActionError } from '../../domain/errors.js';

/**
 * In-memory execution lock guard to prevent concurrent execution on the same migration session.
 */
export class ExecutionLock {
  private static readonly activeLocks = new Map<
    string,
    { acquiredAt: string; timeoutHandle?: NodeJS.Timeout }
  >();

  /**
   * Attempts to acquire an execution lock for a session.
   * Throws IllegalActionError if a lock is already held.
   */
  public static acquire(sessionId: string, lockTimeoutMs: number = 120000): void {
    if (this.activeLocks.has(sessionId)) {
      const lockInfo = this.activeLocks.get(sessionId);
      throw new IllegalActionError(
        `Execution is already in progress for session '${sessionId}' (acquired at ${lockInfo?.acquiredAt}).`,
        'Concurrent execution is strictly disallowed.'
      );
    }

    // Set safety auto-release timer to prevent permanent locks in case of unhandled crashes
    const timeoutHandle = setTimeout(() => {
      ExecutionLock.release(sessionId);
    }, lockTimeoutMs);

    if (timeoutHandle && typeof timeoutHandle.unref === 'function') {
      timeoutHandle.unref();
    }

    this.activeLocks.set(sessionId, {
      acquiredAt: new Date().toISOString(),
      timeoutHandle,
    });
  }

  /**
   * Releases the execution lock for a session.
   */
  public static release(sessionId: string): void {
    const lockInfo = this.activeLocks.get(sessionId);
    if (lockInfo) {
      if (lockInfo.timeoutHandle) {
        clearTimeout(lockInfo.timeoutHandle);
      }
      this.activeLocks.delete(sessionId);
    }
  }

  /**
   * Checks if a session currently holds an active execution lock.
   */
  public static isLocked(sessionId: string): boolean {
    return this.activeLocks.has(sessionId);
  }

  /**
   * Resets all locks (useful for test teardown).
   */
  public static reset(): void {
    for (const [, info] of this.activeLocks) {
      if (info.timeoutHandle) {
        clearTimeout(info.timeoutHandle);
      }
    }
    this.activeLocks.clear();
  }
}
