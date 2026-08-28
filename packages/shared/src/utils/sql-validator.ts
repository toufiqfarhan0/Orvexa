/**
 * SQL validation helper ensuring that candidate migration text contains valid SQL
 * and blocks arbitrary programming code (Python, JS, C, shell) or plain text from being sent to sandbox.
 */

export interface SqlValidationResult {
  valid: boolean;
  reason?: string;
}

// Recognized PostgreSQL statement starting keywords / command prefixes
const VALID_SQL_START_REGEX =
  /^\s*(?:ALTER\s+|CREATE\s+|DROP\s+|TRUNCATE\s+|COMMENT\s+ON\s+|GRANT\s+|REVOKE\s+|INSERT\s+INTO\s+|UPDATE\s+|DELETE\s+FROM\s+|SELECT\s+|WITH\s+|BEGIN\b|START\s+TRANSACTION\b|COMMIT\b|ROLLBACK\b|SET\s+|RESET\s+|DO\s+|CALL\s+|LOCK\s+TABLE\s+|VACUUM\b|ANALYZE\b|REINDEX\s+|REFRESH\s+MATERIALIZED\s+VIEW\s+|IMPORT\s+FOREIGN\s+SCHEMA\s+|EXPLAIN\s+|NOTIFY\s+|LISTEN\s+|DISCARD\s+)/i;

/**
 * Strips leading SQL line comments (-- ...) and block comments (/* ... *\/)
 */
function stripLeadingSqlComments(sql: string): string {
  let cleaned = sql.trim();
  let changed = true;
  while (changed) {
    changed = false;
    // Strip leading line comment
    if (cleaned.startsWith('--')) {
      const newlineIdx = cleaned.indexOf('\n');
      cleaned = newlineIdx === -1 ? '' : cleaned.slice(newlineIdx + 1).trim();
      changed = true;
    }
    // Strip leading block comment
    else if (cleaned.startsWith('/*')) {
      const closeIdx = cleaned.indexOf('*/');
      cleaned = closeIdx === -1 ? '' : cleaned.slice(closeIdx + 2).trim();
      changed = true;
    }
  }
  return cleaned;
}

export function validateSqlInput(rawSql?: string | null): SqlValidationResult {
  if (!rawSql || typeof rawSql !== 'string' || rawSql.trim().length === 0) {
    return {
      valid: false,
      reason: 'Migration SQL is required and must not be empty.',
    };
  }

  const clean = stripLeadingSqlComments(rawSql);

  if (clean.length === 0) {
    return {
      valid: false,
      reason: 'Migration SQL contains only comments and no executable SQL statements.',
    };
  }

  // 1. Obvious non-SQL programming code signatures (Python, JS, TypeScript, C, Shell, PHP, HTML)
  // Note: IMPORT FOREIGN SCHEMA is valid SQL and is preserved
  const codeSignatures = [
    /^\s*(import\s+(?!foreign\s+schema\b)|export\s+|from\s+[a-zA-Z0-9_.]+\s+import|def\s+[a-zA-Z0-9_]+\s*\(|class\s+[a-zA-Z0-9_]+[:(]|print\s*\(|console\.log|function\s+[a-zA-Z0-9_]*\s*\(|const\s+[a-zA-Z0-9_]+\s*=|let\s+[a-zA-Z0-9_]+\s*=|var\s+[a-zA-Z0-9_]+\s*=|package\s+[a-zA-Z0-9_]+;|#include\s*<)/i,
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

  // 2. Reject natural language plain text (e.g. "this is not SQL", "hello world please...")
  const proseSignature =
    /^(?:this|that|there|please|hello|hi|hey|how|what|why|when|where|who|could|would|should|can|i|we|my|your|the|a|an)\s+[a-z]+/i;
  if (proseSignature.test(clean) && !VALID_SQL_START_REGEX.test(clean)) {
    return {
      valid: false,
      reason:
        'Input appears to be plain text or natural language rather than a SQL statement. Please enter valid PostgreSQL statements (e.g. ALTER TABLE, CREATE TABLE, CREATE INDEX).',
    };
  }

  return { valid: true };
}
