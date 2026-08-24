import crypto from 'node:crypto';
import type { ProposedMigration, AnalysisFinding, FullTableInspection } from '@orvexa/shared';
import type {
  CompleteAnalysisOutput,
  DatabaseAnalysisContext,
  MigrationAnalyzer,
} from '../interfaces/migration-analyzer.interface.js';
import { SqlStatementParser } from '../parser/sql-statement-parser.js';
import type { MigrationAnalysisRule } from '../rules/rule.interface.js';
import {
  NonConcurrentIndexRule,
  StrongTableLockRule,
  UnvalidatedConstraintRule,
} from '../rules/locking-rules.js';
import {
  DroppingConstraintRule,
  DroppingReferencedColumnRule,
  DroppingReferencedTableRule,
  ForeignKeyMissingIndexRule,
  NotNullWithoutDefaultRule,
  UnsafeTypeAlterationRule,
} from '../rules/data-integrity-rules.js';
import { DuplicateIndexRule, LargeTableAlterationRule } from '../rules/performance-rules.js';
import { DestructiveOperationRule } from '../rules/rollback-rules.js';
import {
  PostgresVersionCompatibilityRule,
  UnsupportedStatementRule,
} from '../rules/compatibility-rules.js';
import { RiskCalculator } from '../calculators/risk-calculator.js';

/**
 * Deterministic Static PostgreSQL Migration Analyzer Service.
 * Analyzes proposed migration SQL against target database catalog metadata without executing DDL.
 */
export class MigrationAnalyzerService implements MigrationAnalyzer {
  private readonly rules: MigrationAnalysisRule[];

  public constructor(customRules?: MigrationAnalysisRule[]) {
    this.rules = customRules ?? [
      new NonConcurrentIndexRule(),
      new StrongTableLockRule(),
      new UnvalidatedConstraintRule(),
      new NotNullWithoutDefaultRule(),
      new DroppingReferencedColumnRule(),
      new DroppingReferencedTableRule(),
      new UnsafeTypeAlterationRule(),
      new ForeignKeyMissingIndexRule(),
      new DroppingConstraintRule(),
      new LargeTableAlterationRule(),
      new DuplicateIndexRule(),
      new DestructiveOperationRule(),
      new PostgresVersionCompatibilityRule(),
      new UnsupportedStatementRule(),
    ];
  }

  /**
   * Performs static analysis and risk assessment on a proposed migration.
   */
  public async analyze(
    migration: ProposedMigration,
    initialContext?: DatabaseAnalysisContext
  ): Promise<CompleteAnalysisOutput> {
    const context: DatabaseAnalysisContext = {
      server: initialContext?.server,
      tables: initialContext?.tables ? [...initialContext.tables] : undefined,
      tableInspections: initialContext?.tableInspections
        ? { ...initialContext.tableInspections }
        : {},
      inspectionPort: initialContext?.inspectionPort,
    };

    const defaultSchema = migration.targetSchema || 'public';
    const parsedStatements = SqlStatementParser.parseScript(migration.rawSql, defaultSchema);

    // If an inspection port is available, dynamically populate missing catalog metadata for target tables
    if (context.inspectionPort) {
      if (!context.server) {
        try {
          context.server = await context.inspectionPort.getServerMetadata();
        } catch {
          // Fallback gracefully if server metadata cannot be retrieved
        }
      }

      for (const stmt of parsedStatements) {
        if (stmt.tableName) {
          const schema = stmt.schemaName || defaultSchema;
          const tableKey = `${schema}.${stmt.tableName}`;

          if (!context.tableInspections?.[tableKey]) {
            try {
              const fullInspection: FullTableInspection =
                await context.inspectionPort.inspectFullTable(schema, stmt.tableName);
              if (!context.tableInspections) context.tableInspections = {};
              context.tableInspections[tableKey] = fullInspection;
            } catch {
              // Table may not exist yet (e.g. for CREATE TABLE); continue analysis
            }
          }
        }
      }
    }

    // Evaluate all modular rules
    const findings: AnalysisFinding[] = [];
    for (const rule of this.rules) {
      const ruleFindings = rule.evaluate(parsedStatements, context);
      findings.push(...ruleFindings);
    }

    // Populate planned statements on migration if not already present
    if (!migration.plannedStatements || migration.plannedStatements.length === 0) {
      migration.plannedStatements = parsedStatements.map((stmt) => ({
        statementIndex: stmt.statementIndex,
        sql: stmt.rawSql,
        operationType: stmt.operationType,
        targetObject: `${stmt.schemaName || defaultSchema}.${stmt.tableName || stmt.columnName || 'unknown'}`,
        estimatedLockType: undefined,
      }));
    }

    if (!migration.primaryOperation && parsedStatements.length > 0 && parsedStatements[0]) {
      migration.primaryOperation = parsedStatements[0].operationType;
    }

    const analysisId = `analysis-${crypto.randomUUID()}`;
    const riskAssessment = RiskCalculator.calculateRiskAssessment(
      findings,
      parsedStatements,
      context
    );
    const analysisResult = RiskCalculator.calculateAnalysisResult(
      analysisId,
      findings,
      parsedStatements
    );

    return {
      analysisResult,
      riskAssessment,
      parsedStatements,
    };
  }
}
