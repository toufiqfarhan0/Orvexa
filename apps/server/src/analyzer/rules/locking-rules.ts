import type { AnalysisFinding, ParsedMigrationStatement } from '@orvexa/shared';
import type { MigrationAnalysisRule } from './rule.interface.js';
import type { DatabaseAnalysisContext } from '../interfaces/migration-analyzer.interface.js';

/**
 * Rule: Non-Concurrent Index Creation
 * Detects CREATE INDEX without CONCURRENTLY which takes a SHARE lock and blocks writes.
 */
export class NonConcurrentIndexRule implements MigrationAnalysisRule {
  public readonly ruleId = 'LOCK-001';
  public readonly name = 'Non-Concurrent Index Creation';
  public readonly description =
    'Creating an index without CONCURRENTLY acquires a SHARE lock on the target table, blocking concurrent write operations (INSERT, UPDATE, DELETE).';

  public evaluate(
    statements: ParsedMigrationStatement[],
    context: DatabaseAnalysisContext
  ): AnalysisFinding[] {
    const findings: AnalysisFinding[] = [];

    for (const stmt of statements) {
      if (stmt.operationType === 'ADD_INDEX' && !stmt.isConcurrent) {
        const tableKey = `${stmt.schemaName || 'public'}.${stmt.tableName || ''}`;
        const inspection = context.tableInspections?.[tableKey];
        const rowCount =
          inspection?.statistics?.liveTuples ?? inspection?.table.estimatedRowCount ?? 0;
        const isLarge = rowCount > 10000;

        findings.push({
          id: `finding-lock-001-${stmt.statementIndex}`,
          ruleId: this.ruleId,
          severity: isLarge ? 'HIGH' : 'MEDIUM',
          category: 'LOCKING',
          title: `Non-concurrent index build on table '${stmt.tableName || 'unknown'}'`,
          explanation: `The statement creates index '${stmt.indexName || 'unnamed'}' without CONCURRENTLY. In PostgreSQL, standard CREATE INDEX acquires a SHARE lock on '${stmt.tableName}', blocking all write operations for the entire duration of the index build.`,
          affectedObject: tableKey,
          evidence: `Statement: "${stmt.rawSql}"${rowCount > 0 ? ` | Target table contains ~${rowCount.toLocaleString('en-US')} rows` : ''}`,
          recommendation: `Use 'CREATE INDEX CONCURRENTLY ${stmt.indexName || 'idx_name'} ON ${tableKey} ...' to build the index in the background without blocking concurrent writes.`,
        });
      }
    }

    return findings;
  }
}

/**
 * Rule: Strong Access Exclusive Table Lock
 * Detects DDL operations that require an ACCESS EXCLUSIVE lock on existing tables.
 */
export class StrongTableLockRule implements MigrationAnalysisRule {
  public readonly ruleId = 'LOCK-002';
  public readonly name = 'Access Exclusive Lock on Table';
  public readonly description =
    'Operations like ALTER COLUMN TYPE, DROP COLUMN, TRUNCATE, and RENAME acquire an ACCESS EXCLUSIVE lock, blocking both concurrent reads and writes.';

  public evaluate(
    statements: ParsedMigrationStatement[],
    context: DatabaseAnalysisContext
  ): AnalysisFinding[] {
    const findings: AnalysisFinding[] = [];

    const strongOperations = new Set([
      'ALTER_COLUMN_TYPE',
      'DROP_COLUMN',
      'TRUNCATE_TABLE',
      'DROP_TABLE',
      'RENAME_TABLE',
      'ADD_PRIMARY_KEY',
    ]);

    for (const stmt of statements) {
      if (strongOperations.has(stmt.operationType)) {
        const tableKey = `${stmt.schemaName || 'public'}.${stmt.tableName || ''}`;
        const inspection = context.tableInspections?.[tableKey];
        const rowCount =
          inspection?.statistics?.liveTuples ?? inspection?.table.estimatedRowCount ?? 0;
        const isLarge = rowCount > 50000;

        findings.push({
          id: `finding-lock-002-${stmt.statementIndex}`,
          ruleId: this.ruleId,
          severity: isLarge ? 'HIGH' : 'MEDIUM',
          category: 'LOCKING',
          title: `Heavy ACCESS EXCLUSIVE lock required for '${stmt.operationType}' on '${stmt.tableName || 'table'}'`,
          explanation: `Operation '${stmt.operationType}' requires PostgreSQL to acquire an ACCESS EXCLUSIVE lock on '${tableKey}'. This lock conflicts with ALL other lock modes, completely blocking both read and write queries until the transaction commits.`,
          affectedObject: tableKey,
          evidence: `Statement #${stmt.statementIndex + 1}: "${stmt.rawSql}"${rowCount > 0 ? ` (~${rowCount.toLocaleString('en-US')} live tuples)` : ''}`,
          recommendation:
            'Set a tight `SET lock_timeout = "2s";` before executing and retry if lock cannot be acquired immediately. Consider executing during an off-peak maintenance window.',
        });
      }
    }

    return findings;
  }
}

/**
 * Rule: Unvalidated Foreign Key or Check Constraint
 * Detects ADD CONSTRAINT without NOT VALID.
 */
export class UnvalidatedConstraintRule implements MigrationAnalysisRule {
  public readonly ruleId = 'LOCK-003';
  public readonly name = 'Constraint Added Without NOT VALID';
  public readonly description =
    'Adding a FOREIGN KEY or CHECK constraint without NOT VALID performs a full table sequential scan while holding a SHARE ROW EXCLUSIVE lock.';

  public evaluate(
    statements: ParsedMigrationStatement[],
    context: DatabaseAnalysisContext
  ): AnalysisFinding[] {
    const findings: AnalysisFinding[] = [];

    for (const stmt of statements) {
      if (
        (stmt.operationType === 'ADD_FOREIGN_KEY' ||
          stmt.operationType === 'ADD_CHECK_CONSTRAINT') &&
        !stmt.isNotValid
      ) {
        const tableKey = `${stmt.schemaName || 'public'}.${stmt.tableName || ''}`;
        const inspection = context.tableInspections?.[tableKey];
        const rowCount =
          inspection?.statistics?.liveTuples ?? inspection?.table.estimatedRowCount ?? 0;

        findings.push({
          id: `finding-lock-003-${stmt.statementIndex}`,
          ruleId: this.ruleId,
          severity: rowCount > 10000 ? 'HIGH' : 'LOW',
          category: 'LOCKING',
          title: `Constraint '${stmt.constraintName || 'unnamed'}' added with immediate table validation`,
          explanation: `Adding constraint '${stmt.constraintName || 'unnamed'}' without the 'NOT VALID' clause forces PostgreSQL to perform an immediate table scan to validate all existing rows while holding a SHARE ROW EXCLUSIVE lock, blocking concurrent writes.`,
          affectedObject: tableKey,
          evidence: `Statement: "${stmt.rawSql}"${rowCount > 0 ? ` | Target table has ~${rowCount.toLocaleString()} rows` : ''}`,
          recommendation: `Add the constraint with 'NOT VALID' first (e.g. 'ALTER TABLE ${tableKey} ADD CONSTRAINT ${stmt.constraintName || 'fk_name'} ... NOT VALID;'), then run 'ALTER TABLE ${tableKey} VALIDATE CONSTRAINT ${stmt.constraintName || 'fk_name'};' in a separate transaction.`,
        });
      }
    }

    return findings;
  }
}
