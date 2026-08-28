import { describe, it, expect } from 'vitest';
import { validateSqlInput } from './sql-validator.js';

describe('validateSqlInput Safeguards', () => {
  it('rejects empty or whitespace-only inputs', () => {
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

  it('accepts valid PostgreSQL DDL and DML statements', () => {
    expect(
      validateSqlInput(
        'ALTER TABLE public.events ADD COLUMN status text NOT NULL DEFAULT "active";'
      ).valid
    ).toBe(true);

    expect(
      validateSqlInput('CREATE TABLE IF NOT EXISTS public.users (id uuid PRIMARY KEY, name text);')
        .valid
    ).toBe(true);

    expect(
      validateSqlInput('CREATE INDEX CONCURRENTLY idx_users_email ON public.users(email);').valid
    ).toBe(true);

    expect(validateSqlInput('DROP TABLE IF EXISTS public.temp_orders CASCADE;').valid).toBe(true);
    expect(validateSqlInput('TRUNCATE TABLE public.logs;').valid).toBe(true);
  });
});
