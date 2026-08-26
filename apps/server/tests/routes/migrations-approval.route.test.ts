import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { InMemoryMigrationSessionRepository } from '../../src/repositories/in-memory-session.repository.js';
import { MigrationSessionService } from '../../src/services/migration-session.service.js';
import { ApprovalService } from '../../src/approval/services/approval.service.js';
import { MigrationSessionEntity } from '../../src/domain/session.entity.js';

describe('Migrations Human Approval REST API', () => {
  let repository: InMemoryMigrationSessionRepository;
  let sessionService: MigrationSessionService;
  let approvalService: ApprovalService;
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    repository = new InMemoryMigrationSessionRepository();
    sessionService = new MigrationSessionService(repository);
    approvalService = new ApprovalService({ sessionRepository: repository });

    app = createApp({
      sessionRepository: repository,
      sessionService,
      approvalService,
    });
  });

  /**
   * Helper to set up a session ready for approval (status: SANDBOX_REHEARSAL_COMPLETED)
   */
  async function createRehearsedSession(
    sql = 'ALTER TABLE public.events ADD COLUMN marker integer NOT NULL DEFAULT 0;'
  ) {
    const session = MigrationSessionEntity.create({
      proposedMigration: {
        migrationId: `mig_${Date.now()}`,
        name: 'test_approval_migration',
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
        summary: 'Low risk migration',
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

    session.beginSandboxRehearsal('TestRunner');
    session.recordSandboxResult(
      {
        rehearsalId: `reh_${Date.now()}_test`,
        status: 'SUCCESS',
        statementsExecuted: 1,
        rowsAffected: 0,
        durationMs: 42,
        rollbackVerified: true,
        schemaDifferences: {
          hasChanges: true,
          tables: { added: [], removed: [], modified: [] },
          columns: {
            added: [
              {
                tableName: 'events',
                columnName: 'marker',
                dataType: 'integer',
                isNullable: false,
              },
            ],
            removed: [],
            modified: [],
          },
          indexes: { added: [], removed: [], modified: [] },
          constraints: { added: [], removed: [], modified: [] },
          primaryKeys: { added: [], removed: [], modified: [] },
          foreignKeys: { added: [], removed: [], modified: [] },
        },
      },
      'TestRunner'
    );

    await repository.save(session);
    return session;
  }

  // ===========================================================================
  // 1. POST /api/migrations/:sessionId/approval
  // ===========================================================================
  describe('POST /api/migrations/:sessionId/approval (Request Approval)', () => {
    it('successfully creates approval request and transitions session to AWAITING_APPROVAL', async () => {
      const session = await createRehearsedSession();

      const res = await request(app)
        .post(`/api/migrations/${session.id}/approval`)
        .send({ actor: 'LeadDBA', comment: 'Requesting review for Q3 feature release.' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.approvalRequestId).toMatch(/^appr_req_/);
      expect(res.body.data.sessionId).toBe(session.id);
      expect(res.body.data.status).toBe('AWAITING_APPROVAL');
      expect(res.body.data.highestRiskLevel).toBe('LOW');
      expect(res.body.data.fingerprint).toBeDefined();
      expect(typeof res.body.data.fingerprint).toBe('string');
      expect(res.body.data.fingerprint.length).toBe(64); // SHA-256 hex string

      // Verify session snapshot
      expect(res.body.data.session.status).toBe('AWAITING_APPROVAL');
      expect(res.body.data.session.approvalRequest.approvalRequestId).toBe(
        res.body.data.approvalRequestId
      );

      // Verify no secrets leaked
      const bodyStr = JSON.stringify(res.body);
      expect(bodyStr).not.toContain('secret_pass');
      expect(bodyStr).not.toContain('postgresql://postgres:secret_pass');

      // Verify repository state was persisted
      const stored = await sessionService.getSession(session.id);
      expect(stored.status).toBe('AWAITING_APPROVAL');
      expect(stored.approvalRequest?.fingerprint).toBe(res.body.data.fingerprint);
    });

    it('returns 404 for unknown session ID', async () => {
      const res = await request(app)
        .post('/api/migrations/non-existent-session/approval')
        .send({ actor: 'Engineer' });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('SESSION_NOT_FOUND');
    });

    it('returns 409 if session is in DRAFT status (pre-rehearsal)', async () => {
      const session = MigrationSessionEntity.create({
        proposedMigration: {
          migrationId: 'mig_draft',
          name: 'draft_migration',
          rawSql: 'CREATE TABLE t (id int);',
        },
        targetDatabase: {
          engine: 'postgresql',
          version: 'PostgreSQL 16',
          databaseName: 'db',
          schemaName: 'public',
          isProductionLike: false,
        },
      });
      await repository.save(session);

      const res = await request(app)
        .post(`/api/migrations/${session.id}/approval`)
        .send({ actor: 'Engineer' });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('ILLEGAL_STATE_TRANSITION');
      expect(res.body.error.message).toContain('DRAFT');
    });

    it('returns 409 if rehearsal failed', async () => {
      const session = MigrationSessionEntity.create({
        proposedMigration: {
          migrationId: 'mig_failed',
          name: 'failed_migration',
          rawSql: 'INVALID SQL;',
        },
        targetDatabase: {
          engine: 'postgresql',
          version: 'PostgreSQL 16',
          databaseName: 'db',
          schemaName: 'public',
          isProductionLike: false,
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
          summary: 'Analysis complete',
        },
        {
          migrationId: session.request.proposedMigration.migrationId,
          overallRiskLevel: 'LOW',
          summary: 'Low risk',
          lockRiskSummary: '',
          dataLossRiskSummary: '',
          categoryAssessments: {},
        }
      );
      session.beginSandboxRehearsal('TestRunner');
      session.recordSandboxResult({
        rehearsalId: 'reh_fail',
        status: 'FAILED',
        statementsExecuted: 0,
        rowsAffected: 0,
        durationMs: 10,
        rollbackVerified: false,
        errorMessage: 'Syntax error near INVALID',
      });
      await repository.save(session);

      const res = await request(app)
        .post(`/api/migrations/${session.id}/approval`)
        .send({ actor: 'Engineer' });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
    });
  });

  // ===========================================================================
  // 2. POST /api/migrations/:sessionId/approve
  // ===========================================================================
  describe('POST /api/migrations/:sessionId/approve (Approve Migration)', () => {
    it('successfully approves migration and transitions session to APPROVED', async () => {
      const session = await createRehearsedSession();

      // Request approval first
      const approvalRes = await request(app)
        .post(`/api/migrations/${session.id}/approval`)
        .send({ actor: 'LeadDBA', comment: 'Ready for review' });

      const fingerprint = approvalRes.body.data.fingerprint;

      // Submit approval decision
      const approveRes = await request(app).post(`/api/migrations/${session.id}/approve`).send({
        approver: 'LeadDBA',
        comment: 'Approved: verified locks and rehearsal evidence.',
        fingerprint,
      });

      expect(approveRes.status).toBe(200);
      expect(approveRes.body.success).toBe(true);
      expect(approveRes.body.data.decisionId).toMatch(/^appr_dec_/);
      expect(approveRes.body.data.status).toBe('APPROVED');
      expect(approveRes.body.data.approver).toBe('LeadDBA');
      expect(approveRes.body.data.fingerprint).toBe(fingerprint);
      expect(approveRes.body.data.comment).toBe('Approved: verified locks and rehearsal evidence.');
      expect(approveRes.body.data.session.status).toBe('APPROVED');

      // Verify repository status
      const stored = await sessionService.getSession(session.id);
      expect(stored.status).toBe('APPROVED');
      expect(stored.approvalDecision?.status).toBe('APPROVED');
      expect(stored.approvalDecision?.approver).toBe('LeadDBA');

      // Ensure that live execution was NOT started (remains APPROVED)
      expect(stored.status).not.toBe('EXECUTING');
      expect(stored.status).not.toBe('COMPLETED');
    });

    it('rejects approval when approver is empty', async () => {
      const session = await createRehearsedSession();
      await request(app).post(`/api/migrations/${session.id}/approval`).send();

      const res = await request(app)
        .post(`/api/migrations/${session.id}/approve`)
        .send({ approver: '   ' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('rejects approval when session is not in AWAITING_APPROVAL status', async () => {
      const session = await createRehearsedSession();
      // Has not requested approval yet (status: SANDBOX_REHEARSAL_COMPLETED)

      const res = await request(app)
        .post(`/api/migrations/${session.id}/approve`)
        .send({ approver: 'LeadDBA' });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('ILLEGAL_STATE_TRANSITION');
    });

    it('rejects approval when supplied fingerprint does not match session proposal', async () => {
      const session = await createRehearsedSession();
      await request(app).post(`/api/migrations/${session.id}/approval`).send();

      const fakeFingerprint = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

      const res = await request(app).post(`/api/migrations/${session.id}/approve`).send({
        approver: 'LeadDBA',
        fingerprint: fakeFingerprint,
      });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toContain('fingerprint');
    });

    it('rejects duplicate approval on already APPROVED session', async () => {
      const session = await createRehearsedSession();
      const apprReq = await request(app).post(`/api/migrations/${session.id}/approval`).send();
      const fp = apprReq.body.data.fingerprint;

      // First approval
      const first = await request(app)
        .post(`/api/migrations/${session.id}/approve`)
        .send({ approver: 'LeadDBA', fingerprint: fp });
      expect(first.status).toBe(200);

      // Second approval attempt
      const second = await request(app)
        .post(`/api/migrations/${session.id}/approve`)
        .send({ approver: 'SecondApprover', fingerprint: fp });

      expect(second.status).toBe(409);
      expect(second.body.success).toBe(false);
    });
  });

  // ===========================================================================
  // 3. POST /api/migrations/:sessionId/reject
  // ===========================================================================
  describe('POST /api/migrations/:sessionId/reject (Reject Migration)', () => {
    it('successfully rejects migration with required reason and transitions to REJECTED', async () => {
      const session = await createRehearsedSession();
      await request(app).post(`/api/migrations/${session.id}/approval`).send();

      const res = await request(app).post(`/api/migrations/${session.id}/reject`).send({
        approver: 'LeadDBA',
        rejectionReason: 'Column name violates standard schema naming conventions.',
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.decisionId).toMatch(/^appr_dec_/);
      expect(res.body.data.status).toBe('REJECTED');
      expect(res.body.data.approver).toBe('LeadDBA');
      expect(res.body.data.rejectionReason).toBe(
        'Column name violates standard schema naming conventions.'
      );
      expect(res.body.data.session.status).toBe('REJECTED');

      // Verify repository status
      const stored = await sessionService.getSession(session.id);
      expect(stored.status).toBe('REJECTED');
      expect(stored.approvalDecision?.status).toBe('REJECTED');
      expect(stored.approvalDecision?.rejectionReason).toBe(
        'Column name violates standard schema naming conventions.'
      );
    });

    it('rejects rejection when rejection reason is missing or whitespace', async () => {
      const session = await createRehearsedSession();
      await request(app).post(`/api/migrations/${session.id}/approval`).send();

      const res = await request(app).post(`/api/migrations/${session.id}/reject`).send({
        approver: 'LeadDBA',
        rejectionReason: '    ',
      });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.message).toContain('rejectionReason');
    });

    it('rejects rejection when approver is missing', async () => {
      const session = await createRehearsedSession();
      await request(app).post(`/api/migrations/${session.id}/approval`).send();

      const res = await request(app).post(`/api/migrations/${session.id}/reject`).send({
        approver: '',
        rejectionReason: 'Invalid migration',
      });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('rejects rejection when supplied fingerprint does not match active approval request', async () => {
      const session = await createRehearsedSession();
      await request(app).post(`/api/migrations/${session.id}/approval`).send();

      const res = await request(app).post(`/api/migrations/${session.id}/reject`).send({
        approver: 'LeadDBA',
        rejectionReason: 'Fingerprint mismatch test',
        fingerprint: 'deadbeef_invalid_fingerprint_hash',
      });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('ILLEGAL_STATE_TRANSITION');
      expect(res.body.error.message).toContain('fingerprint');
    });

    it('successfully rejects migration when matching fingerprint is supplied', async () => {
      const session = await createRehearsedSession();
      const approvalRes = await request(app).post(`/api/migrations/${session.id}/approval`).send();
      const validFingerprint = approvalRes.body.data.fingerprint;

      const res = await request(app).post(`/api/migrations/${session.id}/reject`).send({
        approver: 'LeadDBA',
        rejectionReason: 'Schema naming convention violation',
        fingerprint: validFingerprint,
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('REJECTED');
      expect(res.body.data.fingerprint).toBe(validFingerprint);
    });
  });

  // ===========================================================================
  // 4. Malformed Request Validation (Finding #3 & #4)
  // ===========================================================================
  describe('Malformed Approval Input & Boundary Validation', () => {
    it('returns 400 when approval actor is non-string or malformed', async () => {
      const session = await createRehearsedSession();
      const res = await request(app)
        .post(`/api/migrations/${session.id}/approval`)
        .send({ actor: 12345 });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.message).toContain('string');
    });

    it('returns 400 when approver identifier exceeds 100 characters', async () => {
      const session = await createRehearsedSession();
      await request(app).post(`/api/migrations/${session.id}/approval`).send();

      const res = await request(app)
        .post(`/api/migrations/${session.id}/approve`)
        .send({ approver: 'A'.repeat(101) });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.message).toContain('maximum allowed length');
    });

    it('returns 400 when approver identifier contains control characters', async () => {
      const session = await createRehearsedSession();
      await request(app).post(`/api/migrations/${session.id}/approval`).send();

      const res = await request(app)
        .post(`/api/migrations/${session.id}/approve`)
        .send({ approver: 'DBA\x00Admin' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.message).toContain('control characters');
    });

    it('returns 400 when approve comment is a non-string object', async () => {
      const session = await createRehearsedSession();
      await request(app).post(`/api/migrations/${session.id}/approval`).send();

      const res = await request(app)
        .post(`/api/migrations/${session.id}/approve`)
        .send({ approver: 'LeadDBA', comment: { evil: true } });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.message).toContain('string');
    });

    it('returns 400 when rejectionReason is a non-string array', async () => {
      const session = await createRehearsedSession();
      await request(app).post(`/api/migrations/${session.id}/approval`).send();

      const res = await request(app)
        .post(`/api/migrations/${session.id}/reject`)
        .send({ approver: 'LeadDBA', rejectionReason: ['Not', 'Allowed'] });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.message).toContain('string');
    });

    it('returns 400 when rejection reason exceeds 1000 characters', async () => {
      const session = await createRehearsedSession();
      await request(app).post(`/api/migrations/${session.id}/approval`).send();

      const res = await request(app)
        .post(`/api/migrations/${session.id}/reject`)
        .send({ approver: 'LeadDBA', rejectionReason: 'R'.repeat(1001) });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.message).toContain('maximum allowed length');
    });

    it('returns 400 when fingerprint is non-string', async () => {
      const session = await createRehearsedSession();
      await request(app).post(`/api/migrations/${session.id}/approval`).send();

      const res = await request(app)
        .post(`/api/migrations/${session.id}/approve`)
        .send({ approver: 'LeadDBA', fingerprint: 12345 });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.message).toContain('string');
    });
  });

  // ===========================================================================
  // 5. Repository Composition & Single Aggregate Root (Finding #2)
  // ===========================================================================
  describe('Repository Composition Guarantees', () => {
    it('1. explicit shared repository wins and is used across all services', async () => {
      const sharedRepo = new InMemoryMigrationSessionRepository();
      const routerApp = createApp({ sessionRepository: sharedRepo });

      const createRes = await request(routerApp).post('/api/migrations').send({ sql: 'SELECT 1;' });
      expect(createRes.status).toBe(201);

      const found = await sharedRepo.findById(createRes.body.data.sessionId);
      expect(found).toBeDefined();
    });

    it('2. uses repository from sessionService when only sessionService is injected', async () => {
      const customRepo = new InMemoryMigrationSessionRepository();
      const customSessionSvc = new MigrationSessionService(customRepo);
      const routerApp = createApp({ sessionService: customSessionSvc });

      const createRes = await request(routerApp).post('/api/migrations').send({ sql: 'SELECT 1;' });
      expect(createRes.status).toBe(201);

      const found = await customRepo.findById(createRes.body.data.sessionId);
      expect(found).toBeDefined();
    });

    it('3. uses repository from analysisService when only analysisService is injected', async () => {
      const customRepo = new InMemoryMigrationSessionRepository();
      const { MigrationAnalysisService } =
        await import('../../src/services/migration-analysis.service.js');
      const customAnalysisSvc = new MigrationAnalysisService(customRepo);
      const routerApp = createApp({ analysisService: customAnalysisSvc });

      const createRes = await request(routerApp).post('/api/migrations').send({ sql: 'SELECT 1;' });
      expect(createRes.status).toBe(201);

      const found = await customRepo.findById(createRes.body.data.sessionId);
      expect(found).toBeDefined();
    });

    it('4. uses repository from rehearsalService when only rehearsalService is injected', async () => {
      const customRepo = new InMemoryMigrationSessionRepository();
      const { MigrationRehearsalWorkflowService } =
        await import('../../src/rehearsal/services/migration-rehearsal-workflow.service.js');
      const customRehearsalSvc = new MigrationRehearsalWorkflowService({
        rehearsalDbPort:
          {} as unknown as import('../../src/rehearsal/ports/rehearsal-database.port.js').RehearsalDatabasePort,
        inspectionPort:
          {} as unknown as import('../../src/db/ports/database-inspection.port.js').DatabaseInspectionPort,
        sandboxPort: {} as unknown as import('../../src/sandbox/ports/sandbox.port.js').SandboxPort,
        sessionRepository: customRepo,
      });
      const routerApp = createApp({ rehearsalService: customRehearsalSvc });

      const createRes = await request(routerApp).post('/api/migrations').send({ sql: 'SELECT 1;' });
      expect(createRes.status).toBe(201);

      const found = await customRepo.findById(createRes.body.data.sessionId);
      expect(found).toBeDefined();
    });

    it('5. succeeds when multiple injected services share the exact same repository', async () => {
      const sharedRepo = new InMemoryMigrationSessionRepository();
      const customSessionSvc = new MigrationSessionService(sharedRepo);
      const customApprovalSvc = new ApprovalService({ sessionRepository: sharedRepo });

      const routerApp = createApp({
        sessionService: customSessionSvc,
        approvalService: customApprovalSvc,
      });

      const createRes = await request(routerApp).post('/api/migrations').send({ sql: 'SELECT 1;' });
      expect(createRes.status).toBe(201);

      const found = await sharedRepo.findById(createRes.body.data.sessionId);
      expect(found).toBeDefined();
    });

    it('6. fails fast with ConfigurationError when conflicting repositories are injected without explicit repo', async () => {
      const repoA = new InMemoryMigrationSessionRepository();
      const repoB = new InMemoryMigrationSessionRepository();
      const customSessionSvc = new MigrationSessionService(repoA);
      const customApprovalSvc = new ApprovalService({ sessionRepository: repoB });

      expect(() => {
        createApp({
          sessionService: customSessionSvc,
          approvalService: customApprovalSvc,
        });
      }).toThrow('Conflicting repository instances detected');
    });

    it('7. constructs a single default repository when no injections are provided', async () => {
      const defaultApp = createApp();
      const createRes = await request(defaultApp)
        .post('/api/migrations')
        .send({ sql: 'SELECT 1;' });
      expect(createRes.status).toBe(201);
    });
  });

  // ===========================================================================
  // 6. Persistence & Audit Trail
  // ===========================================================================
  describe('Audit Trail & Session Retrieval (GET /api/migrations/:sessionId)', () => {
    it('persists approval lifecycle history in session entity', async () => {
      const session = await createRehearsedSession();

      // Request approval
      await request(app)
        .post(`/api/migrations/${session.id}/approval`)
        .send({ actor: 'AliceDBA', comment: 'Audit test' });

      // Grant approval
      await request(app)
        .post(`/api/migrations/${session.id}/approve`)
        .send({ approver: 'BobDBA', comment: 'Approved for deployment' });

      // Query session via GET route
      const getRes = await request(app).get(`/api/migrations/${session.id}`);

      expect(getRes.status).toBe(200);
      expect(getRes.body.data.status).toBe('APPROVED');
      expect(getRes.body.data.approvalRequest).toBeDefined();
      expect(getRes.body.data.approvalDecision).toBeDefined();
      expect(getRes.body.data.approvalDecision.approver).toBe('BobDBA');

      // Verify audit history transitions
      const history = getRes.body.data.history as Array<{ toStatus: string; actor?: string }>;
      const statuses = history.map((h) => h.toStatus);
      expect(statuses).toContain('SANDBOX_REHEARSAL_COMPLETED');
      expect(statuses).toContain('AWAITING_APPROVAL');
      expect(statuses).toContain('APPROVED');
    });
  });
});
