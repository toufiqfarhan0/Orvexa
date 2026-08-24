import type { RiskCategory } from './risk.js';

/**
 * Finding severity classification.
 */
export type FindingSeverity = 'INFO' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

/**
 * Categories for static and dynamic migration analysis findings.
 */
export type FindingCategory =
  RiskCategory | 'SYNTAX' | 'BEST_PRACTICE' | 'NAMING_CONVENTION' | 'INDEX_COVERAGE';

/**
 * A discrete structured finding generated during migration analysis.
 */
export interface AnalysisFinding {
  id: string;
  severity: FindingSeverity;
  category: FindingCategory;
  title: string;
  explanation: string;
  affectedObject: string;
  evidence: string;
  recommendation: string;
  ruleId?: string;
}

/**
 * Complete structured result of the migration static & semantic analysis phase.
 */
export interface MigrationAnalysisResult {
  analysisId: string;
  analyzedAt: string;
  summary: string;
  findings: AnalysisFinding[];
  isSafeForSandbox: boolean;
  blockers: string[];
}
