import { config } from '../config/env.js';
import { InMemoryMigrationSessionRepository } from '../repositories/in-memory-session.repository.js';
import { PgInspectionAdapter } from '../db/adapters/pg-inspection.adapter.js';
import { MigrationAnalyzerService } from '../analyzer/services/migration-analyzer.service.js';
import { MigrationAnalysisService } from '../services/migration-analysis.service.js';
import { MigrationSessionEntity } from '../domain/session.entity.js';
import { TrueForgeSandboxAdapter } from '../sandbox/adapters/trueforge-sandbox.adapter.js';
import { DisposablePostgresAdapter } from '../rehearsal/adapters/disposable-postgres.adapter.js';
import { MigrationRehearsalWorkflowService } from '../rehearsal/services/migration-rehearsal-workflow.service.js';
import { ApprovalService } from '../approval/services/approval.service.js';
import { PostgresExecutionAdapter } from './adapters/postgres-execution.adapter.js';
import { LiveMigrationExecutionService } from './services/live-migration-execution.service.js';
import { TrueForgeLogger } from '../trueforge/trueforge.logger.js';
import pg from 'pg';

const { Pool } = pg;

async function runLiveMigrationVerification() {
  const logger = new TrueForgeLogger('[verify-live-migration]');
  console.info('\n=== SchemaSentry Controlled Live Migration Verification ===\n');

  const connectionString =
    config.databaseUrl || 'postgresql://postgres:postgres@localhost:5432/schemasentry_test';
  console.info(`Target database: ${connectionString.replace(/:[^:@]+@/, ':***@')}`);

  // 0. Pre-cleaning test table column on isolated local target
  const pool = new Pool({ connectionString });
  try {
    await pool.query('ALTER TABLE public.events DROP COLUMN IF EXISTS ui_live_execution_marker;');
    await pool.query('ALTER TABLE public.events DROP COLUMN IF EXISTS live_execution_marker;');
    console.info(
      'Pre-flight target cleanup completed (dropped ui_live_execution_marker if existed).\n'
    );
  } catch (err: unknown) {
    console.warn('Pre-flight cleanup warning:', err);
  } finally {
    await pool.end();
  }

  // 1. Setup adapters and services
  const sessionRepo = new InMemoryMigrationSessionRepository();
  const inspectionAdapter = new PgInspectionAdapter({ connectionString });
  const analyzerService = new MigrationAnalyzerService();
  const analysisService = new MigrationAnalysisService(sessionRepo, {
    analyzer: analyzerService,
  });
  const rehearsalDbAdapter = new DisposablePostgresAdapter({ connectionString });
  const sandboxAdapter = new TrueForgeSandboxAdapter();
  const rehearsalWorkflowService = new MigrationRehearsalWorkflowService({
    sessionRepository: sessionRepo,
    inspectionPort: inspectionAdapter,
    rehearsalDbPort: rehearsalDbAdapter,
    sandboxPort: sandboxAdapter,
    logger,
  });
  const approvalService = new ApprovalService({
    sessionRepository: sessionRepo,
    logger,
  });
  const executionAdapter = new PostgresExecutionAdapter({
    connectionString,
    logger,
  });
  const liveExecutionService = new LiveMigrationExecutionService({
    sessionRepository: sessionRepo,
    executionPort: executionAdapter,
    inspectionPort: inspectionAdapter,
    logger,
  });

  // 2. Create Migration Session
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
      migrationId: 'mig_live_verify_001',
      name: 'Add ui live execution marker column',
      rawSql:
        'ALTER TABLE public.events ADD COLUMN ui_live_execution_marker integer NOT NULL DEFAULT 0;',
    },
  });
  await sessionRepo.save(sessionEntity);
  const sessionId = sessionEntity.id;
  console.info(`1. Created Migration Session: ${sessionId} (Status: DRAFT)`);

  // 3. Run Static Analysis
  const { session: analyzedSession } = await analysisService.analyzeMigrationSession(sessionId, {
    actor: 'AnalyzerAgent',
    inspectionPort: inspectionAdapter,
  });
  console.info(
    `2. Static Analysis Completed (Status: ${analyzedSession.status}, Risk: ${analyzedSession.riskAssessment?.overallRiskLevel})`
  );

  // 4. Run Disposable PostgreSQL Rehearsal
  const rehearsalOutcome = await rehearsalWorkflowService.runRehearsal({
    sessionId,
    migrationSql: sessionEntity.request.proposedMigration.rawSql,
    options: { includeFixtures: true, fixtureRowLimit: 3 },
  });
  console.info(
    `3. Sandbox Rehearsal Completed (Status: ${rehearsalOutcome.status}, Rehearsal ID: ${rehearsalOutcome.rehearsalId})`
  );

  // 5. Request Approval
  const approvalRequest = await approvalService.requestApproval({
    sessionId,
    actor: 'LeadDBA',
    comment: 'Rehearsal verified in disposable database. Ready for live execution.',
  });
  console.info(
    `4. Approval Requested (Status: AWAITING_APPROVAL, Fingerprint: ${approvalRequest.fingerprint.slice(0, 16)}...)`
  );

  // 6. Approve with Fingerprint
  const approvalDecision = await approvalService.approve({
    sessionId,
    approver: 'LeadDBA',
    comment: 'Approved for target execution.',
    fingerprint: approvalRequest.fingerprint,
  });
  console.info(
    `5. Human Approval Granted (Status: APPROVED, Approver: ${approvalDecision.approver})`
  );

  // 7. Execute Controlled Live Migration
  console.info('\n--- Executing Controlled Live Migration ---');
  const liveEvidence = await liveExecutionService.execute({
    sessionId,
    actor: 'ReleaseEngineer',
    timeoutMs: 30000,
  });

  console.info(`Execution ID: ${liveEvidence.executionId}`);
  console.info(`Duration: ${liveEvidence.durationMs}ms`);
  console.info(
    `Statements Succeeded: ${liveEvidence.statementsSucceeded}/${liveEvidence.statementsAttempted}`
  );
  console.info(`Final Session Status: ${liveEvidence.finalStatus}`);
  console.info(`Verification Status: ${liveEvidence.verificationResult.status}`);
  console.info(`Schema Diff: ${liveEvidence.schemaDiff.summary}`);

  // 8. Post-Execution Target Catalog Inspection
  const columns = await inspectionAdapter.inspectColumns('public', 'events');
  const hasColumn = columns.some((c) => c.columnName === 'ui_live_execution_marker');
  console.info(
    `Post-Execution Catalog Check: column 'ui_live_execution_marker' found = ${hasColumn}`
  );
  if (!hasColumn) {
    throw new Error(
      "Target column 'ui_live_execution_marker' was not found in catalog after execution."
    );
  }

  // 9. Post-Execution Teardown (Clean up test column)
  const cleanupPool = new Pool({ connectionString });
  try {
    await cleanupPool.query(
      'ALTER TABLE public.events DROP COLUMN IF EXISTS ui_live_execution_marker;'
    );
    console.info('\nPost-verification target cleanup completed (restored schema).\n');
  } finally {
    await cleanupPool.end();
  }

  // 10. Validate final results
  if (
    liveEvidence.finalStatus !== 'COMPLETED' ||
    liveEvidence.verificationResult.status !== 'PASSED'
  ) {
    throw new Error(`Live migration verification failed with status: ${liveEvidence.finalStatus}`);
  }

  console.info('=== Live Migration Verification PASSED Successfully ===\n');
}

runLiveMigrationVerification().catch((err) => {
  console.error('\nLive migration verification failed with error:', err);
  process.exit(1);
});
