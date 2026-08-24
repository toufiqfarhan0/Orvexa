import { PgInspectionAdapter } from './adapters/pg-inspection.adapter.js';
import { PostgresInspectionService } from './services/postgres-inspection.service.js';
import { config } from '../config/env.js';
import { sanitizeConnectionString } from './utils/sanitizer.js';

/**
 * Standalone verification utility to test live PostgreSQL database inspection.
 * Usage: npx tsx src/db/verify-postgres.ts
 */
async function main() {
  const sanitizedTarget = sanitizeConnectionString(config.databaseUrl);
  console.info(`[verify-postgres] Inspecting PostgreSQL at target: ${sanitizedTarget}`);

  const adapter = new PgInspectionAdapter({
    connectionString: config.databaseUrl,
  });
  const service = new PostgresInspectionService(adapter);

  try {
    console.info('\n--- 1. Connectivity Check ---');
    const connectivity = await service.verifyTargetDatabase();
    console.info('Connected:', connectivity.connected);
    console.info('Database:', connectivity.database);
    console.info('User:', connectivity.currentUser);
    console.info('Latency:', `${connectivity.latencyMs}ms`);

    console.info('\n--- 2. Server Metadata ---');
    const server = await service.inspectServer();
    console.info('Version:', server.version);
    console.info('Major Version:', server.majorVersion);
    console.info('Encoding:', server.serverEncoding);
    console.info('Max Connections:', server.maxConnections);

    console.info('\n--- 3. Schemas ---');
    const schemas = await service.inspectSchemas();
    console.info('Found Schemas:', schemas.map((s) => s.name).join(', '));

    console.info('\n--- 4. Tables in public schema ---');
    const tables = await service.inspectTables('public');
    console.info('Found Tables:', tables.map((t) => t.tableName).join(', '));

    if (tables.length > 0) {
      const firstTable = tables[0].tableName;
      console.info(`\n--- 5. Full Inspection of '${firstTable}' ---`);
      const full = await service.inspectTable('public', firstTable);
      console.info('Columns Count:', full.columns.length);
      console.info('Primary Key:', full.primaryKey?.name || 'None');
      console.info('Foreign Keys Count:', full.foreignKeys.length);
      console.info('Indexes Count:', full.indexes.length);
      console.info('Statistics Live Tuples:', full.statistics?.liveTuples ?? 'N/A');
    }

    console.info('\n--- 6. Active Queries ---');
    const queries = await service.inspectActiveQueries();
    console.info('Active Non-Idle Queries Count:', queries.length);

    console.info('\n--- 7. Locks ---');
    const locks = await service.inspectLocks();
    console.info('Active Locks Count:', locks.length);

    console.info('\n[verify-postgres] Database inspection completed successfully.');
  } catch (err) {
    console.error(
      '[verify-postgres] Verification failed:',
      err instanceof Error ? err.message : err
    );
    process.exitCode = 1;
  } finally {
    await service.close();
  }
}

if (process.argv[1]?.includes('verify-postgres')) {
  main();
}
