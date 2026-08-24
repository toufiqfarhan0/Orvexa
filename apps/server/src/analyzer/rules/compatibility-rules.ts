import type { AnalysisFinding, ParsedMigrationStatement } from '@orvexa/shared';
import type { MigrationAnalysisRule } from './rule.interface.js';
import type { DatabaseAnalysisContext } from '../interfaces/migration-analyzer.interface.js';

/**
 * Rule: PostgreSQL Version Compatibility
 * Detects DDL constructs that are unsupported or behave dangerously on the detected PostgreSQL engine version.
 */
export class PostgresVersionCompatibilityRule implements MigrationAnalysisRule {
  public readonly ruleId = 'COMPAT-001';
  public readonly name = 'PostgreSQL Version Compatibility';
  public readonly description =
    'Checks whether DDL features in the migration are supported by the target PostgreSQL engine version.';

  public evaluate(
    statements: ParsedMigrationStatement[],
    context: DatabaseAnalysisContext
  ): AnalysisFinding[] {
    const findings: AnalysisFinding[] = [];
    const majorVersion = context.server?.majorVersion;

    for (const stmt of statements) {
      // 1. Generated columns (GENERATED ALWAYS AS) -> Requires PG 12+
      if (stmt.isGenerated && majorVersion !== undefined && majorVersion < 12) {
        findings.push({
          id: `finding-compat-001-gen-${stmt.statementIndex}`,
          ruleId: this.ruleId,
          severity: 'CRITICAL',
          category: 'COMPATIBILITY',
          title: `Generated columns require PostgreSQL 12+ (target engine is PG ${majorVersion})`,
          explanation: `The migration attempts to use 'GENERATED ALWAYS AS (...) STORED' on column '${stmt.columnName || 'unknown'}'. This feature was introduced in PostgreSQL 12, but the target database is running PostgreSQL ${majorVersion}. Execution will fail with a syntax error.`,
          affectedObject: `${stmt.schemaName || 'public'}.${stmt.tableName || ''}`,
          evidence: `Statement: "${stmt.rawSql}" | Detected PostgreSQL major version: ${majorVersion}`,
          recommendation:
            'Use standard database triggers or compute values at the application layer on PostgreSQL versions prior to 12.',
        });
      }

      // 2. Pre-PG11 ADD COLUMN DEFAULT table rewrite
      if (
        stmt.operationType === 'ADD_COLUMN' &&
        stmt.hasDefault &&
        majorVersion !== undefined &&
        majorVersion < 11
      ) {
        findings.push({
          id: `finding-compat-001-def-${stmt.statementIndex}`,
          ruleId: this.ruleId,
          severity: 'HIGH',
          category: 'COMPATIBILITY',
          title: `ADD COLUMN with DEFAULT rewrites entire table on PostgreSQL < 11 (target is PG ${majorVersion})`,
          explanation: `In PostgreSQL versions older than 11, adding a column with a DEFAULT value requires a full physical table rewrite while holding an ACCESS EXCLUSIVE lock. (Non-rewriting default addition was introduced in PG 11).`,
          affectedObject: `${stmt.schemaName || 'public'}.${stmt.tableName || ''}`,
          evidence: `Statement: "${stmt.rawSql}" | Target server: PG ${majorVersion}`,
          recommendation:
            'Upgrade target database to PostgreSQL 11+ or add column without default first, backfill in batches, and then set default.',
        });
      }
    }

    return findings;
  }
}

/**
 * Rule: Unsupported Statement Syntax
 * Flags statements that cannot be safely analyzed by standard DDL rules.
 */
export class UnsupportedStatementRule implements MigrationAnalysisRule {
  public readonly ruleId = 'COMPAT-002';
  public readonly name = 'Unsupported / Unknown Statement';
  public readonly description =
    'Flags SQL statements whose structure cannot be parsed as standard PostgreSQL DDL.';

  public evaluate(
    statements: ParsedMigrationStatement[],
    _context: DatabaseAnalysisContext
  ): AnalysisFinding[] {
    const findings: AnalysisFinding[] = [];

    for (const stmt of statements) {
      if (stmt.operationType === 'UNSUPPORTED_OPERATION') {
        findings.push({
          id: `finding-compat-002-${stmt.statementIndex}`,
          ruleId: this.ruleId,
          severity: 'HIGH',
          category: 'COMPATIBILITY',
          title: `Unrecognized or unsupported SQL operation in statement #${stmt.statementIndex + 1}`,
          explanation: `The analyzer could not recognize statement #${stmt.statementIndex + 1} as standard PostgreSQL DDL. Arbitrary procedural commands or complex statements cannot be validated deterministically.`,
          affectedObject: 'migration_script',
          evidence: `Statement: "${stmt.rawSql}"`,
          recommendation:
            'Verify that the SQL statement contains valid PostgreSQL DDL syntax and does not contain unsupported multi-statement procedural blocks.',
        });
      }
    }

    return findings;
  }
}
