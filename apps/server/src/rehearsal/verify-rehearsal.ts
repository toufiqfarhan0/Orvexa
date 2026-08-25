import dotenv from 'dotenv';
import pg from 'pg';
import { PgInspectionAdapter } from '../db/adapters/pg-inspection.adapter.js';
import { DisposablePostgresAdapter } from './adapters/disposable-postgres.adapter.js';
import { MigrationRehearsalService } from './services/migration-rehearsal.service.js';
import { TrueForgeLogger } from '../trueforge/trueforge.logger.js';

dotenv.config();

const logger = new TrueForgeLogger('[SchemaSentry:VerifyRehearsal]');

async function main() {
  console.info('==================================================');
  console.info('Orvexa / SchemaSentry — Disposable Rehearsal DB Verification');
  console.info('==================================================\n');

  const connectionString =
    process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/schemasentry_test';

  const rehearsalId = `verify_${Date.now()}`;
  console.info(`[Config] Rehearsal ID : ${rehearsalId}`);
  console.info(`[Config] Target DB URL: ${connectionString.replace(/:[^:@]+@/, ':***@')}\n`);

  const inspectionAdapter = new PgInspectionAdapter({ connectionString });
  const disposableAdapter = new DisposablePostgresAdapter({ connectionString });
  const rehearsalService = new MigrationRehearsalService({
    rehearsalDbPort: disposableAdapter,
    inspectionPort: inspectionAdapter,
    logger,
  });

  try {
    // 1. Inspect source database
    console.info('[1/4] Inspecting source PostgreSQL catalog...');
    const dbMeta = await inspectionAdapter.getDatabaseMetadata();
    console.info(`   Source Database : ${dbMeta.databaseName}`);
    console.info(`   Tables Detected : ${dbMeta.tables.map((t) => t.tableName).join(', ')}`);

    // 2. Prepare disposable rehearsal environment
    console.info('\n[2/4] Provisioning isolated disposable database & cloning schema...');
    const result = await rehearsalService.prepareRehearsal(rehearsalId, {
      includeFixtures: true,
      fixtureRowLimit: 3,
    });

    console.info(`✅ Disposable DB provisioned: ${result.environment.databaseName}`);
    console.info(`   Status            : ${result.environment.status}`);
    console.info(`   Tables Cloned     : ${result.cloneSummary.tablesCreated}`);
    console.info(`   Columns Cloned    : ${result.cloneSummary.columnsCreated}`);
    console.info(`   Primary Keys      : ${result.cloneSummary.primaryKeysCreated}`);
    console.info(`   Foreign Keys      : ${result.cloneSummary.foreignKeysCreated}`);
    console.info(`   Indexes Cloned    : ${result.cloneSummary.indexesCreated}`);
    console.info(`   Fixtures Inserted : ${result.cloneSummary.fixtureRowsInserted}`);
    console.info(`   Duration          : ${result.cloneSummary.durationMs}ms`);

    // 3. Verify isolated database content directly
    console.info(
      '\n[3/4] Validating schema and synthetic data inside isolated rehearsal database...'
    );
    const rehearsalConfig = await rehearsalService.getConnectionConfig(rehearsalId);
    const testPool = new pg.Pool({
      host: rehearsalConfig.host,
      port: rehearsalConfig.port,
      user: rehearsalConfig.user,
      password: rehearsalConfig.password,
      database: rehearsalConfig.database,
      ssl: rehearsalConfig.ssl,
      max: 2,
    });

    try {
      const orgsCount = await testPool.query('SELECT count(*) FROM organizations;');
      const usersCount = await testPool.query('SELECT count(*) FROM users;');
      const eventsCount = await testPool.query('SELECT count(*) FROM events;');
      const ordersCount = await testPool.query('SELECT count(*) FROM orders;');

      console.info(`   organizations row count : ${orgsCount.rows[0].count}`);
      console.info(`   users row count         : ${usersCount.rows[0].count}`);
      console.info(`   events row count        : ${eventsCount.rows[0].count}`);
      console.info(`   orders row count        : ${ordersCount.rows[0].count}`);

      if (parseInt(usersCount.rows[0].count, 10) === 0) {
        throw new Error(
          'Verification failed: Synthetic fixture data not found in rehearsal database.'
        );
      }
      console.info('✅ Isolated rehearsal database integrity verified.');
    } finally {
      await testPool.end();
    }

    // 4. Cleanup disposable database
    console.info('\n[4/4] Tearing down disposable rehearsal database...');
    await rehearsalService.cleanupRehearsal(rehearsalId);
    const postCleanup = await rehearsalService.getRehearsal(rehearsalId);
    console.info(`   Post-cleanup status: ${postCleanup ? postCleanup.status : 'DELETED'}`);
    console.info('✅ Disposable rehearsal database dropped successfully.');

    console.info('\n==================================================');
    console.info('🎉 Disposable PostgreSQL Rehearsal Verification PASSED!');
    console.info('==================================================');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Disposable Rehearsal Verification FAILED:', error);
    try {
      await rehearsalService.cleanupRehearsal(rehearsalId);
    } catch {
      // Ignored during failure cleanup
    }
    process.exit(1);
  } finally {
    await inspectionAdapter.close();
  }
}

main().catch((err) => {
  console.error('Fatal error in verify-rehearsal:', err);
  process.exit(1);
});
