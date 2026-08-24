import type { AnalysisFinding, ParsedMigrationStatement } from '@orvexa/shared';
import type { MigrationAnalysisRule } from './rule.interface.js';
import type { DatabaseAnalysisContext } from '../interfaces/migration-analyzer.interface.js';

/**
 * Rule: Destructive and Irreversible Operations
 * Detects operations that permanently destroy data without rollback recovery.
 */
export class DestructiveOperationRule implements MigrationAnalysisRule {
  public readonly ruleId = 'ROLL-001';
  public readonly name = 'Destructive Data Operation';
  public readonly description =
    'Operations like DROP TABLE, TRUNCATE, and DROP COLUMN permanently purge existing table data and cannot be rolled back via SQL after transaction commit.';

  public evaluate(
    statements: ParsedMigrationStatement[],
    context: DatabaseAnalysisContext
  ): AnalysisFinding[] {
    const findings: AnalysisFinding[] = [];

    const destructive = new Set(['DROP_TABLE', 'TRUNCATE_TABLE', 'DROP_COLUMN']);

    for (const stmt of statements) {
      if (destructive.has(stmt.operationType)) {
        const tableKey = `${stmt.schemaName || 'public'}.${stmt.tableName || ''}`;
        const inspection = context.tableInspections?.[tableKey];
        const rowCount =
          inspection?.statistics?.liveTuples ?? inspection?.table.estimatedRowCount ?? 0;

        findings.push({
          id: `finding-roll-001-${stmt.statementIndex}`,
          ruleId: this.ruleId,
          severity: rowCount > 0 ? 'CRITICAL' : 'HIGH',
          category: 'ROLLBACK',
          title: `Destructive operation '${stmt.operationType}' on '${stmt.tableName || 'table'}'`,
          explanation: `Operation '${stmt.operationType}' permanently deletes data from '${tableKey}'. Once committed, this operation cannot be undone with a reverse SQL script; recovery requires point-in-time database restore.`,
          affectedObject: tableKey,
          evidence: `Statement: "${stmt.rawSql}"${rowCount > 0 ? ` | Table currently holds ~${rowCount.toLocaleString('en-US')} rows` : ''}`,
          recommendation:
            'Ensure an automated point-in-time snapshot/backup exists prior to execution. For column removals, prefer deprecation and ignoring the column in code before dropping.',
        });
      }
    }

    return findings;
  }
}
