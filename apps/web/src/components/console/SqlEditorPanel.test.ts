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

  it('Finding #5: Preserves comment-like tokens inside string literals', () => {
    const rawSql =
      "ALTER TABLE public.events ADD COLUMN description text DEFAULT 'note: -- not a comment and /* not a block */';";
    const normalized = normalizeSql(rawSql);
    expect(normalized).toBe(
      "alter table public.events add column description text default 'note: -- not a comment and /* not a block */'"
    );
  });

  it('Finding #5: Strips line comments, block comments, trailing semicolons and folds whitespace', () => {
    const testCases = [
      {
        // 1. SQL with -- comment
        input: '-- leading comment\nALTER TABLE public.users ADD COLUMN bio text; -- trailing',
        expected: 'alter table public.users add column bio text',
      },
      {
        // 2. SQL with /* */ block comment
        input: 'ALTER TABLE /* inline comment */ public.users ADD COLUMN bio text;',
        expected: 'alter table public.users add column bio text',
      },
      {
        // 3. SQL with trailing semicolon
        input: 'ALTER TABLE public.users ADD COLUMN bio text;;;',
        expected: 'alter table public.users add column bio text',
      },
      {
        // 4. SQL with irregular multi-line whitespace
        input: '   ALTER   TABLE \n\n   public.users \t ADD  COLUMN  bio  text   ',
        expected: 'alter table public.users add column bio text',
      },
      {
        // 5. SQL with literal string containing double-dash and block comment syntax
        input:
          "INSERT INTO public.audit_logs (message) VALUES ('System update -- trigger /* run */ complete');",
        expected:
          "insert into public.audit_logs (message) values ('system update -- trigger /* run */ complete')",
      },
      {
        // 6. SQL with escaped single quotes inside literal
        input: "INSERT INTO public.users (bio) VALUES ('it''s a valid string');",
        expected: "insert into public.users (bio) values ('it''s a valid string')",
      },
      {
        // 7. SQL containing identifier resembling placeholder tokens
        input: "SELECT ___sqllit_0___, 'x' FROM public.metrics;",
        expected: "select ___sqllit_0___, 'x' from public.metrics",
      },
      {
        // 8. Tagged dollar-quoted function body containing semicolons and comments
        input:
          'CREATE FUNCTION test() RETURNS void AS $body$ BEGIN -- inner comment;\n RETURN; END; $body$ LANGUAGE plpgsql;',
        expected:
          'create function test() returns void as $body$ begin -- inner comment; return; end; $body$ language plpgsql',
      },
      {
        // 9. Untagged dollar-quoted procedure body
        input: 'CREATE PROCEDURE test2() LANGUAGE plpgsql AS $$ BEGIN /* block inside */; END; $$;',
        expected:
          'create procedure test2() language plpgsql as $$ begin /* block inside */; end; $$',
      },
    ];

    for (const tc of testCases) {
      expect(normalizeSql(tc.input)).toBe(tc.expected);
    }
  });
});
