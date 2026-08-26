import '../config/env.js';
import { PgInspectionAdapter } from '../db/adapters/pg-inspection.adapter.js';
import { DisposablePostgresAdapter } from './adapters/disposable-postgres.adapter.js';
import { TrueForgeSandboxAdapter } from '../sandbox/adapters/trueforge-sandbox.adapter.js';
import { MigrationRehearsalWorkflowService } from './services/migration-rehearsal-workflow.service.js';
import { MigrationSessionService } from '../services/migration-session.service.js';
import { MigrationAnalysisService } from '../services/migration-analysis.service.js';
import { InMemoryMigrationSessionRepository } from '../repositories/in-memory-session.repository.js';
import { TrueForgeLogger } from '../trueforge/trueforge.logger.js';

const logger = new TrueForgeLogger('[Orvexa:VerifyMigrationRehearsal]');

async function main() {
  console.info('==================================================');
  console.info('Orvexa — Real Migration Rehearsal Verification');
  console.info('==================================================\n');

  const connectionString =
    process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/schemasentry_test';

  const testMigrationSql = `
    ALTER TABLE public.events
    ADD COLUMN rehearsal_marker integer NOT NULL DEFAULT 0;
  `;

  console.info('[Config] Target DB URL  :', connectionString.replace(/:[^:@]+@/, ':***@'));
  console.info('[Config] Migration SQL  :', testMigrationSql.trim());

  const sessionRepo = new InMemoryMigrationSessionRepository();
  const sessionService = new MigrationSessionService(sessionRepo);
  const analysisService = new MigrationAnalysisService(sessionRepo);

  const inspectionAdapter = new PgInspectionAdapter({ connectionString });
  const disposableAdapter = new DisposablePostgresAdapter({ connectionString });
  const sandboxAdapter = new TrueForgeSandboxAdapter();

  const workflowService = new MigrationRehearsalWorkflowService({
    rehearsalDbPort: disposableAdapter,
    inspectionPort: inspectionAdapter,
    sandboxPort: sandboxAdapter,
    sessionRepository: sessionRepo,
    logger,
  });

  try {
    // 1. Create Migration Session & Run Static Analysis
    console.info('\n[1/5] Creating Migration Session & Running Static Analysis...');
    const session = await sessionService.createSession({
      targetDatabase: {
        engine: 'postgresql',
        version: '16.0',
        databaseName: 'schemasentry_test',
        schemaName: 'public',
        isProductionLike: false,
      },
      proposedMigration: {
        migrationId: 'mig-add-rehearsal-marker',
        name: 'Add rehearsal marker column to events',
        rawSql: testMigrationSql,
        targetSchema: 'public',
        targetTable: 'events',
      },
    });

    console.info(`   Session ID : ${session.sessionId}`);
    console.info(`   Status     : ${session.status}`);

    const { session: analyzedSession } = await analysisService.analyzeMigrationSession(
      session.sessionId,
      {
        inspectionPort: inspectionAdapter,
      }
    );
    console.info(`   Post-Analysis Status: ${analyzedSession.status}`);
    console.info(`   Risk Level          : ${analyzedSession.riskAssessment?.overallRiskLevel}`);

    if (analyzedSession.status !== 'SANDBOX_READY') {
      throw new Error(`Expected session status 'SANDBOX_READY', got '${analyzedSession.status}'`);
    }
    console.info('✅ Session is SANDBOX_READY.');

    // 2. Execute Real Migration Rehearsal Workflow
    console.info('\n[2/5] Executing Real Rehearsal Workflow (Disposable DB + Daytona Sandbox)...');
    const evidence = await workflowService.runRehearsal({
      sessionId: session.sessionId,
      migrationSql: testMigrationSql,
      options: { includeFixtures: true, fixtureRowLimit: 3 },
    });

    console.info(`   Rehearsal ID         : ${evidence.rehearsalId}`);
    console.info(`   Sandbox ID           : ${evidence.sandboxId || 'N/A'}`);
    console.info(`   Rehearsal Status     : ${evidence.status}`);
    console.info(`   Exit Code            : ${evidence.exitCode}`);
    console.info(`   Duration             : ${evidence.durationMs}ms`);
    console.info(`   Statements Succeeded : ${evidence.statementsSucceeded}`);
    console.info(`   Statements Failed    : ${evidence.statementsFailed}`);

    if (evidence.status !== 'SUCCESS') {
      throw new Error(`Rehearsal failed: ${evidence.failureReason}`);
    }
    console.info('✅ Migration successfully executed in the rehearsal database.');

    // 3. Validate Schema Differences
    console.info('\n[3/5] Validating Schema Differences...');
    console.info(`   Has Changes : ${evidence.schemaDifferences.hasChanges}`);
    console.info(`   Diff Summary: ${evidence.schemaDifferences.summary.join('; ')}`);

    const addedCols = evidence.schemaDifferences.columns.added;
    const markerCol = addedCols.find((c) => c.columnName === 'rehearsal_marker');
    if (!markerCol) {
      throw new Error(
        'Verification failed: Added column "rehearsal_marker" was not detected in post-migration diff.'
      );
    }
    console.info('✅ Post-migration schema difference verified successfully.');

    // 4. Verify MigrationSession State
    console.info('\n[4/5] Verifying Migration Session State...');
    const finalSession = await sessionRepo.findById(session.sessionId);
    console.info(`   Final Session Status : ${finalSession?.status}`);
    if (finalSession?.status !== 'SANDBOX_REHEARSAL_COMPLETED') {
      throw new Error(
        `Expected final status 'SANDBOX_REHEARSAL_COMPLETED', got '${finalSession?.status}'`
      );
    }
    console.info('✅ MigrationSession transitioned to SANDBOX_REHEARSAL_COMPLETED.');

    // 5. Verify Original Target Database is 100% UNCHANGED
    console.info('\n[5/5] Verifying Original Target Database is UNCHANGED...');
    const originalEventsTable = await inspectionAdapter.inspectFullTable('public', 'events');
    const hasMarkerInOriginal = originalEventsTable.columns.some(
      (c) => c.columnName === 'rehearsal_marker'
    );

    console.info(`   Original target events column count: ${originalEventsTable.columns.length}`);
    console.info(`   Original target has rehearsal_marker: ${hasMarkerInOriginal}`);

    if (hasMarkerInOriginal) {
      throw new Error('CRITICAL FAILURE: Original target database was modified during rehearsal!');
    }
    console.info('✅ Original target database was NOT modified (100% isolated).');

    console.info('\n==================================================');
    console.info('🎉 Real Migration Rehearsal Verification PASSED Successfully!');
    console.info('==================================================');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ Real Migration Rehearsal Verification FAILED:', err);
    process.exit(1);
  } finally {
    await inspectionAdapter.close();
  }
}

main().catch((err) => {
  console.error('Fatal error in verify-migration-rehearsal:', err);
  process.exit(1);
});
