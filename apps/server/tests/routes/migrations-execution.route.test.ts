import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { InMemoryMigrationSessionRepository } from '../../src/repositories/in-memory-session.repository.js';
import { MigrationSessionService } from '../../src/services/migration-session.service.js';
import { ApprovalService } from '../../src/approval/services/approval.service.js';
import { LiveMigrationExecutionService } from '../../src/execution/services/live-migration-execution.service.js';
import { MigrationSessionEntity } from '../../src/domain/session.entity.js';
import { ApprovalFingerprintGenerator } from '../../src/approval/utils/approval-fingerprint.js';
import { ExecutionLock } from '../../src/execution/utils/execution-lock.js';
import type { PostgresExecutionPort } from '../../src/execution/ports/postgres-execution.port.js';
import type { PostgresInspectionPort } from '../../src/db/ports/postgres-inspection.port.js';

describe('Migrations Controlled Live Execution REST API (POST /api/migrations/:sessionId/execute)', () => {
  let repository: InMemoryMigrationSessionRepository;
  let sessionService: MigrationSessionService;
  let approvalService: ApprovalService;
  let executionService: LiveMigrationExecutionService;
  let mockExecutionPort: PostgresExecutionPort;
  let mockInspectionPort: PostgresInspectionPort;
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    repository = new InMemoryMigrationSessionRepository();
    sessionService = new MigrationSessionService(repository);
    approvalService = new ApprovalService({ sessionRepository: repository });

    mockExecutionPort = {
      verifyTargetConnectivity: vi.fn().mockResolvedValue({ connected: true, latencyMs: 5 }),
      executeApprovedMigration: vi.fn().mockResolvedValue({
        success: true,
        statementsExecuted: 1,
        totalDurationMs: 15,
        statementResults: [
          {
            statementIndex: 0,
            sql: 'ALTER TABLE public.events ADD COLUMN marker integer NOT NULL DEFAULT 0;',
            executionTimeMs: 15,
            status: 'SUCCESS',
          },
        ],
      }),
    };

    let inspectInvocation = 0;
    mockInspectionPort = {
      verifyConnectivity: vi.fn().mockResolvedValue({ connected: true, latencyMs: 5 }),
      inspectTables: vi.fn().mockResolvedValue([
        {
          schemaName: 'public',
          tableName: 'events',
          tableType: 'BASE TABLE',
          estimatedRowCount: 10,
        },
      ]),
      inspectFullTable: vi.fn().mockImplementation(async () => {
        inspectInvocation++;
        if (inspectInvocation % 2 === 1) {
          // Pre-execution snapshot
          return {
            table: {
              schemaName: 'public',
              tableName: 'events',
              tableType: 'BASE TABLE',
              estimatedRowCount: 10,
            },
            columns: [
              {
                columnName: 'id',
                dataType: 'integer',
                isNullable: false,
                isPrimaryKey: true,
                hasDefault: true,
              },
            ],
            primaryKey: { constraintName: 'events_pkey', columns: ['id'] },
            foreignKeys: [],
            indexes: [
              {
                indexName: 'events_pkey',
                tableName: 'events',
                isUnique: true,
                isPrimary: true,
                isValid: true,
                columns: ['id'],
              },
            ],
            constraints: [],
            statistics: { totalRows: 10, deadRows: 0, totalSize: '16 kB' },
          };
        }
        // Post-execution snapshot
        return {
          table: {
            schemaName: 'public',
            tableName: 'events',
            tableType: 'BASE TABLE',
            estimatedRowCount: 10,
          },
          columns: [
            {
              columnName: 'id',
              dataType: 'integer',
              isNullable: false,
              isPrimaryKey: true,
              hasDefault: true,
            },
            {
              columnName: 'marker',
              dataType: 'integer',
              isNullable: false,
              isPrimaryKey: false,
              hasDefault: true,
            },
          ],
          primaryKey: { constraintName: 'events_pkey', columns: ['id'] },
          foreignKeys: [],
          indexes: [
            {
              indexName: 'events_pkey',
              tableName: 'events',
              isUnique: true,
              isPrimary: true,
              isValid: true,
              columns: ['id'],
            },
          ],
          constraints: [],
          statistics: { totalRows: 10, deadRows: 0, totalSize: '16 kB' },
        };
      }),
      inspectColumns: vi.fn().mockResolvedValue([]),
      inspectIndexes: vi.fn().mockResolvedValue([]),
      inspectConstraints: vi.fn().mockResolvedValue([]),
      inspectForeignKeys: vi.fn().mockResolvedValue([]),
      inspectPrimaryKeys: vi.fn().mockResolvedValue([]),
      inspectSchemas: vi.fn().mockResolvedValue(['public']),
      getServerMetadata: vi.fn().mockResolvedValue({
        serverVersion: 'PostgreSQL 16.0',
        versionNum: 160000,
        encoding: 'UTF8',
        isSuperuser: false,
        maxConnections: 100,
      }),
      getActiveQueries: vi.fn().mockResolvedValue([]),
      getLockInformation: vi.fn().mockResolvedValue([]),
      getTableStatistics: vi.fn().mockResolvedValue(null),
    };

    executionService = new LiveMigrationExecutionService({
      sessionRepository: repository,
      executionPort: mockExecutionPort,
      inspectionPort: mockInspectionPort,
    });

    app = createApp({
      sessionRepository: repository,
      sessionService,
      approvalService,
      executionService,
    });
  });

  /**
   * Helper to set up an APPROVED session with valid cryptographic fingerprint and rehearsal evidence.
   */
  async function createApprovedSession(
    sql = 'ALTER TABLE public.events ADD COLUMN marker integer NOT NULL DEFAULT 0;'
  ) {
    const session = MigrationSessionEntity.create({
      proposedMigration: {
        migrationId: `mig_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        name: 'test_execution_migration',
        rawSql: sql,
      },
      targetDatabase: {
        engine: 'postgresql',
        version: 'PostgreSQL 16',
        databaseName: 'schemasentry_test',
        schemaName: 'public',
        isProductionLike: false,
        connectionString: 'postgresql://postgres:secret_pass@localhost:5432/schemasentry_test',
      },
    });

    session.beginAnalysis('TestRunner');
    session.recordAnalysisResult(
      {
        migrationId: session.request.proposedMigration.migrationId,
        isSafeForSandbox: true,
        statementAnalyses: [],
        findings: [],
        blockers: [],
        recommendations: [],
        summary: 'Safe for execution',
      },
      {
        migrationId: session.request.proposedMigration.migrationId,
        overallRiskLevel: 'LOW',
        summary: 'Low risk',
        lockRiskSummary: 'AccessShareLock only',
        dataLossRiskSummary: 'Zero data loss',
        categoryAssessments: {
          lockRisk: { score: 1, level: 'LOW', reasons: ['AccessShareLock only'] },
          dataLoss: { score: 0, level: 'LOW', reasons: [] },
          availability: { score: 1, level: 'LOW', reasons: [] },
          performance: { score: 1, level: 'LOW', reasons: [] },
          rollback: { score: 1, level: 'LOW', reasons: [] },
        },
      },
      'TestRunner'
    );

    const rehearsalId = `reh_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    session.beginSandboxRehearsal('TestRunner');
    session.recordSandboxResult(
      {
        rehearsalId,
        status: 'SUCCESS',
        statementsExecuted: 1,
        rowsAffected: 0,
        durationMs: 45,
        rollbackVerified: true,
        schemaDifferences: {
          hasChanges: true,
          tables: { added: [], removed: [], modified: [] },
          columns: {
            added: [
              { tableName: 'events', columnName: 'marker', dataType: 'integer', isNullable: false },
            ],
            removed: [],
            modified: [],
          },
          indexes: { added: [], removed: [] },
          constraints: { added: [], removed: [] },
          summary: ['Added column public.events.marker'],
        },
      },
      {
        rehearsalId,
        sessionId: session.id,
        sandboxId: 'sb_test',
        executionId: 'exec_test',
        status: 'SUCCESS',
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        durationMs: 45,
        exitCode: 0,
        statementsAttempted: 1,
        statementsSucceeded: 1,
        statementsFailed: 0,
        statementResults: [],
        preMigrationInspection: [],
        postMigrationInspection: [],
        rollbackStatus: 'DISCARDED',
        stdout: 'ALTER TABLE completed',
        stderr: '',
        schemaDifferences: {
          hasChanges: true,
          tables: { added: [], removed: [], modified: [] },
          columns: {
            added: [
              { tableName: 'events', columnName: 'marker', dataType: 'integer', isNullable: false },
            ],
            removed: [],
            modified: [],
          },
          indexes: { added: [], removed: [] },
          constraints: { added: [], removed: [] },
          summary: ['Added column public.events.marker'],
        },
        affectedTables: ['events'],
        cleanupStatus: 'COMPLETED',
        targetUntouched: true,
      }
    );

    // Compute expected fingerprint
    const fp = ApprovalFingerprintGenerator.compute(session);

    session.requestApproval({
      approvalRequestId: `appr_req_${session.id}`,
      sessionId: session.id,
      migrationId: session.request.proposedMigration.migrationId,
      rehearsalId,
      requestedAt: new Date().toISOString(),
      reasonsRequired: ['SCHEMA_MODIFICATION'],
      proposedActionSummary: 'Add marker column',
      highestRiskLevel: 'LOW',
      riskSummary: 'Safe migration',
      evidenceSummary: 'Rehearsal succeeded in sandbox',
      rollbackPlanSummary: 'Drop column on rollback',
      fingerprint: fp.fingerprintHash,
    });

    session.recordApprovalDecision({
      decisionId: `appr_dec_${session.id}`,
      approvalRequestId: `appr_req_${session.id}`,
      sessionId: session.id,
      migrationId: session.request.proposedMigration.migrationId,
      rehearsalId,
      status: 'APPROVED',
      approver: 'LeadDBA',
      decidedAt: new Date().toISOString(),
      fingerprint: fp.fingerprintHash,
      comment: 'Approved for production',
    });

    await repository.save(session);
    return { session, rehearsalId, fingerprint: fp.fingerprintHash };
  }

  // =========================================================================
  // PRE-EXECUTION SAFETY GATES & BYPASS TESTS (16 scenarios)
  // =========================================================================
  describe('Pre-Execution Safety Gates & Rejection Tests', () => {
    it('1. rejects execution when session is in DRAFT status', async () => {
      const session = MigrationSessionEntity.create({
        proposedMigration: { migrationId: 'm1', name: 'draft', rawSql: 'SELECT 1;' },
        targetDatabase: {
          engine: 'postgresql',
          version: '16',
          databaseName: 'db',
          schemaName: 'public',
          isProductionLike: false,
        },
      });
      await repository.save(session);

      const res = await request(app).post(`/api/migrations/${session.id}/execute`).send({});
      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('ILLEGAL_STATE_TRANSITION');
      expect(res.body.error.message).toContain('DRAFT');
    });

    it('2. rejects execution when session is in SANDBOX_READY status', async () => {
      const session = MigrationSessionEntity.create({
        proposedMigration: { migrationId: 'm1', name: 'ready', rawSql: 'SELECT 1;' },
        targetDatabase: {
          engine: 'postgresql',
          version: '16',
          databaseName: 'db',
          schemaName: 'public',
          isProductionLike: false,
        },
      });
      session.beginAnalysis('Actor');
      session.recordAnalysisResult(
        {
          migrationId: 'm1',
          isSafeForSandbox: true,
          statementAnalyses: [],
          findings: [],
          blockers: [],
          recommendations: [],
          summary: 'ok',
        },
        {
          migrationId: 'm1',
          overallRiskLevel: 'LOW',
          summary: 'ok',
          lockRiskSummary: 'none',
          dataLossRiskSummary: 'none',
          categoryAssessments: {
            lockRisk: { score: 1, level: 'LOW', reasons: [] },
            dataLoss: { score: 0, level: 'LOW', reasons: [] },
            availability: { score: 1, level: 'LOW', reasons: [] },
            performance: { score: 1, level: 'LOW', reasons: [] },
            rollback: { score: 1, level: 'LOW', reasons: [] },
          },
        },
        'Actor'
      );
      await repository.save(session);

      const res = await request(app).post(`/api/migrations/${session.id}/execute`).send({});
      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('ILLEGAL_STATE_TRANSITION');
      expect(res.body.error.message).toContain('SANDBOX_READY');
    });

    it('3. rejects execution when session is in SANDBOX_REHEARSAL_COMPLETED status (pre-approval)', async () => {
      const { session } = await createApprovedSession();
      // Revert to SANDBOX_REHEARSAL_COMPLETED
      const rehearsedSession = await repository.findById(session.id);
      expect(rehearsedSession).toBeDefined();

      const freshSession = MigrationSessionEntity.create({
        proposedMigration: { migrationId: 'm2', name: 'reh', rawSql: 'SELECT 1;' },
        targetDatabase: {
          engine: 'postgresql',
          version: '16',
          databaseName: 'db',
          schemaName: 'public',
          isProductionLike: false,
        },
      });
      freshSession.beginAnalysis('Actor');
      freshSession.recordAnalysisResult(
        {
          migrationId: 'm2',
          isSafeForSandbox: true,
          statementAnalyses: [],
          findings: [],
          blockers: [],
          recommendations: [],
          summary: 'ok',
        },
        {
          migrationId: 'm2',
          overallRiskLevel: 'LOW',
          summary: 'ok',
          lockRiskSummary: 'none',
          dataLossRiskSummary: 'none',
          categoryAssessments: {
            lockRisk: { score: 1, level: 'LOW', reasons: [] },
            dataLoss: { score: 0, level: 'LOW', reasons: [] },
            availability: { score: 1, level: 'LOW', reasons: [] },
            performance: { score: 1, level: 'LOW', reasons: [] },
            rollback: { score: 1, level: 'LOW', reasons: [] },
          },
        },
        'Actor'
      );
      freshSession.beginSandboxRehearsal('Actor');
      freshSession.recordSandboxResult({
        rehearsalId: 'r1',
        status: 'SUCCESS',
        statementsExecuted: 1,
        rowsAffected: 0,
        durationMs: 10,
        rollbackVerified: true,
      });
      await repository.save(freshSession);

      const res = await request(app).post(`/api/migrations/${freshSession.id}/execute`).send({});
      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('ILLEGAL_STATE_TRANSITION');
      expect(res.body.error.message).toContain('SANDBOX_REHEARSAL_COMPLETED');
    });

    it('4. rejects execution when session is in AWAITING_APPROVAL status', async () => {
      const { session } = await createApprovedSession();
      const fresh = await repository.findById(session.id);
      fresh?.invalidateApproval('Testing awaiting state');
      if (fresh) await repository.save(fresh);

      const res = await request(app).post(`/api/migrations/${session.id}/execute`).send({});
      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('ILLEGAL_STATE_TRANSITION');
      expect(res.body.error.message).toContain('AWAITING_APPROVAL');
    });

    it('5. rejects execution when session is in REJECTED status', async () => {
      const { session } = await createApprovedSession();
      const fresh = await repository.findById(session.id);
      if (fresh) {
        fresh.invalidateApproval('Reject test');
        fresh.recordApprovalDecision({
          decisionId: 'dec_rej',
          approvalRequestId: fresh.approvalRequest?.approvalRequestId || 'req',
          sessionId: fresh.id,
          migrationId: fresh.request.proposedMigration.migrationId,
          rehearsalId: fresh.sandboxResult?.rehearsalId || 'reh',
          status: 'REJECTED',
          approver: 'LeadDBA',
          decidedAt: new Date().toISOString(),
          fingerprint: 'fp',
          rejectionReason: 'Risk too high',
        });
        await repository.save(fresh);
      }

      const res = await request(app).post(`/api/migrations/${session.id}/execute`).send({});
      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('ILLEGAL_STATE_TRANSITION');
      expect(res.body.error.message).toContain('REJECTED');
    });

    it('6. rejects execution when approval decision is missing on APPROVED status', async () => {
      const { session } = await createApprovedSession();
      const rawSession = await repository.findById(session.id);
      if (rawSession) {
        // Tamper entity to have undefined decision
        (rawSession as unknown as { _approvalDecision?: unknown })._approvalDecision = undefined;
        await repository.save(rawSession);
      }

      const res = await request(app).post(`/api/migrations/${session.id}/execute`).send({});
      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('ILLEGAL_STATE_TRANSITION');
      expect(res.body.error.message).toContain('No APPROVED decision recorded');
    });

    it('7. rejects execution when cryptographic fingerprint has drifted after approval', async () => {
      const { session } = await createApprovedSession();
      const rawSession = await repository.findById(session.id);
      if (rawSession) {
        // Tamper rawSql to cause a fingerprint mismatch
        rawSession.request.proposedMigration.rawSql =
          'ALTER TABLE public.events ADD COLUMN altered integer;';
        await repository.save(rawSession);
      }

      const res = await request(app).post(`/api/migrations/${session.id}/execute`).send({});
      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('ILLEGAL_STATE_TRANSITION');
      expect(res.body.error.message).toContain('fingerprint mismatch');

      // Verify approval was invalidated
      const invalidated = await repository.findById(session.id);
      expect(invalidated?.status).toBe('AWAITING_APPROVAL');
    });

    it('8. rejects execution when approval rehearsal ID does not match session rehearsal ID', async () => {
      const { session } = await createApprovedSession();
      const rawSession = await repository.findById(session.id);
      if (rawSession && rawSession.approvalDecision) {
        (rawSession.approvalDecision as { rehearsalId: string }).rehearsalId = 'reh_mismatched_id';
        await repository.save(rawSession);
      }

      const res = await request(app).post(`/api/migrations/${session.id}/execute`).send({});
      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('ILLEGAL_STATE_TRANSITION');
      expect(res.body.error.message).toContain(
        'Rehearsal run does not match approved rehearsal ID'
      );
    });

    it('9. rejects execution when migration SQL is empty or comments only', async () => {
      const { session } = await createApprovedSession('-- Just a comment\n');
      const res = await request(app).post(`/api/migrations/${session.id}/execute`).send({});
      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('ILLEGAL_STATE_TRANSITION');
      expect(res.body.error.message).toContain('No executable SQL statements found');
    });

    it('10. rejects execution when migration contains unsupported DML (INSERT/UPDATE/DELETE)', async () => {
      const { session } = await createApprovedSession('INSERT INTO public.events (id) VALUES (1);');
      const res = await request(app).post(`/api/migrations/${session.id}/execute`).send({});
      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('ILLEGAL_STATE_TRANSITION');
      expect(res.body.error.message).toContain('Data manipulation language');
    });

    it('11. rejects execution when target schema identifier is invalid / injection attempt', async () => {
      const { session } = await createApprovedSession();
      const rawSession = await repository.findById(session.id);
      if (rawSession) {
        rawSession.request.targetDatabase.schemaName = 'public; DROP TABLE events;';
        // update fingerprint to avoid fingerprint error first
        const fp = ApprovalFingerprintGenerator.compute(rawSession);
        if (rawSession.approvalDecision) {
          rawSession.approvalDecision.fingerprint = fp.fingerprintHash;
        }
        await repository.save(rawSession);
      }

      const res = await request(app).post(`/api/migrations/${session.id}/execute`).send({});
      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('ILLEGAL_STATE_TRANSITION');
      expect(res.body.error.message).toContain('Invalid target schema identifier');
    });

    it('12. rejects execution when target database connectivity probe fails', async () => {
      const { session } = await createApprovedSession();
      (
        mockExecutionPort.verifyTargetConnectivity as ReturnType<typeof vi.fn>
      ).mockResolvedValueOnce({
        connected: false,
        latencyMs: 100,
        error: 'ECONNREFUSED 127.0.0.1:5432',
      });

      const res = await request(app).post(`/api/migrations/${session.id}/execute`).send({});
      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('ILLEGAL_STATE_TRANSITION');
      expect(res.body.error.message).toContain('Target database connectivity probe failed');
    });

    it('13. rejects concurrent execution when execution lock is held on the session', async () => {
      const { session } = await createApprovedSession();
      // Simulate acquired lock
      ExecutionLock.acquire(session.id);

      try {
        const res = await request(app).post(`/api/migrations/${session.id}/execute`).send({});
        expect(res.status).toBe(409);
        expect(res.body.success).toBe(false);
        expect(res.body.error.code).toBe('ILLEGAL_STATE_TRANSITION');
        expect(res.body.error.message).toContain('already in progress');
      } finally {
        ExecutionLock.release(session.id);
      }
    });

    it('14. executes migration successfully, verifies schema parity, and transitions session to COMPLETED', async () => {
      const { session } = await createApprovedSession();

      const res = await request(app)
        .post(`/api/migrations/${session.id}/execute`)
        .send({ actor: 'ReleaseEngineer', timeoutMs: 30000 });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.sessionId).toBe(session.id);
      expect(res.body.data.finalStatus).toBe('COMPLETED');
      expect(res.body.data.statementsSucceeded).toBe(1);
      expect(res.body.data.verificationResult.status).toBe('PASSED');
      expect(res.body.data.verificationResult.checks.length).toBeGreaterThanOrEqual(3);

      // Verify session entity was persisted as COMPLETED
      const finalSession = await repository.findById(session.id);
      expect(finalSession?.status).toBe('COMPLETED');
      expect(finalSession?.executionResult?.status).toBe('SUCCESS');
      expect(finalSession?.verificationResult?.status).toBe('PASSED');
    });

    it('15. transitions to VERIFICATION_FAILED if post-execution verification checks fail', async () => {
      const { session } = await createApprovedSession();

      // Return valid pre-snapshot and invalid index state on post-execution inspection
      (mockInspectionPort.inspectFullTable as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({
          table: {
            schemaName: 'public',
            tableName: 'events',
            tableType: 'BASE TABLE',
            estimatedRowCount: 10,
          },
          columns: [
            {
              columnName: 'id',
              dataType: 'integer',
              isNullable: false,
              isPrimaryKey: true,
              hasDefault: true,
            },
          ],
          primaryKey: { constraintName: 'events_pkey', columns: ['id'] },
          foreignKeys: [],
          indexes: [
            {
              indexName: 'events_pkey',
              tableName: 'events',
              isUnique: true,
              isPrimary: true,
              isValid: true,
              columns: ['id'],
            },
          ],
          constraints: [],
          statistics: { totalRows: 10, deadRows: 0, totalSize: '16 kB' },
        })
        .mockResolvedValueOnce({
          table: {
            schemaName: 'public',
            tableName: 'events',
            tableType: 'BASE TABLE',
            estimatedRowCount: 10,
          },
          columns: [
            {
              columnName: 'id',
              dataType: 'integer',
              isNullable: false,
              isPrimaryKey: true,
              hasDefault: true,
            },
            {
              columnName: 'marker',
              dataType: 'integer',
              isNullable: false,
              isPrimaryKey: false,
              hasDefault: true,
            },
          ],
          primaryKey: { constraintName: 'events_pkey', columns: ['id'] },
          foreignKeys: [],
          indexes: [
            {
              indexName: 'idx_invalid',
              tableName: 'events',
              isUnique: false,
              isPrimary: false,
              isValid: false,
              columns: ['marker'],
            },
          ],
          constraints: [],
          statistics: { totalRows: 10, deadRows: 0, totalSize: '16 kB' },
        });

      const res = await request(app).post(`/api/migrations/${session.id}/execute`).send({});

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.finalStatus).toBe('VERIFICATION_FAILED');
      expect(res.body.data.verificationResult.status).toBe('FAILED');

      const saved = await repository.findById(session.id);
      expect(saved?.status).toBe('VERIFICATION_FAILED');
    });

    it('16. releases execution lock even when execution throws an error', async () => {
      const { session } = await createApprovedSession();
      (
        mockExecutionPort.executeApprovedMigration as ReturnType<typeof vi.fn>
      ).mockRejectedValueOnce(new Error('Fatal driver crash'));

      const res = await request(app).post(`/api/migrations/${session.id}/execute`).send({});
      expect(res.status).toBe(500);

      // Verify lock was released and can be acquired again
      expect(() => ExecutionLock.acquire(session.id)).not.toThrow();
      ExecutionLock.release(session.id);
    });
  });

  // =========================================================================
  // INPUT BOUNDARY & MALFORMED PAYLOAD TESTS
  // =========================================================================
  describe('Input Boundary Validation', () => {
    it('returns 400 when sessionId is whitespace or empty', async () => {
      const res = await request(app).post('/api/migrations/%20/execute').send({});
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 400 when actor is a non-string type', async () => {
      const { session } = await createApprovedSession();
      const res = await request(app)
        .post(`/api/migrations/${session.id}/execute`)
        .send({ actor: 12345 });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.message).toContain('actor');
    });

    it('returns 400 when actor exceeds 100 characters', async () => {
      const { session } = await createApprovedSession();
      const res = await request(app)
        .post(`/api/migrations/${session.id}/execute`)
        .send({ actor: 'a'.repeat(101) });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 400 when timeoutMs is negative or not a number', async () => {
      const { session } = await createApprovedSession();
      const res = await request(app)
        .post(`/api/migrations/${session.id}/execute`)
        .send({ timeoutMs: -100 });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 400 when request payload is an array', async () => {
      const { session } = await createApprovedSession();
      const res = await request(app)
        .post(`/api/migrations/${session.id}/execute`)
        .send([{ actor: 'test' }]);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 404 for unknown session ID', async () => {
      const res = await request(app)
        .post('/api/migrations/00000000-0000-0000-0000-000000000000/execute')
        .send({});

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('SESSION_NOT_FOUND');
    });
  });

  // =========================================================================
  // REPOSITORY COMPOSITION & PERSISTENCE TESTS
  // =========================================================================
  describe('Repository Composition with executionService', () => {
    it('uses repository from executionService when only executionService is injected', async () => {
      const customRepo = new InMemoryMigrationSessionRepository();
      const customExecSvc = new LiveMigrationExecutionService({
        sessionRepository: customRepo,
        executionPort: mockExecutionPort,
        inspectionPort: mockInspectionPort,
      });

      const routerApp = createApp({ executionService: customExecSvc });
      const createRes = await request(routerApp).post('/api/migrations').send({ sql: 'SELECT 1;' });
      expect(createRes.status).toBe(201);

      const found = await customRepo.findById(createRes.body.data.sessionId);
      expect(found).toBeDefined();
    });

    it('persists full execution and verification results for GET retrieval', async () => {
      const { session } = await createApprovedSession();
      const execRes = await request(app).post(`/api/migrations/${session.id}/execute`).send({});
      expect(execRes.status).toBe(200);

      const getRes = await request(app).get(`/api/migrations/${session.id}`);
      expect(getRes.status).toBe(200);
      expect(getRes.body.success).toBe(true);
      expect(getRes.body.data.status).toBe('COMPLETED');
      expect(getRes.body.data.executionResult).toBeDefined();
      expect(getRes.body.data.executionResult.status).toBe('SUCCESS');
      expect(getRes.body.data.verificationResult).toBeDefined();
      expect(getRes.body.data.verificationResult.status).toBe('PASSED');
      expect(getRes.body.data.history.length).toBeGreaterThan(0);
    });
  });
});
