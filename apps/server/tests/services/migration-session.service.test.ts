import { describe, it, expect, beforeEach } from 'vitest';
import { MigrationSessionService } from '../../src/services/migration-session.service.js';
import { InMemoryMigrationSessionRepository } from '../../src/repositories/in-memory-session.repository.js';
import { SessionNotFoundError } from '../../src/domain/errors.js';
import type {
  CreateMigrationSessionDto,
  MigrationAnalysisResult,
  MigrationRiskAssessment,
  SandboxRehearsalResult,
  ApprovalDecision,
  ExecutionResult,
  VerificationResult,
} from '@orvexa/shared';

describe('MigrationSessionService (Application Service Layer)', () => {
  let repository: InMemoryMigrationSessionRepository;
  let service: MigrationSessionService;

  const validDto: CreateMigrationSessionDto = {
    targetDatabase: {
      engine: 'postgresql',
      version: '15.4',
      databaseName: 'ecommerce_app',
      schemaName: 'public',
      targetTable: 'orders',
      estimatedRowCount: 2500000,
      isProductionLike: true,
    },
    proposedMigration: {
      migrationId: 'mig-service-01',
      name: 'add_order_status_index',
      rawSql: 'CREATE INDEX CONCURRENTLY idx_orders_status ON orders (status);',
      primaryOperation: 'ADD_INDEX',
      plannedStatements: [
        {
          statementIndex: 0,
          sql: 'CREATE INDEX CONCURRENTLY idx_orders_status ON orders (status);',
          operationType: 'ADD_INDEX',
          targetObject: 'orders.status',
        },
      ],
    },
  };

  beforeEach(() => {
    repository = new InMemoryMigrationSessionRepository();
    service = new MigrationSessionService(repository);
  });

  it('creates and retrieves a migration session', async () => {
    const session = await service.createSession(validDto);

    expect(session.sessionId).toBeDefined();
    expect(session.status).toBe('DRAFT');

    const fetched = await service.getSession(session.sessionId);
    expect(fetched.sessionId).toBe(session.sessionId);
    expect(fetched.request.targetDatabase.databaseName).toBe('ecommerce_app');
  });

  it('throws SessionNotFoundError when querying non-existent session', async () => {
    await expect(service.getSession('non-existent-id')).rejects.toThrow(SessionNotFoundError);
  });

  it('orchestrates complete end-to-end session workflow through the service', async () => {
    // 1. Create Session
    const session = await service.createSession(validDto);
    const id = session.sessionId;

    // 2. Begin Analysis
    const analyzing = await service.beginAnalysis(id, 'orchestrator');
    expect(analyzing.status).toBe('ANALYZING');

    // 3. Record Analysis Result
    const analysis: MigrationAnalysisResult = {
      analysisId: 'ana-srv-1',
      analyzedAt: new Date().toISOString(),
      summary: 'Index creation validated.',
      findings: [],
      isSafeForSandbox: true,
      blockers: [],
    };
    const risk: MigrationRiskAssessment = {
      overallRiskLevel: 'LOW',
      overallScore: 10,
      summary: 'Safe concurrent index',
      lockAnalysis: {
        lockMode: 'SHARE_UPDATE_EXCLUSIVE',
        blocksReads: false,
        blocksWrites: false,
        estimatedAcquisitionMs: 10,
        recommendedLockTimeoutMs: 2000,
      },
      categoryAssessments: {
        LOCKING: { category: 'LOCKING', level: 'LOW', score: 10, summary: 'Safe', reasons: [] },
        PERFORMANCE: {
          category: 'PERFORMANCE',
          level: 'LOW',
          score: 10,
          summary: 'Safe',
          reasons: [],
        },
        DATA_INTEGRITY: {
          category: 'DATA_INTEGRITY',
          level: 'LOW',
          score: 0,
          summary: 'Safe',
          reasons: [],
        },
        ROLLBACK: { category: 'ROLLBACK', level: 'LOW', score: 0, summary: 'Safe', reasons: [] },
        COMPATIBILITY: {
          category: 'COMPATIBILITY',
          level: 'LOW',
          score: 0,
          summary: 'Safe',
          reasons: [],
        },
      },
      assessedAt: new Date().toISOString(),
    };

    const sandboxing = await service.recordAnalysisResult(id, analysis, risk, 'analyzer-agent');
    expect(sandboxing.status).toBe('SANDBOX_RUNNING');

    // 4. Record Sandbox Result
    const sandboxResult: SandboxRehearsalResult = {
      rehearsalId: 'reh-srv-1',
      status: 'SUCCESS',
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      durationMs: 350,
      simulatedLockAcquisitionMs: 10,
      rowsAffected: 0,
      statementsExecuted: 1,
      rollbackVerified: true,
      logs: ['Sandbox dry-run succeeded.'],
    };

    const awaitingApproval = await service.recordSandboxResult(id, sandboxResult, 'sandbox-runner');
    expect(awaitingApproval.status).toBe('AWAITING_APPROVAL');

    // 5. Record Approval Decision
    const decision: ApprovalDecision = {
      decisionId: 'dec-srv-1',
      approvalRequestId: 'app-req-1',
      status: 'APPROVED',
      approver: 'tech.lead@company.com',
      decidedAt: new Date().toISOString(),
      comment: 'Approved for off-peak execution.',
    };

    const approved = await service.recordApprovalDecision(id, decision);
    expect(approved.status).toBe('APPROVED');

    // 6. Begin & Record Execution
    await service.beginExecution(id, 'executor-agent');
    const executionResult: ExecutionResult = {
      executionId: 'exec-srv-1',
      status: 'SUCCESS',
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      durationMs: 1500,
      statementsExecuted: 1,
      logs: ['Target DB executed index creation.'],
      executedBy: 'executor-agent',
    };

    const verifying = await service.recordExecutionResult(id, executionResult, 'executor-agent');
    expect(verifying.status).toBe('VERIFYING');

    // 7. Record Verification Result
    const verificationResult: VerificationResult = {
      verificationId: 'ver-srv-1',
      status: 'PASSED',
      verifiedAt: new Date().toISOString(),
      durationMs: 50,
      checks: [
        {
          checkId: 'chk-1',
          name: 'Schema Parity',
          category: 'SCHEMA_PARITY',
          passed: true,
          message: 'Index created with valid status.',
          durationMs: 20,
        },
      ],
      healthSummary: {
        connectionPoolOk: true,
        schemaMatchesExpected: true,
        indexStatusValid: true,
        latencyUnderThreshold: true,
      },
    };

    const completed = await service.recordVerificationResult(
      id,
      verificationResult,
      'verifier-agent'
    );
    expect(completed.status).toBe('COMPLETED');
    expect(completed.verificationResult?.status).toBe('PASSED');

    // Verify session lists correctly
    const all = await service.listSessions();
    expect(all.length).toBe(1);
    expect(all[0].sessionId).toBe(id);
  });
});
