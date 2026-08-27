import { describe, it, expect } from 'vitest';
import { SimulateLockContentionHandler } from '../../src/mcp/handlers/simulate-lock-contention.handler.js';

describe('SimulateLockContentionHandler', () => {
  const handler = new SimulateLockContentionHandler();

  it('evaluates ACCESS_EXCLUSIVE lock conflicts correctly', () => {
    const result = handler.handle({
      table: 'users',
      schema: 'public',
      proposedLockMode: 'ACCESS_EXCLUSIVE',
    });

    expect(result.target.table).toBe('users');
    expect(result.conflictingOperations.selects).toBe(true);
    expect(result.conflictingOperations.selectForUpdate).toBe(true);
    expect(result.conflictingOperations.insertsUpdatesDeletes).toBe(true);
    expect(result.conflictingOperations.vacuumAnalyze).toBe(true);
    expect(result.conflictingOperations.concurrentIndexBuilds).toBe(true);
    expect(result.riskAssessment.readerStarvationRisk).toBe('CRITICAL');
    expect(result.riskAssessment.applicationDowntimeRequired).toBe(true);
    expect(result.lockMatrix.length).toBeGreaterThan(0);

    const sfuRow = result.lockMatrix.find((r) => r.operation.includes('SELECT FOR UPDATE'));
    expect(sfuRow?.conflictsWithProposed).toBe(true);
    expect(sfuRow?.impactDescription).toContain('BLOCKED');
  });

  it('evaluates SHARE mode correctly: does NOT block SELECT FOR UPDATE / ROW SHARE (Qodo Regression)', () => {
    const result = handler.handle({
      table: 'audit_logs',
      proposedLockMode: 'SHARE',
    });

    // PostgreSQL conflict matrix: SHARE does NOT conflict with ACCESS SHARE (SELECT) or ROW SHARE (SELECT FOR UPDATE)
    expect(result.conflictingOperations.selects).toBe(false);
    expect(result.conflictingOperations.selectForUpdate).toBe(false);
    // But SHARE DOES conflict with ROW EXCLUSIVE (writes) and SHARE UPDATE EXCLUSIVE (autovacuum)
    expect(result.conflictingOperations.insertsUpdatesDeletes).toBe(true);
    expect(result.conflictingOperations.vacuumAnalyze).toBe(true);
    expect(result.conflictingOperations.concurrentIndexBuilds).toBe(true);
    expect(result.riskAssessment.applicationDowntimeRequired).toBe(false);

    // Verify detailed lockMatrix row for SELECT FOR UPDATE
    const sfuRow = result.lockMatrix.find((r) => r.operation.includes('SELECT FOR UPDATE'));
    expect(sfuRow).toBeDefined();
    expect(sfuRow?.lockAcquired).toBe('ROW SHARE');
    expect(sfuRow?.conflictsWithProposed).toBe(false);
    expect(sfuRow?.impactDescription).toBe('ALLOWED: Row-level locks proceed.');

    // Verify SELECT row is also allowed
    const selectRow = result.lockMatrix.find((r) =>
      r.operation.includes('SELECT (Application Reads)')
    );
    expect(selectRow?.conflictsWithProposed).toBe(false);
    expect(selectRow?.impactDescription).toContain('ALLOWED');
  });

  it('evaluates EXCLUSIVE lock mode: blocks SELECT FOR UPDATE but allows basic SELECT', () => {
    const result = handler.handle({
      table: 'payments',
      proposedLockMode: 'EXCLUSIVE',
    });

    expect(result.conflictingOperations.selects).toBe(false);
    expect(result.conflictingOperations.selectForUpdate).toBe(true);
    expect(result.conflictingOperations.insertsUpdatesDeletes).toBe(true);
    expect(result.riskAssessment.readerStarvationRisk).toBe('HIGH');
    expect(result.riskAssessment.applicationDowntimeRequired).toBe(true);
  });

  it('evaluates SHARE_ROW_EXCLUSIVE mode correctly', () => {
    const result = handler.handle({
      table: 'accounts',
      proposedLockMode: 'SHARE_ROW_EXCLUSIVE',
    });

    expect(result.conflictingOperations.selects).toBe(false);
    expect(result.conflictingOperations.selectForUpdate).toBe(false);
    expect(result.conflictingOperations.insertsUpdatesDeletes).toBe(true);
    expect(result.conflictingOperations.vacuumAnalyze).toBe(true);
  });

  it('evaluates SHARE_UPDATE_EXCLUSIVE non-blocking mode correctly', () => {
    const result = handler.handle({
      table: 'orders',
      proposedLockMode: 'SHARE_UPDATE_EXCLUSIVE',
    });

    expect(result.conflictingOperations.selects).toBe(false);
    expect(result.conflictingOperations.selectForUpdate).toBe(false);
    expect(result.conflictingOperations.insertsUpdatesDeletes).toBe(false);
    expect(result.riskAssessment.readerStarvationRisk).toBe('NONE');
    expect(result.riskAssessment.applicationDowntimeRequired).toBe(false);
  });

  it('evaluates ROW_EXCLUSIVE mode correctly', () => {
    const result = handler.handle({
      table: 'events',
      proposedLockMode: 'ROW_EXCLUSIVE',
    });

    expect(result.conflictingOperations.selects).toBe(false);
    expect(result.conflictingOperations.selectForUpdate).toBe(false);
    expect(result.conflictingOperations.insertsUpdatesDeletes).toBe(false);
    expect(result.conflictingOperations.vacuumAnalyze).toBe(false);
    expect(result.conflictingOperations.concurrentIndexBuilds).toBe(false);
  });
});
