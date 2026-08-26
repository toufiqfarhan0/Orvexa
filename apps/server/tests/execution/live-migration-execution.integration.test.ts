import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { config } from '../../src/config/env.js';
import { InMemoryMigrationSessionRepository } from '../../src/repositories/in-memory-session.repository.js';
import { PgInspectionAdapter } from '../../src/db/adapters/pg-inspection.adapter.js';
import { MigrationAnalyzerService } from '../../src/analyzer/services/migration-analyzer.service.js';
import { MigrationAnalysisService } from '../../src/services/migration-analysis.service.js';
import { MigrationSessionEntity } from '../../src/domain/session.entity.js';
import { DisposablePostgresAdapter } from '../../src/rehearsal/adapters/disposable-postgres.adapter.js';
import { MigrationRehearsalWorkflowService } from '../../src/rehearsal/services/migration-rehearsal-workflow.service.js';
import { ApprovalService } from '../../src/approval/services/approval.service.js';
import { PostgresExecutionAdapter } from '../../src/execution/adapters/postgres-execution.adapter.js';
import { LiveMigrationExecutionService } from '../../src/execution/services/live-migration-execution.service.js';
import pg from 'pg';

const { Pool } = pg;

describe('LiveMigrationExecutionService (Live PostgreSQL Integration Tests)', () => {
  const connectionString =
    config.databaseUrl || 'postgresql://postgres:postgres@localhost:5432/schemasentry_test';
  let pool: pg.Pool;

  beforeEach(async () => {
    pool = new Pool({ connectionString });
    try {
      await pool.query('ALTER TABLE public.events DROP COLUMN IF EXISTS it_live_marker;');
    } catch {
      // Ignore if table or column doesn't exist
    }
  });

  afterEach(async () => {
    try {
      await pool.query('ALTER TABLE public.events DROP COLUMN IF EXISTS it_live_marker;');
    } catch {
      // Ignore
    } finally {
      await pool.end();
    }
  });

  it('1. Executes end-to-end rehearsal, human approval, and live execution on local PostgreSQL database', async () => {
    const sessionRepo = new InMemoryMigrationSessionRepository();
    const inspectionAdapter = new PgInspectionAdapter({ connectionString });
    const analyzerService = new MigrationAnalyzerService();
    const analysisService = new MigrationAnalysisService(sessionRepo, {
      analyzer: analyzerService,
    });
    const rehearsalDbAdapter = new DisposablePostgresAdapter({ connectionString });
    const mockSandboxPort = {
      getCapability: async () => ({
        enabled: true,
        providerType: 'daytona' as const,
        status: 'ready' as const,
        supportedPlatforms: ['win32', 'linux', 'darwin'],
        currentPlatform: process.platform,
      }),
      configureProvider: async () => {},
      createSandbox: async () => ({ sandboxId: 'sb-live-exec-workspace' }),
      execute: async () => ({
        success: true,
        exitCode: 0,
        stdout: 'REHEARSAL_SANDBOX_OK',
        stderr: '',
        durationMs: 30,
      }),
      cleanup: async () => {},
    };
    const rehearsalWorkflowService = new MigrationRehearsalWorkflowService({
      sessionRepository: sessionRepo,
      inspectionPort: inspectionAdapter,
      rehearsalDbPort: rehearsalDbAdapter,
      sandboxPort: mockSandboxPort,
    });
    const approvalService = new ApprovalService({ sessionRepository: sessionRepo });
    const executionAdapter = new PostgresExecutionAdapter({ connectionString });
    const liveExecutionService = new LiveMigrationExecutionService({
      sessionRepository: sessionRepo,
      executionPort: executionAdapter,
      inspectionPort: inspectionAdapter,
    });

    // 1. Create Session
    const sessionEntity = MigrationSessionEntity.create({
      targetDatabase: {
        engine: 'postgresql',
        version: '16.0',
        databaseName: 'schemasentry_test',
        schemaName: 'public',
        targetTable: 'events',
        isProductionLike: false,
      },
      proposedMigration: {
        migrationId: 'mig_it_live_001',
        name: 'Add it_live_marker column',
        rawSql: 'ALTER TABLE public.events ADD COLUMN it_live_marker integer NOT NULL DEFAULT 42;',
      },
    });
    await sessionRepo.save(sessionEntity);
    const sessionId = sessionEntity.id;

    // 2. Static Analysis
    await analysisService.analyzeMigrationSession(sessionId, {
      actor: 'IT_Agent',
      inspectionPort: inspectionAdapter,
    });

    // 3. Disposable Rehearsal
    const rehearsalResult = await rehearsalWorkflowService.runRehearsal({
      sessionId,
      migrationSql: sessionEntity.request.proposedMigration.rawSql,
    });
    expect(rehearsalResult.status).toBe('SUCCESS');

    // 4. Request Approval & Approve
    const approvalRequest = await approvalService.requestApproval({
      sessionId,
      actor: 'IT_DBA',
    });
    const decision = await approvalService.approve({
      sessionId,
      approver: 'IT_DBA',
      fingerprint: approvalRequest.fingerprint,
    });
    expect(decision.status).toBe('APPROVED');

    // 5. Live Execution
    const liveEvidence = await liveExecutionService.execute({
      sessionId,
      actor: 'IT_ReleaseEngineer',
    });

    expect(liveEvidence.finalStatus).toBe('COMPLETED');
    expect(liveEvidence.verificationResult.status).toBe('PASSED');
    expect(liveEvidence.statementsSucceeded).toBe(1);

    // 6. Direct SQL probe to verify column physically exists
    const res = await pool.query(
      "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'events' AND column_name = 'it_live_marker';"
    );
    expect(res.rows.length).toBe(1);
    expect(res.rows[0].column_name).toBe('it_live_marker');
    expect(res.rows[0].data_type).toBe('integer');
  });
});
