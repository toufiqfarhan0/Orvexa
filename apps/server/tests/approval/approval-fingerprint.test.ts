import { describe, it, expect } from 'vitest';
import { ApprovalFingerprintGenerator } from '../../src/approval/utils/approval-fingerprint.js';
import { MigrationSessionEntity } from '../../src/domain/session.entity.js';

describe('ApprovalFingerprintGenerator (Unit Tests)', () => {
  const createMockSession = (overrides?: {
    sql?: string;
    databaseName?: string;
    schemaName?: string;
    rehearsalId?: string;
  }) => {
    const entity = MigrationSessionEntity.create({
      targetDatabase: {
        engine: 'postgresql',
        version: '16.0',
        databaseName: overrides?.databaseName || 'testdb',
        schemaName: overrides?.schemaName || 'public',
        isProductionLike: false,
      },
      proposedMigration: {
        migrationId: 'mig-fp-001',
        name: 'Add status column',
        rawSql:
          overrides?.sql || "ALTER TABLE users ADD COLUMN status text NOT NULL DEFAULT 'active';",
      },
    });

    entity.beginAnalysis();
    entity.recordAnalysisResult(
      {
        migrationId: 'mig-fp-001',
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
        summary: 'Low risk',
        categoryAssessments: {},
        assessedAt: new Date().toISOString(),
      }
    );

    entity.beginSandboxRehearsal();
    entity.recordSandboxResult({
      rehearsalId: overrides?.rehearsalId || 'reh_12345',
      status: 'SUCCESS',
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      durationMs: 150,
      simulatedLockAcquisitionMs: 0,
      rowsAffected: 0,
      statementsExecuted: 1,
      rollbackVerified: true,
      logs: [],
    });

    return entity;
  };

  it('1. Generates deterministic SHA-256 fingerprint from session state', () => {
    const session1 = createMockSession();
    const session2 = createMockSession();

    const fp1 = ApprovalFingerprintGenerator.compute(session1);
    const fp2 = ApprovalFingerprintGenerator.compute(session2);

    expect(fp1.fingerprintHash).toBeDefined();
    expect(fp1.fingerprintHash).toHaveLength(64); // SHA-256 hex length
    expect(fp1.fingerprintHash).toBe(fp2.fingerprintHash);
    expect(fp1.migrationId).toBe('mig-fp-001');
    expect(fp1.rehearsalId).toBe('reh_12345');
  });

  it('2. Changes fingerprint when migration SQL changes', () => {
    const original = createMockSession({ sql: 'ALTER TABLE users ADD COLUMN status text;' });
    const modified = createMockSession({ sql: 'ALTER TABLE users ADD COLUMN status varchar(50);' });

    const fpOriginal = ApprovalFingerprintGenerator.compute(original);
    const fpModified = ApprovalFingerprintGenerator.compute(modified);

    expect(fpOriginal.fingerprintHash).not.toBe(fpModified.fingerprintHash);
  });

  it('3. Changes fingerprint when target database or schema changes', () => {
    const sessionA = createMockSession({ databaseName: 'prod_db', schemaName: 'public' });
    const sessionB = createMockSession({ databaseName: 'staging_db', schemaName: 'public' });

    const fpA = ApprovalFingerprintGenerator.compute(sessionA);
    const fpB = ApprovalFingerprintGenerator.compute(sessionB);

    expect(fpA.fingerprintHash).not.toBe(fpB.fingerprintHash);
  });

  it('4. Changes fingerprint when rehearsal ID changes', () => {
    const sessionA = createMockSession({ rehearsalId: 'reh_run_1' });
    const sessionB = createMockSession({ rehearsalId: 'reh_run_2' });

    const fpA = ApprovalFingerprintGenerator.compute(sessionA);
    const fpB = ApprovalFingerprintGenerator.compute(sessionB);

    expect(fpA.fingerprintHash).not.toBe(fpB.fingerprintHash);
  });

  it('5. Successfully verifies matching fingerprint', () => {
    const session = createMockSession();
    const fp = ApprovalFingerprintGenerator.compute(session);

    expect(ApprovalFingerprintGenerator.verify(session, fp.fingerprintHash)).toBe(true);
    expect(ApprovalFingerprintGenerator.verify(session, 'tampered_hash_value')).toBe(false);
  });
});
