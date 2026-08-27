import { describe, it, expect } from 'vitest';
import { MIGRATION_PRESETS, normalizeSql } from './SqlEditorPanel.js';

describe('SqlEditorPanel Migration Presets & Canonical Baseline (Findings #3, #4, #5, #6)', () => {
  it('contains exactly 8 categorized presets', () => {
    expect(MIGRATION_PRESETS).toHaveLength(8);
  });

  it('Step 1 preset defines canonical events baseline with event_type, user_id, and organization_id (Finding #5, #6)', () => {
    const step1 = MIGRATION_PRESETS.find((p) => p.id === 'p1_baseline');
    expect(step1).toBeDefined();
    expect(step1?.sql).toContain('event_type text NOT NULL');
    expect(step1?.sql).toContain('organization_id uuid');
    expect(step1?.sql).toContain('user_id uuid');
    expect(step1?.sql).not.toContain('event_name');
  });

  it('Step 3 concurrent index references canonical event_type column on public.events', () => {
    const step3 = MIGRATION_PRESETS.find((p) => p.id === 'p3_concurrent_index');
    expect(step3).toBeDefined();
    expect(step3?.sql).toContain('ON public.events(event_type)');
  });

  it('Step 5 check constraint references canonical total_amount column on public.orders (Finding #3)', () => {
    const step5 = MIGRATION_PRESETS.find((p) => p.id === 'p5_check_constraint');
    expect(step5).toBeDefined();
    expect(step5?.sql).toContain('ALTER TABLE public.orders');
    expect(step5?.sql).toContain('CHECK (total_amount >= 0) NOT VALID;');
    expect(step5?.sql).not.toMatch(/CHECK\s*\(\s*amount\s*>=/i);
  });

  it('Step 6 multi-column batch expands public.users safely', () => {
    const step6 = MIGRATION_PRESETS.find((p) => p.id === 'p6_batch_columns');
    expect(step6).toBeDefined();
    expect(step6?.sql).toContain('ALTER TABLE public.users');
    expect(step6?.sql).toContain('ADD COLUMN IF NOT EXISTS phone text');
    expect(step6?.sql).toContain('ADD COLUMN IF NOT EXISTS avatar_url text');
  });

  it('normalizeSql removes comments, extra whitespace, and semicolons consistently', () => {
    const raw = `
      -- comment line
      /* Multi-line
         block comment */
      ALTER TABLE public.events
      ADD COLUMN status text NOT NULL DEFAULT 'active';;
    `;
    const normalized = normalizeSql(raw);
    expect(normalized).toBe(
      "alter table public.events add column status text not null default 'active'"
    );
  });

  it('matches raw and commented SQL variants of applied statements', () => {
    const appliedStatement =
      "ALTER TABLE public.events ADD COLUMN status text NOT NULL DEFAULT 'active';";
    const userTypedWithComments = `
      -- User added comment
      ALTER TABLE public.events
      ADD COLUMN status text NOT NULL DEFAULT 'active';
    `;
    expect(normalizeSql(appliedStatement)).toBe(normalizeSql(userTypedWithComments));
  });
});
