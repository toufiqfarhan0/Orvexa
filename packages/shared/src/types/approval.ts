import type { RiskLevel } from './risk.js';

/**
 * Valid states for a human approval decision.
 */
export type ApprovalDecisionStatus = 'APPROVED' | 'REJECTED';

/**
 * Deterministic cryptographic fingerprint binding an approval to an exact migration proposal and rehearsal.
 */
export interface MigrationApprovalFingerprint {
  migrationId: string;
  sqlHash: string;
  targetDatabaseHash: string;
  rehearsalId: string;
  rehearsalStatus: string;
  fingerprintHash: string;
}

/**
 * Human approval request payload presented to an engineer or DBA.
 */
export interface ApprovalRequest {
  approvalRequestId: string;
  sessionId: string;
  migrationId: string;
  rehearsalId: string;
  requestedAt: string;
  reasonsRequired: string[];
  proposedActionSummary: string;
  highestRiskLevel: RiskLevel;
  riskSummary: string;
  evidenceSummary: string[];
  rollbackPlanSummary: string;
  fingerprint: string;
  expiresAt?: string;
}

/**
 * Recorded human approval or rejection decision.
 */
export interface ApprovalDecision {
  decisionId: string;
  approvalRequestId: string;
  sessionId: string;
  migrationId: string;
  rehearsalId: string;
  status: ApprovalDecisionStatus;
  approver: string;
  decidedAt: string;
  fingerprint: string;
  comment?: string;
  rejectionReason?: string;
}

/**
 * Input DTO for requesting approval on a completed rehearsal.
 */
export interface RequestApprovalDto {
  sessionId: string;
  actor?: string;
  comment?: string;
}

/**
 * Input DTO for granting human approval.
 */
export interface ApproveMigrationDto {
  sessionId: string;
  approver: string;
  comment?: string;
  fingerprint?: string;
}

/**
 * Input DTO for rejecting a proposed migration.
 */
export interface RejectMigrationDto {
  sessionId: string;
  approver: string;
  reason: string;
  fingerprint?: string;
}

/**
 * Verification result for checking approval validity.
 */
export interface ApprovalValidationResult {
  valid: boolean;
  sessionId: string;
  status: string;
  fingerprint?: string;
  reason?: string;
}

/**
 * Sanitized public response for POST /api/migrations/:sessionId/approval.
 */
export interface SanitizedApprovalRequestResponse {
  approvalRequestId: string;
  sessionId: string;
  migrationId: string;
  rehearsalId: string;
  requestedAt: string;
  reasonsRequired: string[];
  proposedActionSummary: string;
  highestRiskLevel: RiskLevel;
  riskSummary: string;
  evidenceSummary: string[];
  rollbackPlanSummary: string;
  fingerprint: string;
  status: string;
  session: unknown;
}

/**
 * Sanitized public response for POST /api/migrations/:sessionId/approve and /reject.
 */
export interface SanitizedApprovalDecisionResponse {
  decisionId: string;
  approvalRequestId: string;
  sessionId: string;
  migrationId: string;
  rehearsalId: string;
  status: ApprovalDecisionStatus;
  approver: string;
  decidedAt: string;
  fingerprint: string;
  comment?: string;
  rejectionReason?: string;
  session: unknown;
}
