import { describe, it, expect } from 'vitest';
import { MigrationSessionEntity } from '../../src/domain/session.entity.js';
import {
  IllegalActionError,
  InvalidStateTransitionError,
  ValidationError,
} from '../../src/domain/errors.js';
import type {
  CreateMigrationSessionDto,
  MigrationAnalysisResult,
  MigrationRiskAssessment,
  SandboxRehearsalResult,
  ApprovalRequest,
  ApprovalDecision,
  ExecutionResult,
  VerificationResult,
} from '@orvexa/shared';

describe('MigrationSessionEntity (Domain Aggregate Root)', () => {
  const validDto: CreateMigrationSessionDto = {
    targetDatabase: {
      engine: 'postgresql',
      version: '16.2',
      databaseName: 'fintech_prod',
      schemaName: 'public',
      targetTable: 'transactions',
      estimatedRowCount: 12000000,
      isProductionLike: true,
    },
    proposedMigration: {
      migrationId: 'mig-100',
      name: 'add_composite_index_on_transactions',
      rawSql:
        'CREATE INDEX CONCURRENTLY idx_transactions_user_created ON transactions (user_id, created_at);',
      primaryOperation: 'ADD_INDEX',
      plannedStatements: [
        {
          statementIndex: 0,
          sql: 'CREATE INDEX CONCURRENTLY idx_transactions_user_created ON transactions (user_id, created_at);',
          operationType: 'ADD_INDEX',
          targetObject: 'transactions.idx_transactions_user_created',
        },
      ],
      rollbackSql: 'DROP INDEX CONCURRENTLY IF EXISTS idx_transactions_user_created;',
    },
  };

  const sampleAnalysis: MigrationAnalysisResult = {
    analysisId: 'ana-1',
    analyzedAt: new Date().toISOString(),
    summary: 'Non-blocking concurrent index creation analyzed.',
    findings: [],
    isSafeForSandbox: true,
    blockers: [],
  };

  const sampleRisk: MigrationRiskAssessment = {
    overallRiskLevel: 'LOW',
    overallScore: 15,
    summary: 'Low locking risk due to CONCURRENTLY modifier.',
    lockAnalysis: {
      lockMode: 'SHARE_UPDATE_EXCLUSIVE',
      blocksReads: false,
      blocksWrites: false,
      estimatedAcquisitionMs: 12,
      recommendedLockTimeoutMs: 2000,
    },
    categoryAssessments: {
      LOCKING: {
        category: 'LOCKING',
        level: 'LOW',
        score: 10,
        summary: 'Non-blocking write lock',
        reasons: [],
      },
      PERFORMANCE: {
        category: 'PERFORMANCE',
        level: 'LOW',
        score: 15,
        summary: 'Minimal overhead',
        reasons: [],
      },
      DATA_INTEGRITY: {
        category: 'DATA_INTEGRITY',
        level: 'LOW',
        score: 0,
        summary: 'No mutation',
        reasons: [],
      },
      ROLLBACK: { category: 'ROLLBACK', level: 'LOW', score: 5, summary: 'Safe drop', reasons: [] },
      COMPATIBILITY: {
        category: 'COMPATIBILITY',
        level: 'LOW',
        score: 0,
        summary: 'Compatible',
        reasons: [],
      },
    },
    assessedAt: new Date().toISOString(),
  };

  const sampleSandboxSuccess: SandboxRehearsalResult = {
    rehearsalId: 'reh-1',
    status: 'SUCCESS',
    startedAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
    durationMs: 450,
    simulatedLockAcquisitionMs: 15,
    rowsAffected: 0,
    statementsExecuted: 1,
    rollbackVerified: true,
    logs: ['Index build completed concurrently in sandbox replica.'],
  };

  const sampleApprovalRequest: ApprovalRequest = {
    approvalRequestId: 'app-req-1',
    requestedAt: new Date().toISOString(),
    reasonsRequired: ['Production-like environment modification'],
    proposedActionSummary: 'Create concurrent index on transactions table.',
    highestRiskLevel: 'LOW',
    riskSummary: 'Safe non-blocking concurrent index build.',
    evidenceSummary: ['Sandbox simulated lock time: 15ms'],
    rollbackPlanSummary: 'DROP INDEX CONCURRENTLY IF EXISTS idx_transactions_user_created',
  };

  const sampleApprovalDecision: ApprovalDecision = {
    decisionId: 'dec-1',
    approvalRequestId: 'app-req-1',
    status: 'APPROVED',
    approver: 'sarah.dba@company.com',
    decidedAt: new Date().toISOString(),
    comment: 'Rehearsal logs verified. Safe for execution.',
  };

  const sampleExecutionSuccess: ExecutionResult = {
    executionId: 'exec-1',
    status: 'SUCCESS',
    startedAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
    durationMs: 1200,
    statementsExecuted: 1,
    logs: ['Executed CREATE INDEX CONCURRENTLY on target database.'],
    executedBy: 'orchestrator-agent',
  };

  const sampleVerificationSuccess: VerificationResult = {
    verificationId: 'ver-1',
    status: 'PASSED',
    verifiedAt: new Date().toISOString(),
    durationMs: 80,
    checks: [
      {
        checkId: 'chk-1',
        name: 'Index Validity Check',
        category: 'INDEX_VALIDITY',
        passed: true,
        message: 'Index is valid and query planner utilizes index condition.',
        durationMs: 30,
      },
    ],
    healthSummary: {
      connectionPoolOk: true,
      schemaMatchesExpected: true,
      indexStatusValid: true,
      latencyUnderThreshold: true,
    },
  };

  it('creates a valid session in DRAFT state with history', () => {
    const session = MigrationSessionEntity.create(validDto);

    expect(session.id).toBeDefined();
    expect(session.status).toBe('DRAFT');
    expect(session.createdAt).toBeDefined();
    expect(session.updatedAt).toBeDefined();
    expect(session.request.targetDatabase.databaseName).toBe('fintech_prod');
    expect(session.history.length).toBe(1);
    expect(session.history[0].toStatus).toBe('DRAFT');
  });

  it('rejects invalid migration session creation with ValidationError', () => {
    const invalidDto = {
      targetDatabase: null,
      proposedMigration: null,
    } as unknown as CreateMigrationSessionDto;

    expect(() => MigrationSessionEntity.create(invalidDto)).toThrow(ValidationError);
  });

  it('executes full happy path lifecycle from DRAFT to COMPLETED', () => {
    const session = MigrationSessionEntity.create(validDto);

    // 1. Begin Analysis (DRAFT -> ANALYZING)
    session.beginAnalysis('agent-orchestrator');
    expect(session.status).toBe('ANALYZING');

    // 2. Record Analysis Result (ANALYZING -> SANDBOX_READY)
    session.recordAnalysisResult(sampleAnalysis, sampleRisk, 'agent-analyzer');
    expect(session.status).toBe('SANDBOX_READY');
    expect(session.analysisResult).toBeDefined();
    expect(session.riskAssessment).toBeDefined();

    // 3. Begin Sandbox Rehearsal (SANDBOX_READY -> SANDBOX_RUNNING)
    session.beginSandboxRehearsal('sandbox-runner');
    expect(session.status).toBe('SANDBOX_RUNNING');

    // 4. Record Sandbox Rehearsal Result (SANDBOX_RUNNING -> AWAITING_APPROVAL)
    session.recordSandboxResult(sampleSandboxSuccess, 'sandbox-runner');
    expect(session.status).toBe('AWAITING_APPROVAL');
    expect(session.sandboxResult).toBeDefined();

    // 5. Request and record approval (AWAITING_APPROVAL -> APPROVED)
    session.requestApproval(sampleApprovalRequest, 'agent-orchestrator');
    expect(session.approvalRequest).toBeDefined();
    session.recordApprovalDecision(sampleApprovalDecision);
    expect(session.status).toBe('APPROVED');
    expect(session.approvalDecision?.status).toBe('APPROVED');

    // 6. Begin Execution (APPROVED -> EXECUTING)
    session.beginExecution('agent-executor');
    expect(session.status).toBe('EXECUTING');

    // 7. Record Execution Result (EXECUTING -> VERIFYING)
    session.recordExecutionResult(sampleExecutionSuccess, 'agent-executor');
    expect(session.status).toBe('VERIFYING');
    expect(session.executionResult).toBeDefined();

    // 8. Record Verification Result (VERIFYING -> COMPLETED)
    session.recordVerificationResult(sampleVerificationSuccess, 'agent-verifier');
    expect(session.status).toBe('COMPLETED');
    expect(session.verificationResult?.status).toBe('PASSED');

    // Verify snapshot reflects all milestones (1 initial creation + 8 state transitions)
    const snapshot = session.toSnapshot();
    expect(snapshot.status).toBe('COMPLETED');
    expect(snapshot.history.length).toBe(9);
  });

  it('enforces invariant: Approval cannot be requested before analysis/sandbox completion', () => {
    const session = MigrationSessionEntity.create(validDto);

    // In DRAFT state, attempting to request approval throws IllegalActionError
    expect(() => session.requestApproval(sampleApprovalRequest)).toThrow(IllegalActionError);

    session.beginAnalysis();
    expect(() => session.requestApproval(sampleApprovalRequest)).toThrow(IllegalActionError);
  });

  it('enforces invariant: Execution cannot begin before approval is granted', () => {
    const session = MigrationSessionEntity.create(validDto);
    session.beginAnalysis();
    session.recordAnalysisResult(sampleAnalysis, sampleRisk);
    session.beginSandboxRehearsal();
    session.recordSandboxResult(sampleSandboxSuccess);

    // In AWAITING_APPROVAL state without approval decision
    expect(session.status).toBe('AWAITING_APPROVAL');
    expect(() => session.beginExecution()).toThrow(IllegalActionError);
  });

  it('enforces invariant: Rejected approval cannot proceed to execution', () => {
    const session = MigrationSessionEntity.create(validDto);
    session.beginAnalysis();
    session.recordAnalysisResult(sampleAnalysis, sampleRisk);
    session.beginSandboxRehearsal();
    session.recordSandboxResult(sampleSandboxSuccess);

    const rejectDecision: ApprovalDecision = {
      decisionId: 'dec-reject',
      approvalRequestId: 'app-req-1',
      status: 'REJECTED',
      approver: 'security.lead@company.com',
      decidedAt: new Date().toISOString(),
      rejectionReason: 'Table locked during billing cycle. Rejected.',
    };

    session.recordApprovalDecision(rejectDecision);
    expect(session.status).toBe('REJECTED');

    // Cannot begin execution from REJECTED state
    expect(() => session.beginExecution()).toThrow(IllegalActionError);
  });

  it('enforces invariant: Verification cannot begin before successful execution', () => {
    const session = MigrationSessionEntity.create(validDto);
    session.beginAnalysis();
    session.recordAnalysisResult(sampleAnalysis, sampleRisk);
    session.beginSandboxRehearsal();
    session.recordSandboxResult(sampleSandboxSuccess);
    session.recordApprovalDecision(sampleApprovalDecision);

    // Currently APPROVED, execution has not started
    expect(() => session.beginVerification()).toThrow(IllegalActionError);
  });

  it('handles sandbox failure branch correctly', () => {
    const session = MigrationSessionEntity.create(validDto);
    session.beginAnalysis();
    session.recordAnalysisResult(sampleAnalysis, sampleRisk);
    session.beginSandboxRehearsal();

    const failedSandbox: SandboxRehearsalResult = {
      rehearsalId: 'reh-fail',
      status: 'FAILED',
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      durationMs: 120,
      simulatedLockAcquisitionMs: 5000,
      rowsAffected: 0,
      statementsExecuted: 0,
      rollbackVerified: false,
      logs: ['Lock timeout exceeded in sandbox container.'],
      errorMessage: 'Statement cancelled due to lock_timeout.',
    };

    session.recordSandboxResult(failedSandbox);
    expect(session.status).toBe('SANDBOX_FAILED');
    expect(session.lastErrorMessage).toContain('Statement cancelled due to lock_timeout');

    // Cannot request approval from SANDBOX_FAILED
    expect(() => session.requestApproval(sampleApprovalRequest)).toThrow(IllegalActionError);
  });

  it('enforces invariant: COMPLETED is terminal and rejects any further transitions', () => {
    const session = MigrationSessionEntity.create(validDto);
    session.beginAnalysis();
    session.recordAnalysisResult(sampleAnalysis, sampleRisk);
    session.beginSandboxRehearsal();
    session.recordSandboxResult(sampleSandboxSuccess);
    session.recordApprovalDecision(sampleApprovalDecision);
    session.beginExecution();
    session.recordExecutionResult(sampleExecutionSuccess);
    session.recordVerificationResult(sampleVerificationSuccess);

    expect(session.status).toBe('COMPLETED');
    expect(() => session.beginAnalysis()).toThrow(InvalidStateTransitionError);
    expect(() => session.beginExecution()).toThrow(IllegalActionError);
  });

  it('transitions to ANALYSIS_FAILED when analysis result contains blocking issues', () => {
    const session = MigrationSessionEntity.create(validDto);
    session.beginAnalysis();

    const blockedAnalysis: MigrationAnalysisResult = {
      analysisId: 'analysis-blocked',
      analyzedAt: new Date().toISOString(),
      summary: 'Analysis blocked due to unsupported syntax',
      findings: [],
      isSafeForSandbox: false,
      blockers: ['Unsupported syntax in statement #1'],
    };

    session.recordAnalysisResult(blockedAnalysis, sampleRisk);
    expect(session.status).toBe('ANALYSIS_FAILED');
    expect(session.lastErrorMessage).toContain('Unsupported syntax');
    expect(session.analysisResult).toBeDefined();
    expect(session.riskAssessment).toBeDefined();
  });
});
