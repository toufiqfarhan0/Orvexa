import { randomUUID } from 'node:crypto';
import type {
  ApprovalDecision,
  ApprovalRequest,
  ApprovalValidationResult,
  ApproveMigrationDto,
  MigrationSession,
  RejectMigrationDto,
  RequestApprovalDto,
} from '@orvexa/shared';
import type { MigrationSessionRepository } from '../../repositories/session.repository.interface.js';
import { IllegalActionError, SessionNotFoundError, ValidationError } from '../../domain/errors.js';
import { ApprovalFingerprintGenerator } from '../utils/approval-fingerprint.js';
import { TrueForgeLogger } from '../../trueforge/trueforge.logger.js';

/**
 * Returns true if the string contains ASCII control characters (0x00..0x1F, 0x7F).
 */
function hasControlCharacters(str: string): boolean {
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    if ((code >= 0 && code <= 31) || code === 127) {
      return true;
    }
  }
  return false;
}

/**
 * Validates human actor/approver identifier at the service boundary.
 * Enforces string type, 1..100 trimmed character length, and printable characters.
 * (Note: Authenticated cryptographic identity verification is an infrastructure-level concern).
 */
export function validateActorIdentifier(actor: unknown, fieldName = 'Approver'): string {
  if (actor === null || actor === undefined || typeof actor !== 'string') {
    throw new ValidationError(`${fieldName} identifier is required and must be a string.`);
  }

  const trimmed = actor.trim();
  if (trimmed.length === 0) {
    throw new ValidationError(`${fieldName} identifier cannot be empty.`);
  }

  if (trimmed.length > 100) {
    throw new ValidationError(
      `${fieldName} identifier exceeds maximum allowed length (100 characters).`
    );
  }

  if (hasControlCharacters(trimmed)) {
    throw new ValidationError(`${fieldName} identifier contains invalid control characters.`);
  }

  return trimmed;
}

export interface ApprovalServiceOptions {
  sessionRepository: MigrationSessionRepository;
  logger?: TrueForgeLogger;
}

/**
 * ApprovalService
 *
 * Enforces human approval gate invariants:
 * - Requires successful rehearsal evidence before requesting approval.
 * - Cryptographically binds approvals to exact migration SQL, target DB, and rehearsal results.
 * - Enforces state transitions (AWAITING_APPROVAL -> APPROVED / REJECTED).
 * - Guarantees full auditability and invalidation on fingerprint mismatch.
 */
export class ApprovalService {
  private readonly sessionRepo: MigrationSessionRepository;
  private readonly logger: TrueForgeLogger;

  constructor(options: ApprovalServiceOptions) {
    this.sessionRepo = options.sessionRepository;
    this.logger = options.logger || new TrueForgeLogger('[SchemaSentry:ApprovalService]');
  }

  public get sessionRepository(): MigrationSessionRepository {
    return this.sessionRepo;
  }

  /**
   * Submits a completed migration rehearsal for human review and approval.
   */
  async requestApproval(dto: RequestApprovalDto): Promise<ApprovalRequest> {
    const { sessionId, actor, comment } = dto;
    const validatedActor = actor ? validateActorIdentifier(actor, 'Actor') : 'Engineer';
    this.logger.info('Requesting human approval for session', { sessionId, actor: validatedActor });

    const session = await this.sessionRepo.findById(sessionId);
    if (!session) {
      throw new SessionNotFoundError(sessionId);
    }

    if (
      session.status !== 'SANDBOX_REHEARSAL_COMPLETED' &&
      session.status !== 'AWAITING_APPROVAL'
    ) {
      throw new IllegalActionError(
        `Cannot request approval for session in '${session.status}' status. Rehearsal must be completed first.`,
        'Session must be in SANDBOX_REHEARSAL_COMPLETED status.'
      );
    }

    if (!session.sandboxResult || session.sandboxResult.status !== 'SUCCESS') {
      throw new IllegalActionError(
        'Cannot request approval without successful rehearsal evidence.',
        'SandboxRehearsalResult with status SUCCESS is required.'
      );
    }

    if (!session.riskAssessment) {
      throw new IllegalActionError(
        'Cannot request approval without completed risk assessment.',
        'RiskAssessment required.'
      );
    }

    const fingerprint = ApprovalFingerprintGenerator.compute(session);

    // Assemble risk reasons
    const reasonsRequired: string[] = [];
    if (session.riskAssessment.categoryAssessments) {
      for (const assessment of Object.values(session.riskAssessment.categoryAssessments)) {
        if (assessment.reasons && assessment.reasons.length > 0) {
          reasonsRequired.push(...assessment.reasons);
        }
      }
    }
    if (reasonsRequired.length === 0) {
      reasonsRequired.push(session.riskAssessment.summary || 'Standard migration review required');
    }

    const evidenceSummary: string[] = [
      `Rehearsal ID: ${session.sandboxResult.rehearsalId}`,
      `Statements Executed: ${session.sandboxResult.statementsExecuted}`,
      `Rows Affected: ${session.sandboxResult.rowsAffected}`,
      `Duration: ${session.sandboxResult.durationMs}ms`,
    ];
    if (session.sandboxResult.logs && session.sandboxResult.logs.length > 0) {
      evidenceSummary.push(...session.sandboxResult.logs.slice(0, 5));
    }

    const proposedActionSummary =
      comment?.trim() ||
      session.request.proposedMigration.name ||
      `Migration on ${session.request.targetDatabase.databaseName}`;

    const approvalRequest: ApprovalRequest = {
      approvalRequestId: `appr_req_${randomUUID()}`,
      sessionId,
      migrationId: session.request.proposedMigration.migrationId,
      rehearsalId: session.sandboxResult.rehearsalId,
      requestedAt: new Date().toISOString(),
      reasonsRequired,
      proposedActionSummary,
      highestRiskLevel: session.riskAssessment.overallRiskLevel,
      riskSummary: session.riskAssessment.summary,
      evidenceSummary,
      rollbackPlanSummary: session.sandboxResult.rollbackVerified
        ? 'Rollback and disposable database cleanup successfully verified in rehearsal.'
        : 'Rollback verification pending.',
      fingerprint: fingerprint.fingerprintHash,
    };

    session.requestApproval(approvalRequest, validatedActor);
    await this.sessionRepo.save(session);

    this.logger.info('Session successfully transitioned to AWAITING_APPROVAL', {
      sessionId,
      approvalRequestId: approvalRequest.approvalRequestId,
      fingerprint: fingerprint.fingerprintHash,
    });

    return approvalRequest;
  }

  /**
   * Records an explicit human APPROVE decision.
   */
  async approve(dto: ApproveMigrationDto): Promise<ApprovalDecision> {
    const { sessionId, approver, comment, fingerprint } = dto;
    const validatedApprover = validateActorIdentifier(approver, 'Approver');

    this.logger.info('Recording human approval decision', {
      sessionId,
      approver: validatedApprover,
    });

    const session = await this.sessionRepo.findById(sessionId);
    if (!session) {
      throw new SessionNotFoundError(sessionId);
    }

    if (session.status !== 'AWAITING_APPROVAL') {
      throw new IllegalActionError(
        `Cannot approve session in '${session.status}' status.`,
        'Session must be in AWAITING_APPROVAL status.'
      );
    }

    // Verify cryptographic fingerprint to guarantee the exact proposal reviewed is what is approved
    const currentFingerprint = ApprovalFingerprintGenerator.compute(session);

    if (session.approvalRequest && session.approvalRequest.fingerprint) {
      if (session.approvalRequest.fingerprint !== currentFingerprint.fingerprintHash) {
        throw new IllegalActionError(
          'Approval rejected: Migration proposal or rehearsal evidence has changed since approval was requested.',
          'Fingerprint mismatch against approval request.'
        );
      }
    }

    if (fingerprint && fingerprint.trim() !== currentFingerprint.fingerprintHash) {
      throw new IllegalActionError(
        'Approval rejected: Supplied approval fingerprint does not match current migration proposal.',
        'Supplied fingerprint mismatch.'
      );
    }

    const decision: ApprovalDecision = {
      decisionId: `appr_dec_${randomUUID()}`,
      approvalRequestId: session.approvalRequest?.approvalRequestId || '',
      sessionId,
      migrationId: session.request.proposedMigration.migrationId,
      rehearsalId: session.sandboxResult?.rehearsalId || '',
      status: 'APPROVED',
      approver: validatedApprover,
      decidedAt: new Date().toISOString(),
      fingerprint: currentFingerprint.fingerprintHash,
      comment: comment?.trim(),
    };

    session.recordApprovalDecision(decision);
    await this.sessionRepo.save(session);

    this.logger.info('Session successfully transitioned to APPROVED', {
      sessionId,
      decisionId: decision.decisionId,
      approver: decision.approver,
    });

    return decision;
  }

  /**
   * Records an explicit human REJECT decision with a required rejection reason.
   */
  async reject(dto: RejectMigrationDto): Promise<ApprovalDecision> {
    const { sessionId, approver, reason, fingerprint } = dto;
    const validatedApprover = validateActorIdentifier(approver, 'Approver');

    if (!reason || typeof reason !== 'string' || reason.trim().length === 0) {
      throw new ValidationError('A rejection reason must be provided when rejecting a migration.');
    }

    if (reason.trim().length > 1000) {
      throw new ValidationError(
        'Rejection reason exceeds maximum allowed length (1000 characters).'
      );
    }

    this.logger.info('Recording human rejection decision', {
      sessionId,
      approver: validatedApprover,
      reason,
    });

    const session = await this.sessionRepo.findById(sessionId);
    if (!session) {
      throw new SessionNotFoundError(sessionId);
    }

    if (session.status !== 'AWAITING_APPROVAL') {
      throw new IllegalActionError(
        `Cannot reject session in '${session.status}' status.`,
        'Session must be in AWAITING_APPROVAL status.'
      );
    }

    // Verify cryptographic fingerprint binding to guarantee consistency with the approval request
    const currentFingerprint = ApprovalFingerprintGenerator.compute(session);

    if (session.approvalRequest && session.approvalRequest.fingerprint) {
      if (session.approvalRequest.fingerprint !== currentFingerprint.fingerprintHash) {
        throw new IllegalActionError(
          'Rejection rejected: Migration proposal or rehearsal evidence has changed since approval was requested.',
          'Fingerprint mismatch against approval request.'
        );
      }
    }

    if (fingerprint && fingerprint.trim() !== currentFingerprint.fingerprintHash) {
      throw new IllegalActionError(
        'Rejection rejected: Supplied fingerprint does not match current migration proposal.',
        'Supplied fingerprint mismatch.'
      );
    }

    const decision: ApprovalDecision = {
      decisionId: `appr_dec_${randomUUID()}`,
      approvalRequestId: session.approvalRequest?.approvalRequestId || '',
      sessionId,
      migrationId: session.request.proposedMigration.migrationId,
      rehearsalId: session.sandboxResult?.rehearsalId || '',
      status: 'REJECTED',
      approver: validatedApprover,
      decidedAt: new Date().toISOString(),
      fingerprint: currentFingerprint.fingerprintHash,
      rejectionReason: reason.trim(),
    };

    session.recordApprovalDecision(decision);
    await this.sessionRepo.save(session);

    this.logger.info('Session successfully transitioned to REJECTED', {
      sessionId,
      decisionId: decision.decisionId,
      approver: decision.approver,
      reason: decision.rejectionReason,
    });

    return decision;
  }

  /**
   * Validates whether a previously granted approval remains strictly valid against current session state.
   */
  async validateApproval(sessionId: string): Promise<ApprovalValidationResult> {
    const session = await this.sessionRepo.findById(sessionId);
    if (!session) {
      return {
        valid: false,
        sessionId,
        status: 'UNKNOWN',
        reason: `Session '${sessionId}' not found.`,
      };
    }

    if (session.status !== 'APPROVED') {
      return {
        valid: false,
        sessionId,
        status: session.status,
        reason: `Session is in '${session.status}' status, expected 'APPROVED'.`,
      };
    }

    if (!session.approvalDecision || session.approvalDecision.status !== 'APPROVED') {
      return {
        valid: false,
        sessionId,
        status: session.status,
        reason: 'Session lacks an active APPROVED decision.',
      };
    }

    const currentFingerprint = ApprovalFingerprintGenerator.compute(session);
    if (session.approvalDecision.fingerprint !== currentFingerprint.fingerprintHash) {
      // Invalidate modified approval
      session.invalidateApproval('Fingerprint mismatch detected during verification probe.');
      await this.sessionRepo.save(session);

      return {
        valid: false,
        sessionId,
        status: session.status,
        fingerprint: currentFingerprint.fingerprintHash,
        reason:
          'Approval fingerprint mismatch: migration SQL or rehearsal state was modified after approval.',
      };
    }

    return {
      valid: true,
      sessionId,
      status: 'APPROVED',
      fingerprint: currentFingerprint.fingerprintHash,
    };
  }

  /**
   * Explicitly invalidates an existing approval (e.g. on re-analysis or configuration change).
   */
  async invalidateApproval(
    sessionId: string,
    reason: string,
    actor?: string
  ): Promise<MigrationSession> {
    const session = await this.sessionRepo.findById(sessionId);
    if (!session) {
      throw new SessionNotFoundError(sessionId);
    }

    session.invalidateApproval(reason, actor);
    await this.sessionRepo.save(session);

    return session.toSnapshot();
  }
}
