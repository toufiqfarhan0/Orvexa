import type {
  AnalysisFinding,
  FindingSeverity,
  LockRiskAnalysis,
  MigrationAnalysisResult,
  MigrationRiskAssessment,
  ParsedMigrationStatement,
  PostgresLockMode,
  RiskCategory,
  RiskCategoryAssessment,
  RiskLevel,
} from '@orvexa/shared';
import type { DatabaseAnalysisContext } from '../interfaces/migration-analyzer.interface.js';

const SEVERITY_WEIGHTS: Record<FindingSeverity, number> = {
  CRITICAL: 40,
  HIGH: 25,
  MEDIUM: 10,
  LOW: 3,
  INFO: 0,
};

const CATEGORIES: RiskCategory[] = [
  'LOCKING',
  'PERFORMANCE',
  'DATA_INTEGRITY',
  'ROLLBACK',
  'COMPATIBILITY',
];

/**
 * Deterministic calculator that aggregates discrete analysis findings into
 * normalized risk scores, category assessments, and sandbox eligibility flags.
 */
export class RiskCalculator {
  /**
   * Evaluates highest required lock mode across parsed statements.
   */
  public static calculateLockAnalysis(
    statements: ParsedMigrationStatement[],
    _context: DatabaseAnalysisContext
  ): LockRiskAnalysis {
    let highestLockMode: PostgresLockMode = 'ROW_EXCLUSIVE';
    let blocksReads = false;
    let blocksWrites = false;

    for (const stmt of statements) {
      switch (stmt.operationType) {
        case 'DROP_TABLE':
        case 'TRUNCATE_TABLE':
        case 'ALTER_COLUMN_TYPE':
        case 'DROP_COLUMN':
        case 'RENAME_TABLE':
        case 'RENAME_COLUMN':
        case 'ADD_PRIMARY_KEY':
        case 'DROP_CONSTRAINT':
        case 'SET_NOT_NULL':
        case 'DROP_NOT_NULL':
        case 'UNSUPPORTED_OPERATION':
        case 'CUSTOM_DDL':
          highestLockMode = 'ACCESS_EXCLUSIVE';
          blocksReads = true;
          blocksWrites = true;
          break;

        case 'ADD_COLUMN':
          // Standard ADD COLUMN without rewrite requires ACCESS EXCLUSIVE briefly
          if (highestLockMode !== 'ACCESS_EXCLUSIVE') {
            highestLockMode = 'ACCESS_EXCLUSIVE';
            blocksReads = true;
            blocksWrites = true;
          }
          break;

        case 'ADD_FOREIGN_KEY':
        case 'ADD_CHECK_CONSTRAINT':
          if (highestLockMode !== 'ACCESS_EXCLUSIVE') {
            highestLockMode = 'SHARE_ROW_EXCLUSIVE';
            blocksWrites = true;
          }
          break;

        case 'ADD_INDEX':
          if (!stmt.isConcurrent && highestLockMode !== 'ACCESS_EXCLUSIVE') {
            highestLockMode = 'SHARE';
            blocksWrites = true;
          } else if (stmt.isConcurrent && highestLockMode === 'ROW_EXCLUSIVE') {
            highestLockMode = 'SHARE_UPDATE_EXCLUSIVE';
          }
          break;

        case 'DROP_INDEX':
          if (!stmt.isConcurrent && highestLockMode !== 'ACCESS_EXCLUSIVE') {
            highestLockMode = 'ACCESS_EXCLUSIVE';
            blocksReads = true;
            blocksWrites = true;
          } else if (stmt.isConcurrent && highestLockMode === 'ROW_EXCLUSIVE') {
            highestLockMode = 'SHARE_UPDATE_EXCLUSIVE';
          }
          break;

        case 'CREATE_TABLE':
          // Pure DDL creating a new relation
          break;
      }
    }

    const recommendedLockTimeoutMs = highestLockMode === 'ACCESS_EXCLUSIVE' ? 2000 : 5000;
    const estimatedAcquisitionMs = highestLockMode === 'ACCESS_EXCLUSIVE' ? 150 : 25;

    return {
      lockMode: highestLockMode,
      blocksReads,
      blocksWrites,
      estimatedAcquisitionMs,
      recommendedLockTimeoutMs,
      mitigationStrategy:
        highestLockMode === 'ACCESS_EXCLUSIVE'
          ? 'Configure explicit lock_timeout and statement_timeout. Run migration during off-peak traffic.'
          : undefined,
    };
  }

  /**
   * Calculates standardized category assessments for all 5 risk dimensions.
   */
  public static calculateCategoryAssessments(
    findings: AnalysisFinding[]
  ): Record<RiskCategory, RiskCategoryAssessment> {
    const assessments = {} as Record<RiskCategory, RiskCategoryAssessment>;

    for (const category of CATEGORIES) {
      const categoryFindings = findings.filter((f) => f.category === category);

      let score = 0;
      let highestSeverity: FindingSeverity = 'INFO';

      for (const f of categoryFindings) {
        score += SEVERITY_WEIGHTS[f.severity];
        if (
          SEVERITY_WEIGHTS[f.severity] >
          (highestSeverity === 'INFO' ? 0 : SEVERITY_WEIGHTS[highestSeverity])
        ) {
          highestSeverity = f.severity;
        }
      }

      score = Math.min(100, score);

      let level: RiskLevel = 'LOW';
      if (score >= 70 || highestSeverity === 'CRITICAL') {
        level = 'CRITICAL';
      } else if (score >= 40 || highestSeverity === 'HIGH') {
        level = 'HIGH';
      } else if (score >= 15 || highestSeverity === 'MEDIUM') {
        level = 'MEDIUM';
      }

      const reasons = categoryFindings.map((f) => `${f.title}: ${f.explanation}`);

      let summary = `${category} risk is evaluated as ${level} (score: ${score}/100).`;
      if (categoryFindings.length === 0) {
        summary = `No significant ${category.toLowerCase().replace('_', ' ')} risks identified.`;
      }

      assessments[category] = {
        category,
        level,
        score,
        summary,
        reasons,
      };
    }

    return assessments;
  }

  /**
   * Computes the composite risk assessment across all dimensions.
   */
  public static calculateRiskAssessment(
    findings: AnalysisFinding[],
    statements: ParsedMigrationStatement[],
    context: DatabaseAnalysisContext
  ): MigrationRiskAssessment {
    const categoryAssessments = this.calculateCategoryAssessments(findings);
    const lockAnalysis = this.calculateLockAnalysis(statements, context);

    // Calculate composite overall score
    const categoryScores = Object.values(categoryAssessments).map((a) => a.score);
    const maxScore = Math.max(0, ...categoryScores);
    const avgScore = categoryScores.reduce((a, b) => a + b, 0) / categoryScores.length;
    const overallScore = Math.min(100, Math.round(maxScore * 0.7 + avgScore * 0.3));

    let overallRiskLevel: RiskLevel = 'LOW';
    if (overallScore >= 70 || findings.some((f) => f.severity === 'CRITICAL')) {
      overallRiskLevel = 'CRITICAL';
    } else if (overallScore >= 40 || findings.some((f) => f.severity === 'HIGH')) {
      overallRiskLevel = 'HIGH';
    } else if (overallScore >= 15 || findings.some((f) => f.severity === 'MEDIUM')) {
      overallRiskLevel = 'MEDIUM';
    }

    const criticalCount = findings.filter((f) => f.severity === 'CRITICAL').length;
    const highCount = findings.filter((f) => f.severity === 'HIGH').length;
    const mediumCount = findings.filter((f) => f.severity === 'MEDIUM').length;

    let summary = `Migration evaluated with ${overallRiskLevel} risk (score: ${overallScore}/100). Identified ${findings.length} findings (${criticalCount} critical, ${highCount} high, ${mediumCount} medium).`;
    if (findings.length === 0) {
      summary = `Migration evaluated with ${overallRiskLevel} risk (score: ${overallScore}/100). No significant risks identified.`;
    }

    return {
      overallRiskLevel,
      overallScore,
      summary,
      lockAnalysis,
      categoryAssessments,
      assessedAt: new Date().toISOString(),
    };
  }

  /**
   * Produces the structured MigrationAnalysisResult and evaluates sandbox rehearsal eligibility.
   */
  public static calculateAnalysisResult(
    analysisId: string,
    findings: AnalysisFinding[],
    statements: ParsedMigrationStatement[]
  ): MigrationAnalysisResult {
    const blockers: string[] = [];

    // Blockers: syntax errors, unsupported procedural blocks, or critical compatibility failures
    for (const stmt of statements) {
      if (stmt.operationType === 'UNSUPPORTED_OPERATION') {
        blockers.push(
          `Statement #${stmt.statementIndex + 1} contains unsupported or unparseable SQL syntax.`
        );
      }
    }

    const criticalCompat = findings.filter(
      (f) => f.category === 'COMPATIBILITY' && f.severity === 'CRITICAL'
    );
    for (const f of criticalCompat) {
      blockers.push(`${f.title}: ${f.explanation}`);
    }

    const isSafeForSandbox = blockers.length === 0;

    const summary = isSafeForSandbox
      ? `Static analysis completed with ${findings.length} findings. Migration is eligible for sandbox rehearsal.`
      : `Static analysis identified ${blockers.length} blocker(s) preventing sandbox rehearsal.`;

    return {
      analysisId,
      analyzedAt: new Date().toISOString(),
      summary,
      findings,
      isSafeForSandbox,
      blockers,
    };
  }
}
