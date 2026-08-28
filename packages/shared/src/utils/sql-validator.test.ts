import { describe, it, expect } from 'vitest';
import { validateSqlInput } from './sql-validator.js';

describe('validateSqlInput Safeguards (Qodo Findings #7 & #8)', () => {
  it('rejects empty, whitespace-only, or comment-only inputs', () => {
    expect(validateSqlInput('')).toEqual({
      valid: false,
      reason: 'Migration SQL is required and must not be empty.',
    });
    expect(validateSqlInput('   \n\t  ')).toEqual({
      valid: false,
      reason: 'Migration SQL is required and must not be empty.',
    });
    expect(validateSqlInput(null)).toEqual({
      valid: false,
      reason: 'Migration SQL is required and must not be empty.',
    });
    expect(validateSqlInput('-- only a comment\n/* block comment */')).toEqual({
      valid: false,
      reason: 'Migration SQL contains only comments and no executable SQL statements.',
    });
  });

  it('Finding #8: rejects arbitrary plain text that is not valid SQL', () => {
    const plainText1 = validateSqlInput('this is not SQL');
    expect(plainText1.valid).toBe(false);
    expect(plainText1.reason).toContain('Input must be a valid SQL statement');

    const plainText2 = validateSqlInput('hello world please update my database');
    expect(plainText2.valid).toBe(false);
  });

  it('rejects arbitrary programming code (Python, JS, C, etc.)', () => {
    expect(validateSqlInput('import os\nos.system("rm -rf /")').valid).toBe(false);
    expect(validateSqlInput('def calculate_total(a, b):\n  return a + b').valid).toBe(false);
    expect(validateSqlInput('console.log("Hello world");').valid).toBe(false);
    expect(validateSqlInput('const user = { name: "alice" };').valid).toBe(false);
    expect(validateSqlInput('function test() { alert(1); }').valid).toBe(false);
    expect(validateSqlInput('#include <stdio.h>\nint main() { return 0; }').valid).toBe(false);
    expect(validateSqlInput('<?php echo "test"; ?>').valid).toBe(false);
  });

  it('Finding #7: accepts valid PostgreSQL IMPORT FOREIGN SCHEMA statements', () => {
    const importSql = `IMPORT FOREIGN SCHEMA remote_data FROM SERVER foreign_server INTO local_schema;`;
    const res = validateSqlInput(importSql);
    expect(res.valid).toBe(true);
  });

  it('accepts valid PostgreSQL DDL and DML statements with leading comments', () => {
    expect(
      validateSqlInput(
        "-- Baseline migration\nALTER TABLE public.events ADD COLUMN status text NOT NULL DEFAULT 'active';"
      ).valid
    ).toBe(true);

    expect(
      validateSqlInput(
        '/* Multi-line comment */ CREATE TABLE IF NOT EXISTS public.users (id uuid PRIMARY KEY, name text);'
      ).valid
    ).toBe(true);

    expect(
      validateSqlInput('CREATE INDEX CONCURRENTLY idx_users_email ON public.users(email);').valid
    ).toBe(true);

    expect(validateSqlInput('DROP TABLE IF EXISTS public.temp_orders CASCADE;').valid).toBe(true);
    expect(validateSqlInput('TRUNCATE TABLE public.logs;').valid).toBe(true);
    expect(
      validateSqlInput('BEGIN;\nALTER TABLE public.users ADD COLUMN role text;\nCOMMIT;').valid
    ).toBe(true);
  });
});
