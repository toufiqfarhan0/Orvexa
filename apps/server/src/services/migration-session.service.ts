import type {
  CreateMigrationSessionDto,
  MigrationSession,
  MigrationAnalysisResult,
  MigrationRiskAssessment,
  SandboxRehearsalResult,
  ApprovalRequest,
  ApprovalDecision,
  ExecutionResult,
  VerificationResult,
} from '@orvexa/shared';
import { MigrationSessionEntity } from '../domain/session.entity.js';
import { SessionNotFoundError } from '../domain/errors.js';
import type { MigrationSessionRepository } from '../repositories/session.repository.interface.js';

/**
 * MigrationSessionService - Application service / use-case orchestrator for migration sessions.
 */
export class MigrationSessionService {
  constructor(private readonly repository: MigrationSessionRepository) {}

  private async getEntityOrThrow(sessionId: string): Promise<MigrationSessionEntity> {
    const entity = await this.repository.findById(sessionId);
    if (!entity) {
      throw new SessionNotFoundError(sessionId);
    }
    return entity;
  }

  public async createSession(dto: CreateMigrationSessionDto): Promise<MigrationSession> {
    const entity = MigrationSessionEntity.create(dto);
    await this.repository.save(entity);
    return entity.toSnapshot();
  }

  public async getSession(sessionId: string): Promise<MigrationSession> {
    const entity = await this.getEntityOrThrow(sessionId);
    return entity.toSnapshot();
  }

  public async listSessions(): Promise<MigrationSession[]> {
    const entities = await this.repository.findAll();
    return entities.map((e) => e.toSnapshot());
  }

  public async beginAnalysis(sessionId: string, actor?: string): Promise<MigrationSession> {
    const entity = await this.getEntityOrThrow(sessionId);
    entity.beginAnalysis(actor);
    await this.repository.save(entity);
    return entity.toSnapshot();
  }

  public async recordAnalysisResult(
    sessionId: string,
    analysis: MigrationAnalysisResult,
    risk: MigrationRiskAssessment,
    actor?: string
  ): Promise<MigrationSession> {
    const entity = await this.getEntityOrThrow(sessionId);
    entity.recordAnalysisResult(analysis, risk, actor);
    await this.repository.save(entity);
    return entity.toSnapshot();
  }

  public async recordAnalysisFailure(
    sessionId: string,
    errorMessage: string,
    actor?: string
  ): Promise<MigrationSession> {
    const entity = await this.getEntityOrThrow(sessionId);
    entity.recordAnalysisFailure(errorMessage, actor);
    await this.repository.save(entity);
    return entity.toSnapshot();
  }

  public async beginSandboxRehearsal(sessionId: string, actor?: string): Promise<MigrationSession> {
    const entity = await this.getEntityOrThrow(sessionId);
    entity.beginSandboxRehearsal(actor);
    await this.repository.save(entity);
    return entity.toSnapshot();
  }

  public async recordSandboxResult(
    sessionId: string,
    result: SandboxRehearsalResult,
    actor?: string
  ): Promise<MigrationSession> {
    const entity = await this.getEntityOrThrow(sessionId);
    entity.recordSandboxResult(result, actor);
    await this.repository.save(entity);
    return entity.toSnapshot();
  }

  public async recordSandboxFailure(
    sessionId: string,
    errorMessage: string,
    actor?: string
  ): Promise<MigrationSession> {
    const entity = await this.getEntityOrThrow(sessionId);
    entity.recordSandboxFailure(errorMessage, actor);
    await this.repository.save(entity);
    return entity.toSnapshot();
  }

  public async requestApproval(
    sessionId: string,
    approvalRequest: ApprovalRequest,
    actor?: string
  ): Promise<MigrationSession> {
    const entity = await this.getEntityOrThrow(sessionId);
    entity.requestApproval(approvalRequest, actor);
    await this.repository.save(entity);
    return entity.toSnapshot();
  }

  public async recordApprovalDecision(
    sessionId: string,
    decision: ApprovalDecision
  ): Promise<MigrationSession> {
    const entity = await this.getEntityOrThrow(sessionId);
    entity.recordApprovalDecision(decision);
    await this.repository.save(entity);
    return entity.toSnapshot();
  }

  public async beginExecution(sessionId: string, actor?: string): Promise<MigrationSession> {
    const entity = await this.getEntityOrThrow(sessionId);
    entity.beginExecution(actor);
    await this.repository.save(entity);
    return entity.toSnapshot();
  }

  public async recordExecutionResult(
    sessionId: string,
    result: ExecutionResult,
    actor?: string
  ): Promise<MigrationSession> {
    const entity = await this.getEntityOrThrow(sessionId);
    entity.recordExecutionResult(result, actor);
    await this.repository.save(entity);
    return entity.toSnapshot();
  }

  public async recordExecutionFailure(
    sessionId: string,
    errorMessage: string,
    actor?: string
  ): Promise<MigrationSession> {
    const entity = await this.getEntityOrThrow(sessionId);
    entity.recordExecutionFailure(errorMessage, actor);
    await this.repository.save(entity);
    return entity.toSnapshot();
  }

  public async beginVerification(sessionId: string, actor?: string): Promise<MigrationSession> {
    const entity = await this.getEntityOrThrow(sessionId);
    entity.beginVerification(actor);
    await this.repository.save(entity);
    return entity.toSnapshot();
  }

  public async recordVerificationResult(
    sessionId: string,
    result: VerificationResult,
    actor?: string
  ): Promise<MigrationSession> {
    const entity = await this.getEntityOrThrow(sessionId);
    entity.recordVerificationResult(result, actor);
    await this.repository.save(entity);
    return entity.toSnapshot();
  }

  public async recordVerificationFailure(
    sessionId: string,
    errorMessage: string,
    actor?: string
  ): Promise<MigrationSession> {
    const entity = await this.getEntityOrThrow(sessionId);
    entity.recordVerificationFailure(errorMessage, actor);
    await this.repository.save(entity);
    return entity.toSnapshot();
  }
}
