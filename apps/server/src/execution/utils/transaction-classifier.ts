import { SqlStatementParser } from '../../analyzer/parser/sql-statement-parser.js';

export type StatementTransactionCategory = 'TRANSACTION_SAFE' | 'NON_TRANSACTIONAL' | 'UNSUPPORTED';

export interface StatementClassification {
  statement: string;
  normalizedSql: string;
  category: StatementTransactionCategory;
  operation: string;
  reason?: string;
}

/**
 * PostgreSQL Statement Transaction Classifier.
 * Deterministically classifies SQL migration statements into:
 * - TRANSACTION_SAFE: Can safely execute inside BEGIN ... COMMIT.
 * - NON_TRANSACTIONAL: Prohibited inside transaction blocks in PostgreSQL (e.g. CREATE INDEX CONCURRENTLY, VACUUM).
 * - UNSUPPORTED: Ambiguous, manual transaction control (BEGIN/COMMIT), or unsupported statements that must fail closed.
 */
export class PostgresTransactionClassifier {
  /**
   * Explicit list of regex patterns for TRANSACTION_SAFE statements in PostgreSQL.
   */
  private static readonly TRANSACTION_SAFE_PATTERNS: Array<{
    pattern: RegExp;
    operation: string;
  }> = [
    // 1. Table DDL
    {
      pattern: /^CREATE\s+(?:TEMP\s+|TEMPORARY\s+|UNLOGGED\s+)?TABLE\b/i,
      operation: 'CREATE_TABLE',
    },
    { pattern: /^ALTER\s+TABLE\b/i, operation: 'ALTER_TABLE' },
    { pattern: /^DROP\s+TABLE\b/i, operation: 'DROP_TABLE' },
    { pattern: /^TRUNCATE\s+(?:TABLE\s+)?/i, operation: 'TRUNCATE_TABLE' },

    // 2. Standard Indexes (Without CONCURRENTLY)
    {
      pattern: /^CREATE\s+(?:UNIQUE\s+)?INDEX\s+(?!CONCURRENTLY\b)/i,
      operation: 'CREATE_INDEX',
    },
    {
      pattern: /^DROP\s+INDEX\s+(?!CONCURRENTLY\b)/i,
      operation: 'DROP_INDEX',
    },
    {
      pattern: /^REINDEX\s+(?:TABLE|INDEX|SCHEMA)\s+(?!CONCURRENTLY\b)/i,
      operation: 'REINDEX',
    },

    // 3. Views & Materialized Views (Standard)
    {
      pattern: /^CREATE\s+(?:OR\s+REPLACE\s+)?(?:TEMP\s+|TEMPORARY\s+)?VIEW\b/i,
      operation: 'CREATE_VIEW',
    },
    { pattern: /^ALTER\s+VIEW\b/i, operation: 'ALTER_VIEW' },
    { pattern: /^DROP\s+VIEW\b/i, operation: 'DROP_VIEW' },
    {
      pattern: /^CREATE\s+(?:OR\s+REPLACE\s+)?MATERIALIZED\s+VIEW\b/i,
      operation: 'CREATE_MATERIALIZED_VIEW',
    },
    { pattern: /^ALTER\s+MATERIALIZED\s+VIEW\b/i, operation: 'ALTER_MATERIALIZED_VIEW' },
    { pattern: /^DROP\s+MATERIALIZED\s+VIEW\b/i, operation: 'DROP_MATERIALIZED_VIEW' },
    {
      pattern: /^REFRESH\s+MATERIALIZED\s+VIEW\s+(?!CONCURRENTLY\b)/i,
      operation: 'REFRESH_MATERIALIZED_VIEW',
    },

    // 4. Types & Domains
    { pattern: /^CREATE\s+TYPE\b/i, operation: 'CREATE_TYPE' },
    { pattern: /^ALTER\s+TYPE\b/i, operation: 'ALTER_TYPE' },
    { pattern: /^DROP\s+TYPE\b/i, operation: 'DROP_TYPE' },
    { pattern: /^CREATE\s+DOMAIN\b/i, operation: 'CREATE_DOMAIN' },
    { pattern: /^ALTER\s+DOMAIN\b/i, operation: 'ALTER_DOMAIN' },
    { pattern: /^DROP\s+DOMAIN\b/i, operation: 'DROP_DOMAIN' },

    // 5. Sequences
    {
      pattern: /^CREATE\s+(?:TEMP\s+|TEMPORARY\s+)?SEQUENCE\b/i,
      operation: 'CREATE_SEQUENCE',
    },
    { pattern: /^ALTER\s+SEQUENCE\b/i, operation: 'ALTER_SEQUENCE' },
    { pattern: /^DROP\s+SEQUENCE\b/i, operation: 'DROP_SEQUENCE' },

    // 6. Schemas
    { pattern: /^CREATE\s+SCHEMA\b/i, operation: 'CREATE_SCHEMA' },
    { pattern: /^ALTER\s+SCHEMA\b/i, operation: 'ALTER_SCHEMA' },
    { pattern: /^DROP\s+SCHEMA\b/i, operation: 'DROP_SCHEMA' },

    // 7. Functions, Procedures & Triggers
    {
      pattern: /^CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\b/i,
      operation: 'CREATE_FUNCTION',
    },
    { pattern: /^ALTER\s+FUNCTION\b/i, operation: 'ALTER_FUNCTION' },
    { pattern: /^DROP\s+FUNCTION\b/i, operation: 'DROP_FUNCTION' },
    {
      pattern: /^CREATE\s+(?:OR\s+REPLACE\s+)?PROCEDURE\b/i,
      operation: 'CREATE_PROCEDURE',
    },
    { pattern: /^ALTER\s+PROCEDURE\b/i, operation: 'ALTER_PROCEDURE' },
    { pattern: /^DROP\s+PROCEDURE\b/i, operation: 'DROP_PROCEDURE' },
    { pattern: /^CREATE\s+(?:OR\s+REPLACE\s+)?TRIGGER\b/i, operation: 'CREATE_TRIGGER' },
    { pattern: /^ALTER\s+TRIGGER\b/i, operation: 'ALTER_TRIGGER' },
    { pattern: /^DROP\s+TRIGGER\b/i, operation: 'DROP_TRIGGER' },

    // 8. Permissions & Comments
    { pattern: /^COMMENT\s+ON\b/i, operation: 'COMMENT_ON' },
    { pattern: /^GRANT\b/i, operation: 'GRANT' },
    { pattern: /^REVOKE\b/i, operation: 'REVOKE' },

    // 9. Data Manipulation & Anonymous Blocks
    { pattern: /^INSERT\s+INTO\b/i, operation: 'INSERT' },
    { pattern: /^UPDATE\b/i, operation: 'UPDATE' },
    { pattern: /^DELETE\s+FROM\b/i, operation: 'DELETE' },
    { pattern: /^SELECT\b/i, operation: 'SELECT' },
    { pattern: /^DO\b/i, operation: 'DO_BLOCK' },
    { pattern: /^SET\s+(?!TRANSACTION\b)/i, operation: 'SET_CONFIG' },
  ];

  /**
   * Explicit list of regex patterns for NON_TRANSACTIONAL statements in PostgreSQL.
   * PostgreSQL strictly prohibits these from executing inside a BEGIN ... COMMIT block.
   */
  private static readonly NON_TRANSACTIONAL_PATTERNS: Array<{
    pattern: RegExp;
    operation: string;
    reason: string;
  }> = [
    {
      pattern: /^CREATE\s+(?:UNIQUE\s+)?INDEX\s+CONCURRENTLY\b/i,
      operation: 'CREATE_INDEX_CONCURRENTLY',
      reason:
        'PostgreSQL error 25001: CREATE INDEX CONCURRENTLY cannot run inside a transaction block.',
    },
    {
      pattern: /^DROP\s+INDEX\s+CONCURRENTLY\b/i,
      operation: 'DROP_INDEX_CONCURRENTLY',
      reason:
        'PostgreSQL error 25001: DROP INDEX CONCURRENTLY cannot run inside a transaction block.',
    },
    {
      pattern: /^REINDEX\s+(?:TABLE|INDEX|DATABASE|SYSTEM)?\s*CONCURRENTLY\b/i,
      operation: 'REINDEX_CONCURRENTLY',
      reason: 'PostgreSQL error 25001: REINDEX CONCURRENTLY cannot run inside a transaction block.',
    },
    {
      pattern: /^REFRESH\s+MATERIALIZED\s+VIEW\s+CONCURRENTLY\b/i,
      operation: 'REFRESH_MATERIALIZED_VIEW_CONCURRENTLY',
      reason:
        'PostgreSQL error 25001: REFRESH MATERIALIZED VIEW CONCURRENTLY cannot run inside a transaction block.',
    },
    {
      pattern: /^VACUUM\b/i,
      operation: 'VACUUM',
      reason: 'PostgreSQL error 25001: VACUUM cannot run inside a transaction block.',
    },
    {
      pattern: /^CLUSTER\b/i,
      operation: 'CLUSTER',
      reason: 'PostgreSQL error 25001: CLUSTER cannot run inside a transaction block.',
    },
    {
      pattern: /^CREATE\s+DATABASE\b/i,
      operation: 'CREATE_DATABASE',
      reason: 'PostgreSQL error 25001: CREATE DATABASE cannot run inside a transaction block.',
    },
    {
      pattern: /^ALTER\s+DATABASE\b/i,
      operation: 'ALTER_DATABASE',
      reason: 'Database-level configuration change cannot run inside a session transaction block.',
    },
    {
      pattern: /^DROP\s+DATABASE\b/i,
      operation: 'DROP_DATABASE',
      reason: 'PostgreSQL error 25001: DROP DATABASE cannot run inside a transaction block.',
    },
    {
      pattern: /^ALTER\s+SYSTEM\b/i,
      operation: 'ALTER_SYSTEM',
      reason: 'Server-level configuration modification cannot run inside a transaction block.',
    },
    {
      pattern: /^DISCARD\s+(?:ALL|PLANS|SEQUENCES|TEMP)\b/i,
      operation: 'DISCARD',
      reason: 'Session state discard commands cannot run inside a transaction block.',
    },
  ];

  /**
   * Explicit list of UNSUPPORTED statements (e.g. manual transaction control).
   */
  private static readonly UNSUPPORTED_PATTERNS: Array<{
    pattern: RegExp;
    operation: string;
    reason: string;
  }> = [
    {
      pattern: /^(?:BEGIN|START\s+TRANSACTION)\b/i,
      operation: 'BEGIN_TRANSACTION',
      reason:
        'Manual transaction control (BEGIN / START TRANSACTION) inside migration scripts is strictly prohibited. SchemaSentry manages transactional boundaries.',
    },
    {
      pattern: /^(?:COMMIT|END)\b/i,
      operation: 'COMMIT_TRANSACTION',
      reason:
        'Manual transaction control (COMMIT / END) inside migration scripts is strictly prohibited.',
    },
    {
      pattern: /^ROLLBACK\b/i,
      operation: 'ROLLBACK_TRANSACTION',
      reason:
        'Manual transaction control (ROLLBACK) inside migration scripts is strictly prohibited.',
    },
    {
      pattern: /^SAVEPOINT\b/i,
      operation: 'SAVEPOINT',
      reason: 'Manual savepoint commands inside migration scripts are unsupported.',
    },
    {
      pattern: /^RELEASE\s+SAVEPOINT\b/i,
      operation: 'RELEASE_SAVEPOINT',
      reason: 'Manual savepoint release commands inside migration scripts are unsupported.',
    },
    {
      pattern: /^SET\s+TRANSACTION\b/i,
      operation: 'SET_TRANSACTION',
      reason: 'Manual transaction isolation modification inside migration scripts is unsupported.',
    },
    {
      pattern: /^LISTEN\b|^NOTIFY\b|^UNLISTEN\b/i,
      operation: 'PUB_SUB_COMMAND',
      reason:
        'Asynchronous notification commands (LISTEN/NOTIFY) are unsupported in live migration scripts.',
    },
    {
      pattern: /^COPY\s+.*FROM\s+STDIN/i,
      operation: 'COPY_STREAM',
      reason: 'Streaming COPY FROM STDIN commands are unsupported in live execution.',
    },
  ];

  /**
   * Classifies a SQL statement into a deterministic category.
   * Fail-closed: Any unrecognized statement is classified as UNSUPPORTED.
   */
  public static classify(statementSql: string): StatementClassification {
    const normalized = SqlStatementParser.normalizeSql(statementSql);

    if (normalized.length === 0) {
      return {
        statement: statementSql,
        normalizedSql: normalized,
        category: 'UNSUPPORTED',
        operation: 'EMPTY_STATEMENT',
        reason: 'Statement contains no executable SQL tokens.',
      };
    }

    // 1. Check Explicit Unsupported / Prohibited Patterns
    for (const item of this.UNSUPPORTED_PATTERNS) {
      if (item.pattern.test(normalized)) {
        return {
          statement: statementSql,
          normalizedSql: normalized,
          category: 'UNSUPPORTED',
          operation: item.operation,
          reason: item.reason,
        };
      }
    }

    // 2. Check Non-Transactional Patterns (Must execute outside BEGIN ... COMMIT)
    for (const item of this.NON_TRANSACTIONAL_PATTERNS) {
      if (item.pattern.test(normalized)) {
        return {
          statement: statementSql,
          normalizedSql: normalized,
          category: 'NON_TRANSACTIONAL',
          operation: item.operation,
          reason: item.reason,
        };
      }
    }

    // 3. Check Transaction-Safe Patterns (Safe to execute inside BEGIN ... COMMIT)
    for (const item of this.TRANSACTION_SAFE_PATTERNS) {
      if (item.pattern.test(normalized)) {
        return {
          statement: statementSql,
          normalizedSql: normalized,
          category: 'TRANSACTION_SAFE',
          operation: item.operation,
        };
      }
    }

    // 4. Fail Closed: Unrecognized or Ambiguous statement
    return {
      statement: statementSql,
      normalizedSql: normalized,
      category: 'UNSUPPORTED',
      operation: 'UNRECOGNIZED_STATEMENT',
      reason: `Unrecognized or ambiguous statement syntax for live execution: "${normalized.slice(0, 40)}..."`,
    };
  }

  /**
   * Validates an entire batch of migration statements prior to execution.
   * Throws or returns detailed diagnostic reasons if any statement is unsupported.
   */
  public static classifyBatch(statements: string[]): {
    valid: boolean;
    hasNonTransactional: boolean;
    allTransactionSafe: boolean;
    classifications: StatementClassification[];
    unsupportedReasons: string[];
  } {
    const classifications = statements.map((s) => this.classify(s));
    const unsupported = classifications.filter((c) => c.category === 'UNSUPPORTED');
    const hasNonTransactional = classifications.some((c) => c.category === 'NON_TRANSACTIONAL');
    const allTransactionSafe =
      classifications.length > 0 && classifications.every((c) => c.category === 'TRANSACTION_SAFE');

    return {
      valid: unsupported.length === 0,
      hasNonTransactional,
      allTransactionSafe,
      classifications,
      unsupportedReasons: unsupported.map((u) => u.reason || `Unsupported ${u.operation}`),
    };
  }
}
