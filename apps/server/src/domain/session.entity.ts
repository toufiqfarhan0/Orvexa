import { randomUUID } from 'node:crypto';
import type {
  CreateMigrationSessionDto,
  MigrationSession,
  MigrationSessionStatus,
  MigrationAnalysisResult,
  MigrationRiskAssessment,
  SandboxRehearsalResult,
  ApprovalRequest,
  ApprovalDecision,
  ExecutionResult,
  VerificationResult,
  SessionHistoryEntry,
} from '@orvexa/shared';
import { assertValidTransition } from './state-machine.js';
import { IllegalActionError } from './errors.js';
import { validateCreateSessionDto, validateApprovalDecision } from './validators.js';

/**
 * MigrationSessionEntity - Domain aggregate root encapsulating business rules,
 * invariant enforcement, and state transitions for a schema migration session.
 */
export class MigrationSessionEntity {
  private _status: MigrationSessionStatus;
  private _updatedAt: string;
  private _analysisResult?: MigrationAnalysisResult;
  private _riskAssessment?: MigrationRiskAssessment;
  private _sandboxResult?: SandboxRehearsalResult;
  private _approvalRequest?: ApprovalRequest;
  private _approvalDecision?: ApprovalDecision;
  private _executionResult?: ExecutionResult;
  private _verificationResult?: VerificationResult;
  private _lastErrorMessage?: string;
  private readonly _history: SessionHistoryEntry[];

  private constructor(private readonly _props: MigrationSession) {
    this._status = _props.status;
    this._updatedAt = _props.updatedAt;
    this._analysisResult = _props.analysisResult;
    this._riskAssessment = _props.riskAssessment;
    this._sandboxResult = _props.sandboxResult;
    this._approvalRequest = _props.approvalRequest;
    this._approvalDecision = _props.approvalDecision;
    this._executionResult = _props.executionResult;
    this._verificationResult = _props.verificationResult;
    this._lastErrorMessage = _props.lastErrorMessage;
    this._history = [..._props.history];
  }

  /**
   * Factory method to create a new MigrationSession in DRAFT state.
   */
  public static create(
    dto: CreateMigrationSessionDto,
    idGenerator: () => string = randomUUID
  ): MigrationSessionEntity {
    validateCreateSessionDto(dto);

    const now = new Date().toISOString();
    const sessionId = idGenerator();
    const requestId = idGenerator();
    const migrationId = dto.proposedMigration.migrationId || idGenerator();

    const sessionData: MigrationSession = {
      sessionId,
      status: 'DRAFT',
      createdAt: now,
      updatedAt: now,
      request: {
        requestId,
        createdAt: now,
        targetDatabase: { ...dto.targetDatabase },
        proposedMigration: {
          ...dto.proposedMigration,
          migrationId,
        },
        requestMetadata: dto.requestMetadata,
      },
      history: [
        {
          fromStatus: null,
          toStatus: 'DRAFT',
          timestamp: now,
          reason: 'Session created in draft state.',
        },
      ],
    };

    return new MigrationSessionEntity(sessionData);
  }

  /**
   * Reconstitute a domain entity from an existing snapshot.
   */
  public static fromSnapshot(snapshot: MigrationSession): MigrationSessionEntity {
    return new MigrationSessionEntity({ ...snapshot });
  }

  /**
   * Export immutable snapshot of the entity's current state.
   */
  public toSnapshot(): MigrationSession {
    return {
      sessionId: this._props.sessionId,
      status: this._status,
      createdAt: this._props.createdAt,
      updatedAt: this._updatedAt,
      request: { ...this._props.request },
      analysisResult: this._analysisResult ? { ...this._analysisResult } : undefined,
      riskAssessment: this._riskAssessment ? { ...this._riskAssessment } : undefined,
      sandboxResult: this._sandboxResult ? { ...this._sandboxResult } : undefined,
      approvalRequest: this._approvalRequest ? { ...this._approvalRequest } : undefined,
      approvalDecision: this._approvalDecision ? { ...this._approvalDecision } : undefined,
      executionResult: this._executionResult ? { ...this._executionResult } : undefined,
      verificationResult: this._verificationResult ? { ...this._verificationResult } : undefined,
      lastErrorMessage: this._lastErrorMessage,
      history: [...this._history],
    };
  }

  // Getters
  public get id(): string {
    return this._props.sessionId;
  }

  public get status(): MigrationSessionStatus {
    return this._status;
  }

  public get createdAt(): string {
    return this._props.createdAt;
  }

  public get updatedAt(): string {
    return this._updatedAt;
  }

  public get request() {
    return this._props.request;
  }

  public get analysisResult() {
    return this._analysisResult;
  }

  public get riskAssessment() {
    return this._riskAssessment;
  }

  public get sandboxResult() {
    return this._sandboxResult;
  }

  public get approvalRequest() {
    return this._approvalRequest;
  }

  public get approvalDecision() {
    return this._approvalDecision;
  }

  public get executionResult() {
    return this._executionResult;
  }

  public get verificationResult() {
    return this._verificationResult;
  }

  public get lastErrorMessage() {
    return this._lastErrorMessage;
  }

  public get history(): ReadonlyArray<SessionHistoryEntry> {
    return this._history;
  }

  /**
   * Internal transition helper.
   */
  private transitionTo(nextStatus: MigrationSessionStatus, reason?: string, actor?: string): void {
    assertValidTransition(this._status, nextStatus, this.id, reason);
    const now = new Date().toISOString();
    this._history.push({
      fromStatus: this._status,
      toStatus: nextStatus,
      timestamp: now,
      reason,
      actor,
    });
    this._status = nextStatus;
    this._updatedAt = now;
  }

  // ---------------------------------------------------------------------------
  // Lifecycle Transition Methods & Invariant Rules
  // ---------------------------------------------------------------------------

  /**
   * Begin static and semantic analysis of the proposed migration.
   */
  public beginAnalysis(actor?: string): void {
    this.transitionTo('ANALYZING', 'Initiated schema migration analysis.', actor);
  }

  /**
   * Record analysis findings and risk assessment.
   */
  public recordAnalysisResult(
    analysis: MigrationAnalysisResult,
    risk: MigrationRiskAssessment,
    actor?: string
  ): void {
    if (this._status !== 'ANALYZING') {
      throw new IllegalActionError(
        `Cannot record analysis results for session in '${this._status}' status.`,
        'Session must be in ANALYZING status.'
      );
    }
    this._analysisResult = analysis;
    this._riskAssessment = risk;

    if (analysis.isSafeForSandbox) {
      this.transitionTo(
        'SANDBOX_READY',
        'Analysis completed successfully. Ready for sandbox rehearsal.',
        actor
      );
    } else {
      this._lastErrorMessage =
        analysis.blockers.join('; ') || 'Migration analysis identified blocking issues.';
      this.transitionTo(
        'ANALYSIS_FAILED',
        `Analysis identified ${analysis.blockers.length} blocker(s): ${this._lastErrorMessage}`,
        actor
      );
    }
  }

  /**
   * Record analysis failure.
   */
  public recordAnalysisFailure(errorMessage: string, actor?: string): void {
    this._lastErrorMessage = errorMessage;
    this.transitionTo('ANALYSIS_FAILED', `Analysis failed: ${errorMessage}`, actor);
  }

  /**
   * Explicitly begin sandbox rehearsal.
   */
  public beginSandboxRehearsal(actor?: string): void {
    if (!this._analysisResult) {
      throw new IllegalActionError(
        'Cannot begin sandbox rehearsal without prior analysis results.',
        'AnalysisResult must be present.'
      );
    }
    if (this._status !== 'SANDBOX_READY') {
      throw new IllegalActionError(
        `Cannot begin sandbox rehearsal from '${this._status}' status.`,
        'Session must be in SANDBOX_READY status.'
      );
    }
    this.transitionTo('SANDBOX_RUNNING', 'Starting isolated PostgreSQL sandbox rehearsal.', actor);
  }

  /**
   * Record completed sandbox rehearsal result.
   */
  public recordSandboxResult(result: SandboxRehearsalResult, actor?: string): void {
    if (this._status !== 'SANDBOX_RUNNING') {
      throw new IllegalActionError(
        `Cannot record sandbox result for session in '${this._status}' status.`,
        'Session must be in SANDBOX_RUNNING status.'
      );
    }

    this._sandboxResult = result;

    if (result.status === 'SUCCESS') {
      this.transitionTo(
        'SANDBOX_REHEARSAL_COMPLETED',
        'Sandbox rehearsal completed successfully.',
        actor
      );
    } else {
      this._lastErrorMessage = result.errorMessage || 'Sandbox rehearsal failed.';
      this.transitionTo(
        'SANDBOX_FAILED',
        `Sandbox rehearsal finished with status: ${result.status}`,
        actor
      );
    }
  }

  /**
   * Record sandbox failure.
   */
  public recordSandboxFailure(errorMessage: string, actor?: string): void {
    this._lastErrorMessage = errorMessage;
    this.transitionTo('SANDBOX_FAILED', `Sandbox execution failed: ${errorMessage}`, actor);
  }

  /**
   * Request human approval for migration execution.
   */
  public requestApproval(request: ApprovalRequest, actor?: string): void {
    if (!this._analysisResult) {
      throw new IllegalActionError(
        'Cannot request approval before migration analysis is completed.',
        'AnalysisResult required before approval.'
      );
    }

    if (!this._sandboxResult || this._sandboxResult.status !== 'SUCCESS') {
      throw new IllegalActionError(
        'Cannot request approval without a successful sandbox rehearsal result.',
        'SandboxRehearsalResult with status SUCCESS is required.'
      );
    }

    this._approvalRequest = request;
    if (this._status !== 'AWAITING_APPROVAL') {
      this.transitionTo('AWAITING_APPROVAL', 'Human approval requested.', actor);
    }
  }

  /**
   * Record human decision (Approval or Rejection).
   */
  public recordApprovalDecision(decision: ApprovalDecision): void {
    validateApprovalDecision(decision);

    if (this._status !== 'AWAITING_APPROVAL') {
      throw new IllegalActionError(
        `Cannot record approval decision when session is in '${this._status}' status.`,
        'Session must be in AWAITING_APPROVAL status.'
      );
    }

    this._approvalDecision = decision;

    if (decision.status === 'APPROVED') {
      this.transitionTo('APPROVED', `Approved by ${decision.approver}`, decision.approver);
    } else {
      this._lastErrorMessage = decision.rejectionReason;
      this.transitionTo(
        'REJECTED',
        `Rejected by ${decision.approver}: ${decision.rejectionReason}`,
        decision.approver
      );
    }
  }

  /**
   * Begin execution on target database.
   */
  public beginExecution(actor?: string): void {
    if (this._status !== 'APPROVED') {
      throw new IllegalActionError(
        `Cannot begin execution when session is in '${this._status}' status. Human approval is strictly required.`,
        'Session must be in APPROVED status prior to execution.'
      );
    }

    this.transitionTo(
      'EXECUTING',
      'Initiating live migration execution on target database.',
      actor
    );
  }

  /**
   * Record target execution result.
   */
  public recordExecutionResult(result: ExecutionResult, actor?: string): void {
    if (this._status !== 'EXECUTING') {
      throw new IllegalActionError(
        `Cannot record execution result when session is in '${this._status}' status.`,
        'Session must be in EXECUTING status.'
      );
    }

    this._executionResult = result;

    if (result.status === 'SUCCESS') {
      this.transitionTo(
        'VERIFYING',
        'Target database execution succeeded. Initiating verification.',
        actor
      );
    } else {
      this._lastErrorMessage = result.errorMessage || 'Execution failed on target database.';
      this.transitionTo('EXECUTION_FAILED', `Execution failed: ${this._lastErrorMessage}`, actor);
    }
  }

  /**
   * Record execution failure.
   */
  public recordExecutionFailure(errorMessage: string, actor?: string): void {
    this._lastErrorMessage = errorMessage;
    this.transitionTo('EXECUTION_FAILED', `Execution failed: ${errorMessage}`, actor);
  }

  /**
   * Explicitly begin post-execution verification.
   */
  public beginVerification(actor?: string): void {
    if (!this._executionResult || this._executionResult.status !== 'SUCCESS') {
      throw new IllegalActionError(
        'Cannot begin verification without successful execution result.',
        'ExecutionResult with status SUCCESS required.'
      );
    }

    this.transitionTo('VERIFYING', 'Running automated verification probes.', actor);
  }

  /**
   * Record post-execution verification outcome.
   */
  public recordVerificationResult(result: VerificationResult, actor?: string): void {
    if (this._status !== 'VERIFYING') {
      throw new IllegalActionError(
        `Cannot record verification result when session is in '${this._status}' status.`,
        'Session must be in VERIFYING status.'
      );
    }

    this._verificationResult = result;

    if (result.status === 'PASSED') {
      this.transitionTo(
        'COMPLETED',
        'Verification checks passed. Migration successfully completed.',
        actor
      );
    } else {
      this._lastErrorMessage = result.errorMessage || 'Post-migration verification checks failed.';
      this.transitionTo(
        'VERIFICATION_FAILED',
        `Verification failed: ${this._lastErrorMessage}`,
        actor
      );
    }
  }

  /**
   * Record verification failure.
   */
  public recordVerificationFailure(errorMessage: string, actor?: string): void {
    this._lastErrorMessage = errorMessage;
    this.transitionTo('VERIFICATION_FAILED', `Verification failed: ${errorMessage}`, actor);
  }
}
