import type { AnalysisFinding, ParsedMigrationStatement } from '@orvexa/shared';
import type { MigrationAnalysisRule } from './rule.interface.js';
import type { DatabaseAnalysisContext } from '../interfaces/migration-analyzer.interface.js';

/**
 * Rule: Large Table Schema Alteration
 * Detects heavy DDL operations on large tables that cause high I/O, long execution times, or replication lag.
 */
export class LargeTableAlterationRule implements MigrationAnalysisRule {
  public readonly ruleId = 'PERF-001';
  public readonly name = 'Large Table Schema Alteration';
  public readonly description =
    'Running table rewrites or scans on large tables causes high disk I/O, long execution duration, and replication lag.';

  public evaluate(
    statements: ParsedMigrationStatement[],
    context: DatabaseAnalysisContext
  ): AnalysisFinding[] {
    const findings: AnalysisFinding[] = [];

    const heavyOperations = new Set([
      'ALTER_COLUMN_TYPE',
      'ADD_PRIMARY_KEY',
      'ADD_CHECK_CONSTRAINT',
      'ADD_FOREIGN_KEY',
      'TRUNCATE_TABLE',
    ]);

    for (const stmt of statements) {
      if (heavyOperations.has(stmt.operationType) && stmt.tableName) {
        const tableKey = `${stmt.schemaName || 'public'}.${stmt.tableName}`;
        const inspection = context.tableInspections?.[tableKey];
        const rowCount =
          inspection?.statistics?.liveTuples ?? inspection?.table.estimatedRowCount ?? 0;
        const sizeMb = ((inspection?.table.totalSizeBytes ?? 0) / (1024 * 1024)).toFixed(1);

        if (rowCount > 100000) {
          findings.push({
            id: `finding-perf-001-${stmt.statementIndex}`,
            ruleId: this.ruleId,
            severity: 'HIGH',
            category: 'PERFORMANCE',
            title: `Heavy operation '${stmt.operationType}' on large table '${stmt.tableName}' (${rowCount.toLocaleString('en-US')} rows)`,
            explanation: `Table '${tableKey}' contains approximately ${rowCount.toLocaleString('en-US')} rows (${sizeMb} MB). Executing '${stmt.operationType}' on a table of this size will generate massive WAL activity, high I/O latency, and substantial replication lag on read replicas.`,
            affectedObject: tableKey,
            evidence: `Table stats: ~${rowCount.toLocaleString('en-US')} live tuples, size: ${sizeMb} MB | Statement: "${stmt.rawSql}"`,
            recommendation:
              'Consider breaking this migration into staged steps, utilizing non-blocking alternatives (e.g. NOT VALID constraints, concurrent operations), and monitoring replication lag.',
          });
        }
      }
    }

    return findings;
  }
}

/**
 * Rule: Duplicate / Redundant Index Detection
 * Detects creating an index when an existing index with identical leading columns already exists on the table.
 */
export class DuplicateIndexRule implements MigrationAnalysisRule {
  public readonly ruleId = 'PERF-002';
  public readonly name = 'Duplicate or Redundant Index';
  public readonly description =
    'Creating redundant indexes increases disk usage, bloats buffer cache, and degrades write performance without query optimization benefits.';

  public evaluate(
    statements: ParsedMigrationStatement[],
    context: DatabaseAnalysisContext
  ): AnalysisFinding[] {
    const findings: AnalysisFinding[] = [];

    for (const stmt of statements) {
      if (
        stmt.operationType === 'ADD_INDEX' &&
        stmt.tableName &&
        stmt.columns &&
        stmt.columns.length > 0
      ) {
        const tableKey = `${stmt.schemaName || 'public'}.${stmt.tableName}`;
        const inspection = context.tableInspections?.[tableKey];
        if (!inspection) continue;

        const proposedCols = stmt.columns;
        const duplicate = inspection.indexes.find((existing) => {
          const existingCols = existing.columnNames || (existing as unknown as { columns?: string[] }).columns || [];
          if (existingCols.length >= proposedCols.length) {
            return proposedCols.every((col, idx) => existingCols[idx] === col);
          }
          return false;
        });

        if (duplicate) {
          const dupName = duplicate.indexName || (duplicate as unknown as { name?: string }).name || 'existing_index';
          const dupCols = duplicate.columnNames || (duplicate as unknown as { columns?: string[] }).columns || [];
          findings.push({
            id: `finding-perf-002-${stmt.statementIndex}`,
            ruleId: this.ruleId,
            severity: 'MEDIUM',
            category: 'PERFORMANCE',
            title: `Proposed index '${stmt.indexName || 'new_index'}' is redundant with existing index '${dupName}'`,
            explanation: `Existing index '${dupName}' on '${tableKey}' already indexes columns (${dupCols.join(', ')}). Creating '${stmt.indexName || 'new_index'}' on (${proposedCols.join(', ')}) is redundant and will unnecessarily slow down write throughput.`,
            affectedObject: tableKey,
            evidence: `Proposed: (${proposedCols.join(', ')}) | Existing: ${dupName} (${dupCols.join(', ')})`,
            recommendation:
              'Drop the duplicate index creation from the migration script, or verify whether the existing index can be used.',
          });
        }
      }
    }

    return findings;
  }
}
