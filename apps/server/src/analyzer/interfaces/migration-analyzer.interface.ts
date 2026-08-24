import type {
  ProposedMigration,
  MigrationAnalysisResult,
  MigrationRiskAssessment,
  ParsedMigrationStatement,
  FullTableInspection,
  TableMetadata,
  PostgresServerMetadata,
} from '@orvexa/shared';
import type { PostgresInspectionPort } from '../../db/ports/postgres-inspection.port.js';

/**
 * Snapshot of database catalog context used during static analysis.
 */
export interface DatabaseAnalysisContext {
  server?: PostgresServerMetadata;
  tables?: TableMetadata[];
  tableInspections?: Record<string, FullTableInspection>; // Keyed by `${schemaName}.${tableName}`
  inspectionPort?: PostgresInspectionPort;
}

/**
 * Comprehensive analysis output containing both findings and structured risk assessment.
 */
export interface CompleteAnalysisOutput {
  analysisResult: MigrationAnalysisResult;
  riskAssessment: MigrationRiskAssessment;
  parsedStatements: ParsedMigrationStatement[];
}

/**
 * Port contract for static PostgreSQL migration analysis.
 */
export interface MigrationAnalyzer {
  analyze(
    migration: ProposedMigration,
    context?: DatabaseAnalysisContext
  ): Promise<CompleteAnalysisOutput>;
}
