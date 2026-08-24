import type { AnalysisFinding, ParsedMigrationStatement } from '@orvexa/shared';
import type { DatabaseAnalysisContext } from '../interfaces/migration-analyzer.interface.js';

/**
 * Common contract for deterministic migration analysis rules.
 */
export interface MigrationAnalysisRule {
  readonly ruleId: string;
  readonly name: string;
  readonly description: string;

  evaluate(
    statements: ParsedMigrationStatement[],
    context: DatabaseAnalysisContext
  ): AnalysisFinding[];
}
