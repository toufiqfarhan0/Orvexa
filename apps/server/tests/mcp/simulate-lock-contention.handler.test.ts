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
    expect(result.conflictingOperations.insertsUpdatesDeletes).toBe(true);
    expect(result.riskAssessment.readerStarvationRisk).toBe('CRITICAL');
    expect(result.riskAssessment.applicationDowntimeRequired).toBe(true);
    expect(result.lockMatrix.length).toBeGreaterThan(0);
  });

  it('evaluates SHARE_UPDATE_EXCLUSIVE non-blocking mode correctly', () => {
    const result = handler.handle({
      table: 'orders',
      proposedLockMode: 'SHARE_UPDATE_EXCLUSIVE',
    });

    expect(result.conflictingOperations.selects).toBe(false);
    expect(result.conflictingOperations.insertsUpdatesDeletes).toBe(false);
    expect(result.riskAssessment.readerStarvationRisk).toBe('NONE');
    expect(result.riskAssessment.applicationDowntimeRequired).toBe(false);
  });
});
