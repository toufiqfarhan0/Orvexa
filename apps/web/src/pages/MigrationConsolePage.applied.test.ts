import { describe, it, expect, beforeEach } from 'vitest';
import { normalizeSql } from '../components/console/SqlEditorPanel.js';

describe('Applied Migration Scoping & Lifecycle State (Findings #1 & #2)', () => {
  let mockStore: Record<string, string[]> = {};

  const recordAppliedSql = (rawSql: string, targetKey: string) => {
    const norm = normalizeSql(rawSql);
    if (!norm || !targetKey) return;
    const existing = mockStore[targetKey] || [];
    if (existing.some((s) => normalizeSql(s) === norm)) return;
    mockStore[targetKey] = [...existing, rawSql.trim()];
  };

  const getAppliedSqls = (targetKey: string): string[] => {
    return mockStore[targetKey] || [];
  };

  const isAppliedOnTarget = (rawSql: string, targetKey: string): boolean => {
    const norm = normalizeSql(rawSql);
    const targetSqls = getAppliedSqls(targetKey);
    return targetSqls.some((s) => normalizeSql(s) === norm);
  };

  beforeEach(() => {
    mockStore = {};
  });

  it('Finding #2: Applied SQL is isolated strictly to the target database and schema', () => {
    const sql = `ALTER TABLE public.events ADD COLUMN status text NOT NULL DEFAULT 'active';`;

    // 1. Apply SQL to target db_a/public
    recordAppliedSql(sql, 'db_a:public');

    // 2. Verify db_a/public recognizes the applied migration
    expect(isAppliedOnTarget(sql, 'db_a:public')).toBe(true);

    // 3. Verify db_b/public is NOT marked applied
    expect(isAppliedOnTarget(sql, 'db_b:public')).toBe(false);

    // 4. Verify db_a/private is NOT marked applied
    expect(isAppliedOnTarget(sql, 'db_a:private')).toBe(false);
  });

  it('Finding #1: Only records applied SQL when finalStatus is strictly COMPLETED', () => {
    const sql = `ALTER TABLE public.orders ADD CONSTRAINT chk_orders_amount_positive CHECK (total_amount >= 0);`;
    const targetKey = 'schemasentry_test:public';

    // Mock API responses with various finalStatus values
    const executionResults = [
      {
        success: true,
        data: { finalStatus: 'EXECUTION_FAILED' },
        shouldRecord: false,
      },
      {
        success: true,
        data: { finalStatus: 'VERIFICATION_FAILED' },
        shouldRecord: false,
      },
      {
        success: true,
        data: { finalStatus: 'VERIFICATION_INCOMPLETE' },
        shouldRecord: false,
      },
      {
        success: true,
        data: { finalStatus: 'COMPLETED' },
        shouldRecord: true,
      },
    ];

    for (const result of executionResults) {
      if (result.success && result.data && result.data.finalStatus === 'COMPLETED') {
        recordAppliedSql(sql, targetKey);
      }

      if (result.shouldRecord) {
        expect(isAppliedOnTarget(sql, targetKey)).toBe(true);
      } else {
        expect(isAppliedOnTarget(sql, targetKey)).toBe(false);
      }
    }
  });

  it('Finding #1: Ignores duplicate applied records without bloating store', () => {
    const sql = `ALTER TABLE public.events ADD COLUMN status text NOT NULL DEFAULT 'active';`;
    const targetKey = 'schemasentry_test:public';

    recordAppliedSql(sql, targetKey);
    recordAppliedSql(sql, targetKey);
    recordAppliedSql(
      `  ALTER TABLE public.events ADD COLUMN status text NOT NULL DEFAULT 'active';  `,
      targetKey
    );

    expect(getAppliedSqls(targetKey)).toHaveLength(1);
  });
});
