/**
 * Overall verification outcome status.
 */
export type VerificationStatus = 'PASSED' | 'FAILED';

/**
 * Categories of automated post-migration verification checks.
 */
export type VerificationCheckCategory =
  'SCHEMA_PARITY' | 'DATA_INTEGRITY' | 'CONNECTION_POOL' | 'QUERY_PERFORMANCE' | 'INDEX_VALIDITY';

/**
 * Individual post-migration verification probe result.
 */
export interface VerificationCheck {
  checkId: string;
  name: string;
  category: VerificationCheckCategory;
  passed: boolean;
  message: string;
  durationMs: number;
  details?: Record<string, unknown>;
}

/**
 * High-level database health summary post-migration.
 */
export interface PostMigrationHealthSummary {
  connectionPoolOk: boolean;
  schemaMatchesExpected: boolean;
  indexStatusValid: boolean;
  latencyUnderThreshold: boolean;
}

/**
 * Complete result of the post-execution verification phase.
 */
export interface VerificationResult {
  verificationId: string;
  status: VerificationStatus;
  verifiedAt: string;
  durationMs: number;
  checks: VerificationCheck[];
  healthSummary: PostMigrationHealthSummary;
  errorMessage?: string;
}
