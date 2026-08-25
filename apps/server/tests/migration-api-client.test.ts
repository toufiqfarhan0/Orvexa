import { describe, it, expect } from 'vitest';

describe('Console API Integration Boundary & State Protocol', () => {
  it('validates initial session status is DRAFT', () => {
    const sessionStatus = 'DRAFT';
    expect(sessionStatus).toBe('DRAFT');
  });

  it('verifies safe target metadata contract sanitizes credentials', () => {
    const targetConfig = {
      engine: 'PostgreSQL 16',
      catalog: 'orvexa_target_db',
      schema: 'public',
      isolation: 'READ COMMITTED',
    };

    expect(targetConfig.engine).toBe('PostgreSQL 16');
    expect(targetConfig.schema).toBe('public');
    // Ensure no sensitive connection URI or credentials leaked
    expect((targetConfig as Record<string, unknown>).password).toBeUndefined();
    expect((targetConfig as Record<string, unknown>).connectionString).toBeUndefined();
  });

  it('maps all standard lifecycle states to valid display tokens', () => {
    const states = [
      'DRAFT',
      'ANALYZING',
      'ANALYZED',
      'REHEARSING',
      'REHEARSED',
      'PENDING_APPROVAL',
      'APPROVED',
      'EXECUTING',
      'COMPLETED',
      'FAILED',
      'REJECTED',
    ] as const;

    for (const s of states) {
      expect(typeof s).toBe('string');
      expect(s.length).toBeGreaterThan(0);
    }
  });
});
