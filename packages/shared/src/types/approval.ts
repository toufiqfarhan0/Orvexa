import type { RiskLevel } from './risk.js';

/**
 * Valid states for an approval decision.
 */
export type ApprovalDecisionStatus = 'APPROVED' | 'REJECTED';

/**
 * Human approval request payload presented to an engineer or DBA.
 */
export interface ApprovalRequest {
  approvalRequestId: string;
  requestedAt: string;
  reasonsRequired: string[];
  proposedActionSummary: string;
  highestRiskLevel: RiskLevel;
  riskSummary: string;
  evidenceSummary: string[];
  rollbackPlanSummary: string;
  expiresAt?: string;
}

/**
 * Recorded human approval or rejection decision.
 */
export interface ApprovalDecision {
  decisionId: string;
  approvalRequestId: string;
  status: ApprovalDecisionStatus;
  approver: string;
  decidedAt: string;
  comment?: string;
  rejectionReason?: string;
}
