/**
 * SQL validation helper ensuring that candidate migration text contains valid SQL
 * and blocks arbitrary programming code (Python, JS, C, shell) or plain text from being sent to sandbox.
 */

export interface SqlValidationResult {
  valid: boolean;
  reason?: string;
}

export function validateSqlInput(rawSql?: string | null): SqlValidationResult {
  if (!rawSql || typeof rawSql !== 'string' || rawSql.trim().length === 0) {
    return {
      valid: false,
      reason: 'Migration SQL is required and must not be empty.',
    };
  }

  const clean = rawSql.trim();

  // Obvious non-SQL programming code signatures (Python, JS, TypeScript, C, Shell)
  const codeSignatures = [
    /^\s*(import\s+|export\s+|from\s+[a-zA-Z0-9_]+\s+import|def\s+[a-zA-Z0-9_]+\s*\(|class\s+[a-zA-Z0-9_]+[:\(]|print\s*\(|console\.log|function\s+[a-zA-Z0-9_]*\s*\(|const\s+[a-zA-Z0-9_]+\s*=|let\s+[a-zA-Z0-9_]+\s*=|var\s+[a-zA-Z0-9_]+\s*=|package\s+[a-zA-Z0-9_]+;|#include\s*<)/i,
    /^\s*(<\?php|<html>|<!DOCTYPE|require\s*\(|module\.exports)/i,
  ];

  for (const sig of codeSignatures) {
    if (sig.test(clean)) {
      return {
        valid: false,
        reason:
          'Input appears to be programming code or non-SQL script. Please enter valid PostgreSQL DDL statements (e.g. ALTER TABLE, CREATE TABLE, CREATE INDEX).',
      };
    }
  }

  return { valid: true };
}
