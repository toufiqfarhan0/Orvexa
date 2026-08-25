import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import dotenv from 'dotenv';
import { PgInspectionAdapter } from '../../src/db/adapters/pg-inspection.adapter.js';
import { DisposablePostgresAdapter } from '../../src/rehearsal/adapters/disposable-postgres.adapter.js';
import { MigrationRehearsalWorkflowService } from '../../src/rehearsal/services/migration-rehearsal-workflow.service.js';
import { MigrationSessionEntity } from '../../src/domain/session.entity.js';
import { InMemoryMigrationSessionRepository } from '../../src/repositories/in-memory-session.repository.js';
import type { SandboxPort } from '../../src/sandbox/ports/sandbox.port.js';

dotenv.config();

const connectionString =
  process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/schemasentry_test';

describe('MigrationRehearsalWorkflowService (Live Integration Tests)', () => {
  let inspectionAdapter: PgInspectionAdapter;
  let disposableAdapter: DisposablePostgresAdapter;
  let mockSandboxPort: SandboxPort;
  let sessionRepo: InMemoryMigrationSessionRepository;
  let workflowService: MigrationRehearsalWorkflowService;

  beforeAll(async () => {
    inspectionAdapter = new PgInspectionAdapter({ connectionString });
    disposableAdapter = new DisposablePostgresAdapter({ connectionString });
    sessionRepo = new InMemoryMigrationSessionRepository();

    mockSandboxPort = {
      getCapability: async () => ({
        enabled: true,
        providerType: 'daytona',
        status: 'ready',
        supportedPlatforms: ['win32', 'linux', 'darwin'],
        currentPlatform: 'win32',
      }),
      configureProvider: async () => {},
      createSandbox: async () => ({ sandboxId: 'sb-live-test-workspace' }),
      execute: async () => ({
        success: true,
        exitCode: 0,
        stdout: 'REHEARSAL_SANDBOX_OK',
        stderr: '',
        durationMs: 40,
      }),
      cleanup: async () => {},
    };

    workflowService = new MigrationRehearsalWorkflowService({
      rehearsalDbPort: disposableAdapter,
      inspectionPort: inspectionAdapter,
      sandboxPort: mockSandboxPort,
      sessionRepository: sessionRepo,
    });
  });

  afterAll(async () => {
    await inspectionAdapter.close();
  });

  it('1. Executes full rehearsal workflow against live PostgreSQL instance, computes diff, cleans up, leaves target untouched', async () => {
    const migrationSql = `
      ALTER TABLE public.events
      ADD COLUMN integration_marker text DEFAULT 'rehearsal_verified';
    `;

    const session = MigrationSessionEntity.create({
      targetDatabase: {
        engine: 'postgresql',
        version: '16.0',
        databaseName: 'schemasentry_test',
        schemaName: 'public',
        isProductionLike: false,
      },
      proposedMigration: {
        migrationId: 'mig-integration-1',
        name: 'Add integration marker',
        rawSql: migrationSql,
      },
    });

    session.beginAnalysis('integration-test');
    session.recordAnalysisResult(
      {
        migrationId: 'mig-integration-1',
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
        lockAnalysis: {
          lockMode: 'ROW_EXCLUSIVE',
          blocksReads: false,
          blocksWrites: false,
          estimatedAcquisitionMs: 5,
          recommendedLockTimeoutMs: 5000,
        },
        categoryAssessments: {
          LOCKING: { category: 'LOCKING', level: 'LOW', score: 10, summary: 'Low', reasons: [] },
          PERFORMANCE: {
            category: 'PERFORMANCE',
            level: 'LOW',
            score: 10,
            summary: 'Low',
            reasons: [],
          },
          DATA_INTEGRITY: {
            category: 'DATA_INTEGRITY',
            level: 'LOW',
            score: 10,
            summary: 'Low',
            reasons: [],
          },
          ROLLBACK: { category: 'ROLLBACK', level: 'LOW', score: 10, summary: 'Low', reasons: [] },
          COMPATIBILITY: {
            category: 'COMPATIBILITY',
            level: 'LOW',
            score: 10,
            summary: 'Low',
            reasons: [],
          },
        },
        assessedAt: new Date().toISOString(),
      }
    );
    await sessionRepo.save(session);

    const evidence = await workflowService.runRehearsal({
      sessionId: session.id,
      migrationSql,
    });

    expect(evidence.status).toBe('SUCCESS');
    expect(evidence.exitCode).toBe(0);
    expect(evidence.statementsSucceeded).toBe(1);
    expect(evidence.schemaDifferences.hasChanges).toBe(true);

    const markerCol = evidence.schemaDifferences.columns.added.find(
      (c) => c.columnName === 'integration_marker'
    );
    expect(markerCol).toBeDefined();

    // Verify original target database is untouched
    const originalEvents = await inspectionAdapter.inspectFullTable('public', 'events');
    const existsInOriginal = originalEvents.columns.some(
      (c) => c.columnName === 'integration_marker'
    );
    expect(existsInOriginal).toBe(false);

    // Verify session status updated
    const finalSession = await sessionRepo.findById(session.id);
    expect(finalSession?.status).toBe('SANDBOX_REHEARSAL_COMPLETED');
  });
});
