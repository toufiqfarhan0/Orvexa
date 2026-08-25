import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LiveMigrationExecutionService } from '../../src/execution/services/live-migration-execution.service.js';
import { InMemoryMigrationSessionRepository } from '../../src/repositories/in-memory-session.repository.js';
import { MigrationSessionEntity } from '../../src/domain/session.entity.js';
import { ApprovalFingerprintGenerator } from '../../src/approval/utils/approval-fingerprint.js';
import { ExecutionLock } from '../../src/execution/utils/execution-lock.js';
import type { PostgresExecutionPort } from '../../src/execution/ports/postgres-execution.port.js';
import type { PostgresInspectionPort } from '../../src/db/ports/postgres-inspection.port.js';

describe('LiveMigrationExecutionService (Unit Tests & Invariants)', () => {
  let sessionRepo: InMemoryMigrationSessionRepository;
  let mockExecutionPort: PostgresExecutionPort;
  let mockInspectionPort: PostgresInspectionPort;
  let executionService: LiveMigrationExecutionService;

  const createApprovedSession = async (overrides?: {
    migrationId?: string;
    sql?: string;
    databaseName?: string;
    rehearsalId?: string;
  }) => {
    const session = MigrationSessionEntity.create({
      targetDatabase: {
        engine: 'postgresql',
        version: '16.0',
        databaseName: overrides?.databaseName || 'production_core',
        schemaName: 'public',
        isProductionLike: true,
      },
      proposedMigration: {
        migrationId: overrides?.migrationId || 'mig_exec_001',
        name: 'Add verified column',
        rawSql:
          overrides?.sql ||
          'ALTER TABLE users ADD COLUMN is_verified boolean NOT NULL DEFAULT false;',
      },
    });

    session.beginAnalysis('Analyzer');
    session.recordAnalysisResult(
      {
        migrationId: overrides?.migrationId || 'mig_exec_001',
        analyzedAt: new Date().toISOString(),
        isSafeForSandbox: true,
        statementAnalyses: [],
        findings: [],
        blockers: [],
        summary: 'Safe',
      },
      {
        overallRiskLevel: 'LOW',
        overallScore: 5,
        summary: 'Low risk additive change',
        categoryAssessments: {},
        assessedAt: new Date().toISOString(),
      }
    );

    session.beginSandboxRehearsal('RehearsalWorkflow');
    session.recordSandboxResult({
      rehearsalId: overrides?.rehearsalId || 'reh_exec_999',
      status: 'SUCCESS',
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      durationMs: 200,
      simulatedLockAcquisitionMs: 5,
      rowsAffected: 0,
      statementsExecuted: 1,
      rollbackVerified: true,
      logs: ['Sandbox rehearsal completed successfully.'],
    });

    const fingerprint = ApprovalFingerprintGenerator.compute(session);

    session.requestApproval(
      {
        approvalRequestId: 'appr_req_101',
        sessionId: session.id,
        migrationId: session.request.proposedMigration.migrationId,
        rehearsalId: session.sandboxResult!.rehearsalId,
        requestedAt: new Date().toISOString(),
        reasonsRequired: ['Production-like deployment'],
        proposedActionSummary: 'Add is_verified column',
        highestRiskLevel: 'LOW',
        riskSummary: 'Safe additive column',
        evidenceSummary: ['Rehearsal succeeded in 200ms'],
        rollbackPlanSummary: 'Rollback verified',
        fingerprint: fingerprint.fingerprintHash,
      },
      'DevUser'
    );

    session.recordApprovalDecision({
      decisionId: 'appr_dec_101',
      approvalRequestId: 'appr_req_101',
      sessionId: session.id,
      migrationId: session.request.proposedMigration.migrationId,
      rehearsalId: session.sandboxResult!.rehearsalId,
      status: 'APPROVED',
      approver: 'LeadDBA',
      decidedAt: new Date().toISOString(),
      fingerprint: fingerprint.fingerprintHash,
      comment: 'Approved for deployment',
    });

    await sessionRepo.save(session);
    return session;
  };

  beforeEach(() => {
    ExecutionLock.reset();
    sessionRepo = new InMemoryMigrationSessionRepository();

    mockExecutionPort = {
      verifyTargetConnectivity: vi.fn().mockResolvedValue({ connected: true, latencyMs: 15 }),
      executeApprovedMigration: vi.fn().mockResolvedValue({
        success: true,
        statementsExecuted: 1,
        statementsFailed: 0,
        totalDurationMs: 45,
        statementResults: [
          {
            statementIndex: 0,
            sql: 'ALTER TABLE users ADD COLUMN is_verified boolean NOT NULL DEFAULT false;',
            executionTimeMs: 45,
            status: 'SUCCESS',
          },
        ],
      }),
    };

    let inspectionCallCount = 0;
    mockInspectionPort = {
      verifyConnectivity: vi.fn().mockResolvedValue(true),
      getServerMetadata: vi.fn().mockResolvedValue({
        version: 'PostgreSQL 16.0',
        majorVersion: 16,
        encoding: 'UTF8',
        maxConnections: 100,
      }),
      inspectSchemas: vi.fn().mockResolvedValue([{ schemaName: 'public' }]),
      inspectTables: vi.fn().mockResolvedValue([
        {
          tableName: 'users',
          tableType: 'BASE TABLE',
          schemaName: 'public',
          rowCountEstimate: 1000,
        },
      ]),
      inspectColumns: vi
        .fn()
        .mockResolvedValue([
          { columnName: 'id', dataType: 'integer', isNullable: false, ordinalPosition: 1 },
        ]),
      inspectConstraints: vi.fn().mockResolvedValue([]),
      inspectIndexes: vi.fn().mockResolvedValue([
        {
          indexName: 'users_pkey',
          tableName: 'users',
          isUnique: true,
          isPrimary: true,
          isValid: true,
        },
      ]),
      getTableStatistics: vi
        .fn()
        .mockResolvedValue({ liveTuples: 1000, deadTuples: 0, totalSizePretty: '64 kB' }),
      getActiveQueries: vi.fn().mockResolvedValue([]),
      getLockInformation: vi.fn().mockResolvedValue([]),
      inspectFullTable: vi.fn().mockImplementation(async () => {
        inspectionCallCount++;
        return {
          table: {
            tableName: 'users',
            tableType: 'BASE TABLE',
            schemaName: 'public',
            rowCountEstimate: 1000,
          },
          columns: [
            { columnName: 'id', dataType: 'integer', isNullable: false, ordinalPosition: 1 },
            ...(inspectionCallCount > 1
              ? [
                  {
                    columnName: 'is_verified',
                    dataType: 'boolean',
                    isNullable: false,
                    ordinalPosition: 2,
                  },
                ]
              : []),
          ],
          constraints: [],
          indexes: [
            {
              indexName: 'users_pkey',
              tableName: 'users',
              isUnique: true,
              isPrimary: true,
              isValid: true,
            },
          ],
          statistics: { liveTuples: 1000, deadTuples: 0, totalSizePretty: '64 kB' },
        };
      }),
    };

    executionService = new LiveMigrationExecutionService({
      sessionRepository: sessionRepo,
      executionPort: mockExecutionPort,
      inspectionPort: mockInspectionPort,
    });
  });

  it('1. Successfully performs pre-execution validation and completes live execution', async () => {
    const session = await createApprovedSession();

    const evidence = await executionService.execute({
      sessionId: session.id,
      actor: 'ReleaseManager',
    });

    expect(evidence).toBeDefined();
    expect(evidence.executionId).toMatch(/^exec_/);
    expect(evidence.finalStatus).toBe('COMPLETED');
    expect(evidence.statementsSucceeded).toBe(1);
    expect(evidence.verificationResult.status).toBe('PASSED');

    const updated = await sessionRepo.findById(session.id);
    expect(updated?.status).toBe('COMPLETED');
  });

  it('2. Rejects execution when session lacks human approval', async () => {
    const session = await createApprovedSession();
    // Simulate session in DRAFT state
    const draft = MigrationSessionEntity.create(session.toSnapshot().request);
    await sessionRepo.save(draft);

    await expect(executionService.execute({ sessionId: draft.id })).rejects.toThrow(
      /Cannot execute migration: Session .* is in 'DRAFT' status/
    );
  });

  it('3. Rejects execution when approval was REJECTED', async () => {
    const session = await createApprovedSession();
    const snap = session.toSnapshot();
    snap.status = 'REJECTED';
    snap.approvalDecision!.status = 'REJECTED';
    const rejectedEntity = MigrationSessionEntity.fromSnapshot(snap);
    await sessionRepo.save(rejectedEntity);

    await expect(executionService.execute({ sessionId: session.id })).rejects.toThrow(
      /Cannot execute migration: Session .* is in 'REJECTED' status/
    );
  });

  it('4. Rejects execution when cryptographic fingerprint does not match approval decision', async () => {
    const session = await createApprovedSession();
    const snap = session.toSnapshot();
    snap.approvalDecision!.fingerprint =
      'tampered_hash_00000000000000000000000000000000000000000000000000';
    const modified = MigrationSessionEntity.fromSnapshot(snap);
    await sessionRepo.save(modified);

    await expect(executionService.execute({ sessionId: session.id })).rejects.toThrow(
      /Cryptographic fingerprint mismatch/
    );
  });

  it('5. Invalidation triggered when migration SQL is modified after approval', async () => {
    const session = await createApprovedSession();
    const snap = session.toSnapshot();
    snap.request.proposedMigration.rawSql = 'ALTER TABLE users DROP COLUMN email;';
    const modified = MigrationSessionEntity.fromSnapshot(snap);
    await sessionRepo.save(modified);

    await expect(executionService.execute({ sessionId: session.id })).rejects.toThrow(
      /Cryptographic fingerprint mismatch/
    );

    const refreshed = await sessionRepo.findById(session.id);
    expect(refreshed?.status).toBe('AWAITING_APPROVAL');
  });

  it('6. Rejects execution when target database identity has changed', async () => {
    const session = await createApprovedSession();
    const snap = session.toSnapshot();
    snap.request.targetDatabase.databaseName = 'rogue_target_db';
    const modified = MigrationSessionEntity.fromSnapshot(snap);
    await sessionRepo.save(modified);

    await expect(executionService.execute({ sessionId: session.id })).rejects.toThrow(
      /Cryptographic fingerprint mismatch/
    );
  });

  it('7. Rejects execution when rehearsal identity has changed', async () => {
    const session = await createApprovedSession();
    const snap = session.toSnapshot();
    snap.sandboxResult!.rehearsalId = 'reh_different_id_999';
    const modified = MigrationSessionEntity.fromSnapshot(snap);
    await sessionRepo.save(modified);

    await expect(executionService.execute({ sessionId: session.id })).rejects.toThrow(
      /Rehearsal run does not match approved rehearsal ID/
    );
  });

  it('8. Rejects execution when target database connectivity check fails', async () => {
    const session = await createApprovedSession();
    mockExecutionPort.verifyTargetConnectivity = vi.fn().mockResolvedValue({
      connected: false,
      latencyMs: 0,
      error: 'Connection timeout to target host:5432',
    });

    await expect(executionService.execute({ sessionId: session.id })).rejects.toThrow(
      /Target database connectivity probe failed/
    );
  });

  it('9. Rejects duplicate concurrent execution request via ExecutionLock', async () => {
    const session = await createApprovedSession();
    ExecutionLock.acquire(session.id);

    await expect(executionService.execute({ sessionId: session.id })).rejects.toThrow(
      /Execution is already in progress/
    );
  });

  it('10. Executes live migration and populates all execution details', async () => {
    const session = await createApprovedSession();

    const evidence = await executionService.execute({
      sessionId: session.id,
      actor: 'DBA_Sarah',
    });

    expect(evidence.statementsAttempted).toBe(1);
    expect(evidence.statementsSucceeded).toBe(1);
    expect(evidence.preExecutionSnapshot).toBeDefined();
    expect(evidence.postExecutionSnapshot).toBeDefined();
    expect(evidence.schemaDiff).toBeDefined();
  });

  it('11. Gracefully handles PostgreSQL execution failure and transitions to EXECUTION_FAILED', async () => {
    const session = await createApprovedSession();
    mockExecutionPort.executeApprovedMigration = vi.fn().mockResolvedValue({
      success: false,
      statementsExecuted: 0,
      statementsFailed: 1,
      totalDurationMs: 25,
      errorMessage: 'column "is_verified" already exists',
      errorCode: '42701',
      statementResults: [
        {
          statementIndex: 0,
          sql: 'ALTER TABLE users ADD COLUMN is_verified boolean NOT NULL DEFAULT false;',
          executionTimeMs: 25,
          status: 'FAILED',
          errorMessage: 'column "is_verified" already exists',
          errorCode: '42701',
        },
      ],
    });

    const evidence = await executionService.execute({ sessionId: session.id });

    expect(evidence.finalStatus).toBe('EXECUTION_FAILED');
    expect(evidence.errorCode).toBe('42701');

    const updated = await sessionRepo.findById(session.id);
    expect(updated?.status).toBe('EXECUTION_FAILED');
  });

  it('12. Respects custom timeoutMs option', async () => {
    const session = await createApprovedSession();

    await executionService.execute({
      sessionId: session.id,
      timeoutMs: 45000,
    });

    expect(mockExecutionPort.executeApprovedMigration).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ timeoutMs: 45000 })
    );
  });

  it('13. Transitions to VERIFICATION_FAILED when verification probe detects invalid index', async () => {
    const session = await createApprovedSession();
    let callCount = 0;
    mockInspectionPort.inspectFullTable = vi.fn().mockImplementation(async () => {
      callCount++;
      return {
        table: {
          tableName: 'users',
          tableType: 'BASE TABLE',
          schemaName: 'public',
          rowCountEstimate: 1000,
        },
        columns: [{ columnName: 'id', dataType: 'integer', isNullable: false, ordinalPosition: 1 }],
        constraints: [],
        indexes: [
          {
            indexName: 'idx_invalid_status',
            tableName: 'users',
            isUnique: false,
            isPrimary: false,
            isValid: callCount <= 1, // Invalid in post-execution snapshot
          },
        ],
        statistics: { liveTuples: 1000, deadTuples: 0, totalSizePretty: '64 kB' },
      };
    });

    const evidence = await executionService.execute({ sessionId: session.id });

    expect(evidence.finalStatus).toBe('VERIFICATION_FAILED');
    expect(evidence.verificationResult.status).toBe('FAILED');

    const updated = await sessionRepo.findById(session.id);
    expect(updated?.status).toBe('VERIFICATION_FAILED');
  });

  it('14. Completes post-execution verification checks (parity, pool health, index validity)', async () => {
    const session = await createApprovedSession();

    const evidence = await executionService.execute({ sessionId: session.id });
    expect(evidence.verificationResult.checks.length).toBe(3);
    expect(evidence.verificationResult.checks.map((c) => c.category)).toContain('SCHEMA_PARITY');
    expect(evidence.verificationResult.checks.map((c) => c.category)).toContain('CONNECTION_POOL');
    expect(evidence.verificationResult.checks.map((c) => c.category)).toContain('INDEX_VALIDITY');
  });

  it('15. Preserves immutable audit trail throughout execution lifecycle', async () => {
    const session = await createApprovedSession();

    await executionService.execute({
      sessionId: session.id,
      actor: 'AuditedEngineer',
    });

    const saved = await sessionRepo.findById(session.id);
    const history = saved?.history || [];

    const executingStep = history.find((h) => h.toStatus === 'EXECUTING');
    expect(executingStep).toBeDefined();
    expect(executingStep?.actor).toBe('AuditedEngineer');

    const verifyingStep = history.find((h) => h.toStatus === 'VERIFYING');
    expect(verifyingStep).toBeDefined();

    const completedStep = history.find((h) => h.toStatus === 'COMPLETED');
    expect(completedStep).toBeDefined();
  });

  it('16. Sanitizes credentials and prevents credential leakage in execution evidence', async () => {
    const session = await createApprovedSession();
    session.request.targetDatabase.connectionString =
      'postgresql://admin:super_secret_pw@192.168.1.50:5432/prod';
    await sessionRepo.save(session);

    const evidence = await executionService.execute({ sessionId: session.id });

    const jsonEvidence = JSON.stringify(evidence);
    expect(jsonEvidence).not.toContain('super_secret_pw');
  });

  it('17. Executes exact approved SQL without mutation or whitespace distortion', async () => {
    const targetSql = "ALTER TABLE users ADD COLUMN custom_code text NOT NULL DEFAULT 'ALPHA_01';";
    const session = await createApprovedSession({ sql: targetSql });

    await executionService.execute({ sessionId: session.id });

    expect(mockExecutionPort.executeApprovedMigration).toHaveBeenCalledWith(
      expect.anything(),
      ["ALTER TABLE users ADD COLUMN custom_code text NOT NULL DEFAULT 'ALPHA_01'"],
      expect.anything()
    );
  });

  it('18. Validates exact state machine transitions across happy path lifecycle', async () => {
    const session = await createApprovedSession();
    expect(session.status).toBe('APPROVED');

    await executionService.execute({ sessionId: session.id });

    const finalSession = await sessionRepo.findById(session.id);
    expect(finalSession?.status).toBe('COMPLETED');
    expect(finalSession?.executionResult?.status).toBe('SUCCESS');
    expect(finalSession?.verificationResult?.status).toBe('PASSED');
  });

  it('19. Rejects execution when approvalDecision object is missing', async () => {
    const session = await createApprovedSession();
    const snap = session.toSnapshot();
    delete (snap as { approvalDecision?: unknown }).approvalDecision;
    const modified = MigrationSessionEntity.fromSnapshot(snap);
    await sessionRepo.save(modified);

    await expect(executionService.execute({ sessionId: session.id })).rejects.toThrow(
      /No APPROVED decision recorded for session/
    );
  });

  it('20. Rejects execution when approver identity is empty', async () => {
    const session = await createApprovedSession();
    const snap = session.toSnapshot();
    snap.approvalDecision!.approver = '   ';
    const modified = MigrationSessionEntity.fromSnapshot(snap);
    await sessionRepo.save(modified);

    await expect(executionService.execute({ sessionId: session.id })).rejects.toThrow(
      /Approver identity is missing/
    );
  });

  it('21. Rejects execution when SQL contains no executable statements', async () => {
    const session = await createApprovedSession({ sql: '-- just a comment\n' });
    // Update fingerprint to match comment-only SQL
    const snap = session.toSnapshot();
    const hash = ApprovalFingerprintGenerator.compute(session).fingerprintHash;
    snap.approvalDecision!.fingerprint = hash;
    const modified = MigrationSessionEntity.fromSnapshot(snap);
    await sessionRepo.save(modified);

    await expect(executionService.execute({ sessionId: session.id })).rejects.toThrow(
      /No executable SQL statements found/
    );
  });

  it('22. Rejects execution when migration contains DML statements fail-closed before target execution', async () => {
    const session = await createApprovedSession({
      sql: "INSERT INTO users (id, name) VALUES (1, 'test');",
    });

    await expect(executionService.execute({ sessionId: session.id })).rejects.toThrow(
      /Data manipulation language \(DML: INSERT\/UPDATE\/DELETE\/MERGE\) is unsupported/
    );
    expect(mockExecutionPort.executeApprovedMigration).not.toHaveBeenCalled();
    expect(ExecutionLock.isLocked(session.id)).toBe(false);
  });

  it('23. Rejects execution when target database schema name is an invalid identifier', async () => {
    const session = await createApprovedSession();
    const snap = session.toSnapshot();
    snap.request.targetDatabase.schemaName = 'public; DROP TABLE users; --';
    const hash = ApprovalFingerprintGenerator.compute(
      MigrationSessionEntity.fromSnapshot(snap)
    ).fingerprintHash;
    snap.approvalDecision!.fingerprint = hash;
    const modified = MigrationSessionEntity.fromSnapshot(snap);
    await sessionRepo.save(modified);

    await expect(executionService.execute({ sessionId: session.id })).rejects.toThrow(
      /Invalid target schema identifier/
    );
    expect(mockExecutionPort.executeApprovedMigration).not.toHaveBeenCalled();
    expect(ExecutionLock.isLocked(session.id)).toBe(false);
  });

  it('24. Releases execution lock when statement execution fails', async () => {
    const session = await createApprovedSession();
    mockExecutionPort.executeApprovedMigration = vi.fn().mockResolvedValue({
      success: false,
      statementsExecuted: 0,
      statementsFailed: 1,
      totalDurationMs: 10,
      errorCode: '42P01',
      errorMessage: 'relation "users" does not exist',
      statementResults: [
        {
          statementIndex: 0,
          sql: 'ALTER TABLE users ADD COLUMN age int;',
          executionTimeMs: 10,
          status: 'FAILED',
          errorCode: '42P01',
          errorMessage: 'relation "users" does not exist',
        },
      ],
    });

    const evidence = await executionService.execute({ sessionId: session.id });
    expect(evidence.finalStatus).toBe('EXECUTION_FAILED');
    expect(ExecutionLock.isLocked(session.id)).toBe(false);
  });

  it('25. Releases execution lock when verification probes fail', async () => {
    const session = await createApprovedSession();
    mockExecutionPort.verifyTargetConnectivity = vi
      .fn()
      .mockResolvedValueOnce({ connected: true, latencyMs: 10 }) // pre-execution probe passes
      .mockResolvedValueOnce({ connected: false, latencyMs: 0, error: 'Target connection lost' }); // post-execution probe fails

    const evidence = await executionService.execute({ sessionId: session.id });
    expect(evidence.finalStatus).toBe('VERIFICATION_FAILED');
    expect(ExecutionLock.isLocked(session.id)).toBe(false);
  });
});
