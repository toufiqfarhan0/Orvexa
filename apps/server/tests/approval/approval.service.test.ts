import { describe, it, expect, beforeEach } from 'vitest';
import { ApprovalService } from '../../src/approval/services/approval.service.js';
import { InMemoryMigrationSessionRepository } from '../../src/repositories/in-memory-session.repository.js';
import { MigrationSessionEntity } from '../../src/domain/session.entity.js';

describe('ApprovalService (Unit Tests & Invariants)', () => {
  let sessionRepo: InMemoryMigrationSessionRepository;
  let approvalService: ApprovalService;

  const createRehearsedSession = async (overrides?: {
    migrationId?: string;
    sql?: string;
    databaseName?: string;
    rehearsalId?: string;
  }) => {
    const session = MigrationSessionEntity.create({
      targetDatabase: {
        engine: 'postgresql',
        version: '16.0',
        databaseName: overrides?.databaseName || 'testdb',
        schemaName: 'public',
        isProductionLike: false,
      },
      proposedMigration: {
        migrationId: overrides?.migrationId || 'mig-appr-01',
        name: 'Add tracking column',
        rawSql: overrides?.sql || 'ALTER TABLE events ADD COLUMN tracking_code text;',
      },
    });

    session.beginAnalysis('Analyzer');
    session.recordAnalysisResult(
      {
        migrationId: overrides?.migrationId || 'mig-appr-01',
        analyzedAt: new Date().toISOString(),
        isSafeForSandbox: true,
        statementAnalyses: [],
        findings: [],
        blockers: [],
        summary: 'Safe',
      },
      {
        overallRiskLevel: 'LOW',
        overallScore: 10,
        summary: 'Low risk schema change',
        categoryAssessments: {
          LOCKING: {
            category: 'LOCKING',
            level: 'LOW',
            score: 10,
            summary: 'Minimal lock contention',
            reasons: ['Row exclusive lock only'],
          },
        },
        assessedAt: new Date().toISOString(),
      }
    );

    session.beginSandboxRehearsal('RehearsalWorkflow');
    session.recordSandboxResult({
      rehearsalId: overrides?.rehearsalId || 'reh_99999',
      status: 'SUCCESS',
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      durationMs: 250,
      simulatedLockAcquisitionMs: 0,
      rowsAffected: 0,
      statementsExecuted: 1,
      rollbackVerified: true,
      logs: ['Statement 1 executed successfully'],
    });

    await sessionRepo.save(session);
    return session;
  };

  beforeEach(() => {
    sessionRepo = new InMemoryMigrationSessionRepository();
    approvalService = new ApprovalService({ sessionRepository: sessionRepo });
  });

  it('1. Successfully requests approval on completed rehearsal session', async () => {
    const session = await createRehearsedSession();

    const request = await approvalService.requestApproval({
      sessionId: session.id,
      actor: 'dev_user',
    });

    expect(request).toBeDefined();
    expect(request.approvalRequestId).toMatch(/^appr_req_/);
    expect(request.sessionId).toBe(session.id);
    expect(request.migrationId).toBe('mig-appr-01');
    expect(request.rehearsalId).toBe('reh_99999');
    expect(request.highestRiskLevel).toBe('LOW');
    expect(request.fingerprint).toHaveLength(64);

    const updated = await sessionRepo.findById(session.id);
    expect(updated?.status).toBe('AWAITING_APPROVAL');
  });

  it('2. Successfully records an APPROVED human decision', async () => {
    const session = await createRehearsedSession();
    await approvalService.requestApproval({ sessionId: session.id, actor: 'dev_user' });

    const decision = await approvalService.approve({
      sessionId: session.id,
      approver: 'dba_lead@orvexa.io',
      comment: 'Rehearsal verified and risk acceptable.',
    });

    expect(decision.status).toBe('APPROVED');
    expect(decision.approver).toBe('dba_lead@orvexa.io');
    expect(decision.comment).toBe('Rehearsal verified and risk acceptable.');
    expect(decision.rehearsalId).toBe('reh_99999');
    expect(decision.fingerprint).toHaveLength(64);

    const updated = await sessionRepo.findById(session.id);
    expect(updated?.status).toBe('APPROVED');
    expect(updated?.approvalDecision?.status).toBe('APPROVED');
  });

  it('3. Successfully records a REJECTED human decision with reason', async () => {
    const session = await createRehearsedSession();
    await approvalService.requestApproval({ sessionId: session.id, actor: 'dev_user' });

    const decision = await approvalService.reject({
      sessionId: session.id,
      approver: 'security_auditor@orvexa.io',
      reason: 'Missing index on foreign key column.',
    });

    expect(decision.status).toBe('REJECTED');
    expect(decision.approver).toBe('security_auditor@orvexa.io');
    expect(decision.rejectionReason).toBe('Missing index on foreign key column.');

    const updated = await sessionRepo.findById(session.id);
    expect(updated?.status).toBe('REJECTED');
    expect(updated?.approvalDecision?.status).toBe('REJECTED');
  });

  it('4. Rejects approval request when rehearsal is not yet completed', async () => {
    const draftSession = MigrationSessionEntity.create({
      targetDatabase: {
        engine: 'postgresql',
        version: '16.0',
        databaseName: 'testdb',
        schemaName: 'public',
        isProductionLike: false,
      },
      proposedMigration: {
        migrationId: 'mig-draft',
        name: 'Draft migration',
        rawSql: 'SELECT 1;',
      },
    });
    await sessionRepo.save(draftSession);

    await expect(
      approvalService.requestApproval({ sessionId: draftSession.id, actor: 'dev_user' })
    ).rejects.toThrow(/Rehearsal must be completed first/);
  });

  it('5. Cannot approve from invalid states (e.g. DRAFT, ANALYZING, SANDBOX_RUNNING)', async () => {
    const session = await createRehearsedSession();
    // Session is currently in SANDBOX_REHEARSAL_COMPLETED (not yet AWAITING_APPROVAL)

    await expect(
      approvalService.approve({ sessionId: session.id, approver: 'lead_dba' })
    ).rejects.toThrow(/Cannot approve session in 'SANDBOX_REHEARSAL_COMPLETED' status/);
  });

  it('6. Rejected session cannot trigger execution and maintains invariant', async () => {
    const session = await createRehearsedSession();
    await approvalService.requestApproval({ sessionId: session.id, actor: 'dev_user' });
    await approvalService.reject({
      sessionId: session.id,
      approver: 'dba_lead',
      reason: 'Rejected due to maintenance window',
    });

    const updated = await sessionRepo.findById(session.id);
    expect(updated?.status).toBe('REJECTED');

    // Attempting to begin execution on a rejected session must throw
    expect(() => updated?.beginExecution()).toThrow(
      /Cannot begin execution when session is in 'REJECTED' status/
    );
  });

  it('7. Validates that approval fingerprint matches active session', async () => {
    const session = await createRehearsedSession();
    const req = await approvalService.requestApproval({ sessionId: session.id });

    const decision = await approvalService.approve({
      sessionId: session.id,
      approver: 'lead_dba',
      fingerprint: req.fingerprint,
    });

    expect(decision.fingerprint).toBe(req.fingerprint);

    const validation = await approvalService.validateApproval(session.id);
    expect(validation.valid).toBe(true);
    expect(validation.status).toBe('APPROVED');
  });

  it('8. Rejects approval when supplied fingerprint does not match session', async () => {
    const session = await createRehearsedSession();
    await approvalService.requestApproval({ sessionId: session.id });

    await expect(
      approvalService.approve({
        sessionId: session.id,
        approver: 'lead_dba',
        fingerprint: 'invalid_tampered_fingerprint_000000000000000000000000000000000000',
      })
    ).rejects.toThrow(/Supplied approval fingerprint does not match/);
  });

  it('9. Modifying migration invalidates previously granted approval', async () => {
    const session = await createRehearsedSession();
    await approvalService.requestApproval({ sessionId: session.id });
    await approvalService.approve({ sessionId: session.id, approver: 'lead_dba' });

    // Retrieve approved session and simulate modifying SQL
    const approvedSession = await sessionRepo.findById(session.id);
    const snapshot = approvedSession!.toSnapshot();
    snapshot.request.proposedMigration.rawSql = 'ALTER TABLE events DROP COLUMN critical_data;';
    const modifiedEntity = MigrationSessionEntity.fromSnapshot(snapshot);
    await sessionRepo.save(modifiedEntity);

    // Validation probe detects mismatch and invalidates
    const validation = await approvalService.validateApproval(session.id);
    expect(validation.valid).toBe(false);
    expect(validation.reason).toContain('Approval fingerprint mismatch');

    const refreshed = await sessionRepo.findById(session.id);
    expect(refreshed?.status).toBe('AWAITING_APPROVAL');
    expect(refreshed?.approvalDecision).toBeUndefined();
  });

  it('10. Modifying rehearsal result invalidates previously granted approval', async () => {
    const session = await createRehearsedSession();
    await approvalService.requestApproval({ sessionId: session.id });
    await approvalService.approve({ sessionId: session.id, approver: 'lead_dba' });

    // Retrieve approved session and simulate different rehearsal run ID
    const approvedSession = await sessionRepo.findById(session.id);
    const snapshot = approvedSession!.toSnapshot();
    snapshot.sandboxResult!.rehearsalId = 'reh_different_id_999';
    const modifiedEntity = MigrationSessionEntity.fromSnapshot(snapshot);
    await sessionRepo.save(modifiedEntity);

    const validation = await approvalService.validateApproval(session.id);
    expect(validation.valid).toBe(false);
    expect(validation.reason).toContain('Approval fingerprint mismatch');
  });

  it('11. Prevents duplicate approval when session is already approved', async () => {
    const session = await createRehearsedSession();
    await approvalService.requestApproval({ sessionId: session.id });
    await approvalService.approve({ sessionId: session.id, approver: 'dba_1' });

    // Attempting to approve again must fail because status is now APPROVED, not AWAITING_APPROVAL
    await expect(
      approvalService.approve({ sessionId: session.id, approver: 'dba_2' })
    ).rejects.toThrow(/Cannot approve session in 'APPROVED' status/);
  });

  it('12. Preserves immutable audit history across transitions', async () => {
    const session = await createRehearsedSession();
    await approvalService.requestApproval({ sessionId: session.id, actor: 'engineer_alice' });
    await approvalService.approve({
      sessionId: session.id,
      approver: 'dba_bob',
      comment: 'Looks clean',
    });

    const saved = await sessionRepo.findById(session.id);
    const history = saved?.history || [];

    const awaitingEntry = history.find((h) => h.toStatus === 'AWAITING_APPROVAL');
    expect(awaitingEntry).toBeDefined();
    expect(awaitingEntry?.actor).toBe('engineer_alice');

    const approvedEntry = history.find((h) => h.toStatus === 'APPROVED');
    expect(approvedEntry).toBeDefined();
    expect(approvedEntry?.actor).toBe('dba_bob');
    expect(approvedEntry?.reason).toContain('Approved by dba_bob');
  });

  it('13. Records actor identity in all approval actions', async () => {
    const session = await createRehearsedSession();
    await approvalService.requestApproval({ sessionId: session.id, actor: 'service_account' });
    const decision = await approvalService.approve({
      sessionId: session.id,
      approver: 'lead_architect',
    });

    expect(decision.approver).toBe('lead_architect');
  });

  it('14. Records timestamp for all approval decisions', async () => {
    const session = await createRehearsedSession();
    await approvalService.requestApproval({ sessionId: session.id });
    const decision = await approvalService.approve({
      sessionId: session.id,
      approver: 'dba_lead',
    });

    expect(decision.decidedAt).toBeDefined();
    expect(new Date(decision.decidedAt).getTime()).not.toBeNaN();
  });

  it('15. Proves an old approval cannot authorize a different migration proposal', async () => {
    const sessionA = await createRehearsedSession({
      migrationId: 'mig-A',
      sql: 'CREATE TABLE t1 (id int);',
    });
    const sessionB = await createRehearsedSession({
      migrationId: 'mig-B',
      sql: 'CREATE TABLE t2 (id int);',
    });

    const reqA = await approvalService.requestApproval({ sessionId: sessionA.id });
    await approvalService.requestApproval({ sessionId: sessionB.id });

    // Attempt to use session A's fingerprint to approve session B
    await expect(
      approvalService.approve({
        sessionId: sessionB.id,
        approver: 'dba_user',
        fingerprint: reqA.fingerprint,
      })
    ).rejects.toThrow(/Supplied approval fingerprint does not match/);
  });

  it('16. Executes full lifecycle from SANDBOX_REHEARSAL_COMPLETED -> AWAITING_APPROVAL -> APPROVED', async () => {
    const session = await createRehearsedSession();
    expect(session.status).toBe('SANDBOX_REHEARSAL_COMPLETED');

    const req = await approvalService.requestApproval({
      sessionId: session.id,
      actor: 'release_manager',
    });
    expect(req.sessionId).toBe(session.id);

    const midSession = await sessionRepo.findById(session.id);
    expect(midSession?.status).toBe('AWAITING_APPROVAL');

    const decision = await approvalService.approve({
      sessionId: session.id,
      approver: 'security_lead',
      comment: 'Passed security and rehearsal criteria',
    });
    expect(decision.status).toBe('APPROVED');

    const finalSession = await sessionRepo.findById(session.id);
    expect(finalSession?.status).toBe('APPROVED');
    expect(finalSession?.approvalDecision?.approver).toBe('security_lead');
  });
});
