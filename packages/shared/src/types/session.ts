import type { MigrationRequest, TargetDatabaseMetadata, ProposedMigration } from './migration.js';
import type { MigrationRiskAssessment } from './risk.js';
import type { MigrationAnalysisResult } from './finding.js';
import type { SandboxRehearsalResult } from './sandbox.js';
import type { ApprovalRequest, ApprovalDecision } from './approval.js';
import type { ExecutionResult } from './execution.js';
import type { VerificationResult } from './verification.js';

/**
 * Explicit discrete lifecycle states for an end-to-end schema migration analysis session.
 */
export type MigrationSessionStatus =
  | 'DRAFT'
  | 'ANALYZING'
  | 'ANALYSIS_FAILED'
  | 'SANDBOX_READY'
  | 'SANDBOX_RUNNING'
  | 'SANDBOX_FAILED'
  | 'AWAITING_APPROVAL'
  | 'APPROVED'
  | 'REJECTED'
  | 'EXECUTING'
  | 'EXECUTION_FAILED'
  | 'VERIFYING'
  | 'VERIFICATION_FAILED'
  | 'COMPLETED';

/**
 * State transition history entry for auditability and timeline display.
 */
export interface SessionHistoryEntry {
  fromStatus: MigrationSessionStatus | null;
  toStatus: MigrationSessionStatus;
  timestamp: string;
  reason?: string;
  actor?: string;
}

/**
 * Complete Migration Session domain model aggregate root.
 */
export interface MigrationSession {
  sessionId: string;
  status: MigrationSessionStatus;
  createdAt: string;
  updatedAt: string;
  request: MigrationRequest;
  analysisResult?: MigrationAnalysisResult;
  riskAssessment?: MigrationRiskAssessment;
  sandboxResult?: SandboxRehearsalResult;
  approvalRequest?: ApprovalRequest;
  approvalDecision?: ApprovalDecision;
  executionResult?: ExecutionResult;
  verificationResult?: VerificationResult;
  lastErrorMessage?: string;
  history: SessionHistoryEntry[];
}

/**
 * Input DTO for creating a new migration session.
 */
export interface CreateMigrationSessionDto {
  targetDatabase: TargetDatabaseMetadata;
  proposedMigration: ProposedMigration;
  requestMetadata?: Record<string, unknown>;
}
