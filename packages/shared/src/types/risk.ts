/**
 * Overall standardized risk level classifications.
 */
export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

/**
 * The core risk dimensions assessed for database schema migrations.
 */
export type RiskCategory =
  'LOCKING' | 'PERFORMANCE' | 'DATA_INTEGRITY' | 'ROLLBACK' | 'COMPATIBILITY';

/**
 * Standard PostgreSQL lock modes ordered by increasing severity.
 */
export type PostgresLockMode =
  | 'ACCESS_SHARE'
  | 'ROW_SHARE'
  | 'ROW_EXCLUSIVE'
  | 'SHARE_UPDATE_EXCLUSIVE'
  | 'SHARE'
  | 'SHARE_ROW_EXCLUSIVE'
  | 'EXCLUSIVE'
  | 'ACCESS_EXCLUSIVE';

/**
 * Detailed analysis of locking behavior and blast radius.
 */
export interface LockRiskAnalysis {
  lockMode: PostgresLockMode;
  blocksReads: boolean;
  blocksWrites: boolean;
  estimatedAcquisitionMs: number;
  recommendedLockTimeoutMs: number;
  mitigationStrategy?: string;
}

/**
 * Individual assessment for a specific risk dimension.
 */
export interface RiskCategoryAssessment {
  category: RiskCategory;
  level: RiskLevel;
  score: number; // Normalized 0-100 scale
  summary: string;
  reasons: string[];
}

/**
 * Complete composite risk assessment for a proposed migration.
 */
export interface MigrationRiskAssessment {
  overallRiskLevel: RiskLevel;
  overallScore: number; // Normalized 0-100 scale
  summary: string;
  lockAnalysis: LockRiskAnalysis;
  categoryAssessments: Record<RiskCategory, RiskCategoryAssessment>;
  assessedAt: string;
}
