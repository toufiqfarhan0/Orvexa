import { IllegalActionError } from '../../domain/errors.js';

/**
 * In-memory single-flight execution lock to prevent concurrent execution on the same migration session.
 * Lock is held explicitly from start of execution until release in a finally block.
 */
export class ExecutionLock {
  private static readonly activeLocks = new Map<string, { acquiredAt: string; actor?: string }>();

  /**
   * Attempts to acquire an execution lock for a session.
   * Throws IllegalActionError if a lock is already held.
   */
  public static acquire(sessionId: string, actor?: string): void {
    if (this.activeLocks.has(sessionId)) {
      const lockInfo = this.activeLocks.get(sessionId);
      throw new IllegalActionError(
        `Execution is already in progress for session '${sessionId}' (acquired at ${lockInfo?.acquiredAt}${lockInfo?.actor ? ` by ${lockInfo.actor}` : ''}).`,
        'Concurrent execution is strictly disallowed.'
      );
    }

    this.activeLocks.set(sessionId, {
      acquiredAt: new Date().toISOString(),
      actor,
    });
  }

  /**
   * Releases the execution lock for a session.
   */
  public static release(sessionId: string): void {
    this.activeLocks.delete(sessionId);
  }

  /**
   * Checks if a session currently holds an active execution lock.
   */
  public static isLocked(sessionId: string): boolean {
    return this.activeLocks.has(sessionId);
  }

  /**
   * Resets all locks (for test isolation/teardown).
   */
  public static reset(): void {
    this.activeLocks.clear();
  }
}
